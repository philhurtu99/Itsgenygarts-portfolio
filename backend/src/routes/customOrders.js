import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { actionLimiter } from '../middleware/rateLimit.js';
import { requireAdmin } from '../middleware/auth.js';
import { cleanText } from '../utils/sanitize.js';
import { formatPhoneForCountry } from '../utils/phone.js';
import { imageUpload, normalizeUploadedImage } from '../utils/imageUpload.js';
import { createUploadToken, verifyUploadToken } from '../utils/uploadToken.js';
import { sendEmail } from '../services/email.js';
import { notifyNewCustomOrder } from '../services/adminPushNotifications.js';
import { emailBox, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageFromRequest, languageOf } from '../utils/language.js';
import { protectPrivateMedia } from '../utils/privateMedia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'custom-orders');

// Ensure directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = imageUpload({ fileSize: 5 * 1024 * 1024, files: 3 });

const router = Router();
const prisma = new PrismaClient();

function validateCustomOrder(body) {
  const errors = [];

  if (!body.customerName) errors.push('customerName is required');
  if (!body.customerEmail) errors.push('customerEmail is required');
  if (!body.customerAddress) errors.push('customerAddress is required');
  if (!body.customerCity) errors.push('customerCity is required');
  if (!body.customerPostalCode) errors.push('customerPostalCode is required');
  if (!body.customerCountry) errors.push('customerCountry is required');
  if (!body.category) errors.push('category is required');
  if (!body.colorStyle) errors.push('colorStyle is required');

  if (body.colorStyle === 'SOLID_COLOR' && !body.selectedColors) {
    errors.push('selectedColors is required for SOLID_COLOR');
  }
  if (body.colorStyle === 'MULTIPLE_SOLID_COLORS' && !body.selectedColors) {
    errors.push('selectedColors is required for MULTIPLE_SOLID_COLORS');
  }
  if (body.colorStyle === 'COLOR_CHANGING_YARN' && !body.colorChangingTheme) {
    errors.push('colorChangingTheme is required for COLOR_CHANGING_YARN');
  }

  return errors;
}

function extensionForMime(mime) {
  return ({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  })[mime] || '.jpg';
}

function formatAddress(order) {
  return [
    order.customerAddress,
    order.customerCity,
    order.customerProvince,
    order.customerPostalCode,
    order.customerCountry,
  ].filter(Boolean).join(', ');
}

function selectedOptionsText(order) {
  if (!order.selectedOptions) return '-';
  try {
    const parsed = typeof order.selectedOptions === 'string'
      ? JSON.parse(order.selectedOptions)
      : order.selectedOptions;
    if (!parsed || typeof parsed !== 'object') return '-';
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  } catch {
    return String(order.selectedOptions);
  }
}

async function sendCustomOrderNotification(order) {
  const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.BUSINESS_EMAIL;
  if (!to) return;

  const optionsHtml = selectedOptionsText(order)
    .split('\n')
    .map((line) => emailEscape(line))
    .join('<br>');
  const content = `
    <p>Une nouvelle demande de commande sur mesure vient d'arriver.</p>
    ${emailBox(`
      <strong>Commande custom :</strong> #${Number(order.id)}<br>
      <strong>Client :</strong> ${emailEscape(order.customerName)}<br>
      <strong>Email :</strong> ${emailEscape(order.customerEmail)}<br>
      <strong>Téléphone :</strong> ${emailEscape(order.customerPhone || '-')}<br>
      <strong>Catégorie :</strong> ${emailEscape(order.category)}<br>
      <strong>Style couleur :</strong> ${emailEscape(order.colorStyle)}<br>
      <strong>Adresse :</strong> ${emailEscape(formatAddress(order))}
    `)}
    ${optionsHtml !== '-' ? emailBox(`<strong>Options :</strong><br>${optionsHtml}`) : ''}
    ${order.description ? emailBox(`<strong>Notes :</strong><br>${emailEscape(order.description).replace(/\n/g, '<br>')}`) : ''}
  `;

  await sendEmail({
    to,
    profile: 'system',
    subject: `Nouvelle commande custom #${order.id}`,
    text: `Nouvelle commande custom #${order.id}\n\nClient: ${order.customerName}\nEmail: ${order.customerEmail}\nTéléphone: ${order.customerPhone || '-'}\nCatégorie: ${order.category}\nStyle couleur: ${order.colorStyle}\nAdresse: ${formatAddress(order)}\n\nOptions:\n${selectedOptionsText(order)}\n\nNotes:\n${order.description || '-'}`,
    html: emailHtml({ title: `Nouvelle commande custom #${order.id}`, recipientEmail: to, content }),
  });
}

async function sendCustomOrderReceipt(order) {
  const lang = languageOf(order);
  const en = isEnglish(lang);
  const content = `
    <p>${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(order.customerName)}</strong>,</p>
    <p>${en ? 'We have received your custom order request.' : 'Nous avons bien reçu votre demande de commande sur mesure.'}</p>
    ${emailBox(`
      <strong>${en ? 'Custom order:' : 'Commande custom :'}</strong> #${Number(order.id)}<br>
      <strong>${en ? 'Category:' : 'Catégorie :'}</strong> ${emailEscape(order.category)}<br>
      <strong>${en ? 'Color style:' : 'Style couleur :'}</strong> ${emailEscape(order.colorStyle)}
    `)}
    <p>${en ? 'We will review your request and reply with the next steps.' : 'Nous allons regarder votre demande et vous répondre avec les prochaines étapes.'}</p>
  `;

  await sendEmail({
    to: order.customerEmail,
    profile: 'system',
    lang,
    subject: en ? `Your custom request #${order.id} was received` : `Votre demande sur mesure #${order.id} est reçue`,
    text: en
      ? `Hello ${order.customerName},\n\nWe have received your custom order request #${order.id}.\n\nCategory: ${order.category}\nColor style: ${order.colorStyle}\n\nWe will review your request and reply with the next steps.`
      : `Bonjour ${order.customerName},\n\nNous avons bien reçu votre demande de commande sur mesure #${order.id}.\n\nCatégorie: ${order.category}\nStyle couleur: ${order.colorStyle}\n\nNous allons regarder votre demande et vous répondre avec les prochaines étapes.`,
    html: emailHtml({ lang, title: en ? `Custom request #${order.id}` : `Demande sur mesure #${order.id}`, recipientEmail: order.customerEmail, content }),
  });
}

router.get('/categories', async (req, res, next) => {
  try {
    const cats = await prisma.customOrderCategoryDef.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    const data = cats.map((c) => ({
      ...c,
      nameFr: c.nameFr || c.name || '',
      nameEn: c.nameEn || '',
      options: (() => { try { return c.options ? JSON.parse(c.options) : []; } catch { return []; } })(),
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/model-options', async (req, res, next) => {
  try {
    const options = await prisma.customModelOption.findMany({ orderBy: { id: 'asc' } });
    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
});

router.post('/', actionLimiter, async (req, res, next) => {
  try {
    const customerLanguage = languageFromRequest(req);
    const errors = validateCustomOrder(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const {
      productReferenceId,
      customModelOptionId,
      category,
      colorStyle,
      selectedColors,
      colorChangingTheme,
      rainbowMood,
      selectedOptions,
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

    const order = await prisma.customOrder.create({
      data: {
        productReferenceId: productReferenceId ? Number(productReferenceId) : null,
        customModelOptionId: customModelOptionId ? Number(customModelOptionId) : null,
        category: cleanText(category, 100),
        colorStyle: cleanText(colorStyle, 50),
        selectedColors: cleanText(selectedColors, 500) || null,
        colorChangingTheme: cleanText(colorChangingTheme, 200) || null,
        rainbowMood: cleanText(rainbowMood, 50) || null,
        selectedOptions: selectedOptions ? JSON.stringify(selectedOptions) : null,
        description: cleanText(description, 5000) || null,
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
      include: {
        images: true,
        productReference: true,
        customModelOption: true,
      },
    });

    sendCustomOrderNotification(order).catch((err) => {
      console.error(`Failed to send custom order notification for #${order.id}:`, err.message);
    });
    sendCustomOrderReceipt(order).catch((err) => {
      console.error(`Failed to send custom order receipt for #${order.id}:`, err.message);
    });
    notifyNewCustomOrder(prisma, order).catch((err) => {
      console.error(`Failed to send custom order push notification for #${order.id}:`, err.message);
    });

    res.status(201).json({
      success: true,
      data: {
        ...order,
        uploadToken: createUploadToken({ type: 'custom-order', id: order.id, email: order.customerEmail }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Upload images for a custom order (multipart, max 3 files) — local storage
router.post('/:id/images', upload.array('images', 3), async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    try {
      verifyUploadToken(req.body.uploadToken || req.query.token, { type: 'custom-order', id: orderId });
    } catch {
      return res.status(403).json({ success: false, message: 'Lien de téléversement invalide ou expiré' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune image fournie' });
    }

    const saved = [];
    for (const file of req.files) {
      const image = await normalizeUploadedImage(file);
      const ext = extensionForMime(image.mimetype);
      // Create DB row first to get auto-increment ID
      const row = await prisma.customOrderImage.create({
        data: {
          customOrderId: orderId,
          fileName: file.originalname || 'image.jpg',
          contentType: image.mimetype,
          storagePathOrUrl: '',
          uploadedAtUtc: new Date(),
        },
      });
      const filename = `${row.id}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), image.buffer);
      const url = `/uploads/custom-orders/${filename}`;
      const updated = await prisma.customOrderImage.update({
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

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const orders = await prisma.customOrder.findMany({
      orderBy: { createdAtUtc: 'desc' },
      include: {
        images: true,
        productReference: true,
        customModelOption: true,
      },
    });
    res.json({ success: true, data: protectPrivateMedia(orders) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.customOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        images: true,
        productReference: true,
        customModelOption: true,
      },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: protectPrivateMedia(order) });
  } catch (err) {
    next(err);
  }
});

export default router;
