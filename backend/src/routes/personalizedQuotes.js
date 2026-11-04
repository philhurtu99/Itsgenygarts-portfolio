import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { actionLimiter } from '../middleware/rateLimit.js';
import { cleanText } from '../utils/sanitize.js';
import { formatPhoneForCountry } from '../utils/phone.js';
import { imageUpload, normalizeUploadedImage } from '../utils/imageUpload.js';
import { createUploadToken, verifyUploadToken } from '../utils/uploadToken.js';
import { sendEmail } from '../services/email.js';
import { notifyNewPersonalizedQuote } from '../services/adminPushNotifications.js';
import { emailBox, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageFromRequest, languageOf } from '../utils/language.js';
import { protectPrivateMedia } from '../utils/privateMedia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'quotes');

// Ensure directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();
const prisma = new PrismaClient();
const upload = imageUpload({ fileSize: 5 * 1024 * 1024, files: 5 });

function extensionForMime(mime) {
  return ({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  })[mime] || '.jpg';
}

function quoteAddress(quote) {
  return [
    quote.customerAddress,
    quote.customerCity,
    quote.customerProvince,
    quote.customerPostalCode,
    quote.customerCountry,
  ].filter(Boolean).join(', ');
}

async function sendPersonalizedQuoteNotification(quote) {
  const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.BUSINESS_EMAIL;
  if (!to) return;

  const content = `
    <p>Une nouvelle demande de devis personnalisé vient d'arriver.</p>
    ${emailBox(`
      <strong>Devis :</strong> #${Number(quote.id)}<br>
      <strong>Client :</strong> ${emailEscape(quote.customerName)}<br>
      <strong>Email :</strong> ${emailEscape(quote.customerEmail)}<br>
      <strong>Téléphone :</strong> ${emailEscape(quote.customerPhone || '-')}<br>
      <strong>Adresse :</strong> ${emailEscape(quoteAddress(quote))}
    `)}
    ${emailBox(`<strong>Description :</strong><br>${emailEscape(quote.description).replace(/\n/g, '<br>')}`)}
  `;

  await sendEmail({
    to,
    profile: 'system',
    subject: `Nouveau devis personnalisé #${quote.id}`,
    text: `Nouveau devis personnalisé #${quote.id}\n\nClient: ${quote.customerName}\nEmail: ${quote.customerEmail}\nTéléphone: ${quote.customerPhone || '-'}\nAdresse: ${quoteAddress(quote)}\n\nDescription:\n${quote.description}`,
    html: emailHtml({ title: `Nouveau devis personnalisé #${quote.id}`, recipientEmail: to, content }),
  });
}

async function sendPersonalizedQuoteReceipt(quote) {
  const lang = languageOf(quote);
  const en = isEnglish(lang);
  const content = `
    <p>${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(quote.customerName)}</strong>,</p>
    <p>${en ? 'We have received your personalized quote request.' : 'Nous avons bien reçu votre demande de devis personnalisé.'}</p>
    ${emailBox(`<strong>${en ? 'Quote:' : 'Devis :'}</strong> #${Number(quote.id)}`)}
    <p>${en ? 'We will review your request and reply with the next steps.' : 'Nous allons regarder votre demande et vous répondre avec les prochaines étapes.'}</p>
  `;

  await sendEmail({
    to: quote.customerEmail,
    profile: 'system',
    lang,
    subject: en ? `Your quote request #${quote.id} was received` : `Votre demande de devis #${quote.id} est reçue`,
    text: en
      ? `Hello ${quote.customerName},\n\nWe have received your personalized quote request #${quote.id}.\n\nWe will review your request and reply with the next steps.`
      : `Bonjour ${quote.customerName},\n\nNous avons bien reçu votre demande de devis personnalisé #${quote.id}.\n\nNous allons regarder votre demande et vous répondre avec les prochaines étapes.`,
    html: emailHtml({ lang, title: en ? `Quote request #${quote.id}` : `Demande de devis #${quote.id}`, recipientEmail: quote.customerEmail, content }),
  });
}

// POST /api/personalized-quotes — create a personalized quote request
router.post('/', actionLimiter, async (req, res, next) => {
  try {
    const customerLanguage = languageFromRequest(req);
    const {
      description,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerProvince,
      customerPostalCode,
      customerCountry,
    } = req.body;
    assertShippingDestinationAllowed(customerCountry, customerLanguage);

    if (!description || !customerName || !customerEmail || !customerAddress || !customerCity || !customerPostalCode || !customerCountry) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }

    const quote = await prisma.personalizedQuote.create({
      data: {
        description: cleanText(description, 5000),
        customerName: cleanText(customerName, 100),
        customerEmail: cleanText(customerEmail, 255),
        customerPhone: cleanText(formatPhoneForCountry(customerPhone, customerCountry), 30) || null,
        customerAddress: cleanText(customerAddress, 255),
        customerCity: cleanText(customerCity, 100),
        customerProvince: cleanText(customerProvince, 100) || null,
        customerPostalCode: cleanText(customerPostalCode, 20),
        customerCountry: cleanText(customerCountry, 10),
        customerLanguage,
      },
    });

    sendPersonalizedQuoteNotification(quote).catch((err) => {
      console.error(`Failed to send personalized quote notification for #${quote.id}:`, err.message);
    });
    sendPersonalizedQuoteReceipt(quote).catch((err) => {
      console.error(`Failed to send personalized quote receipt for #${quote.id}:`, err.message);
    });
    notifyNewPersonalizedQuote(prisma, quote).catch((err) => {
      console.error(`Failed to send personalized quote push notification for #${quote.id}:`, err.message);
    });

    res.status(201).json({
      success: true,
      data: {
        ...quote,
        uploadToken: createUploadToken({ type: 'personalized-quote', id: quote.id, email: quote.customerEmail }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/personalized-quotes/:id/images — upload up to 5 images (local storage)
router.post('/:id/images', upload.array('images', 5), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    try {
      verifyUploadToken(req.body.uploadToken || req.query.token, { type: 'personalized-quote', id });
    } catch {
      return res.status(403).json({ success: false, message: 'Lien de téléversement invalide ou expiré' });
    }

    const quote = await prisma.personalizedQuote.findUnique({ where: { id } });
    if (!quote) return res.status(404).json({ success: false, message: 'Devis introuvable' });

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune image fournie' });
    }

    const saved = [];
    for (const file of files) {
      const image = await normalizeUploadedImage(file);
      const ext = extensionForMime(image.mimetype);
      const row = await prisma.personalizedQuoteImage.create({
        data: {
          personalizedQuoteId: id,
          fileName: file.originalname || 'image.jpg',
          contentType: image.mimetype,
          storagePathOrUrl: '',
          uploadedAtUtc: new Date(),
        },
      });
      const filename = `${row.id}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), image.buffer);
      const url = `/uploads/quotes/${filename}`;
      const updated = await prisma.personalizedQuoteImage.update({
        where: { id: row.id },
        data: { storagePathOrUrl: url },
      });
      saved.push(protectPrivateMedia(updated));
    }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
});

export default router;
