import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { actionLimiter } from '../middleware/rateLimit.js';
import { requireAdmin } from '../middleware/auth.js';
import { cleanText } from '../utils/sanitize.js';
import { formatPhoneForCountry } from '../utils/phone.js';
import { sendEmail } from '../services/email.js';
import { emailBox, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageFromRequest, languageOf } from '../utils/language.js';

const router = Router();
const prisma = new PrismaClient();

function quoteAddress(quote) {
  return [
    quote.shippingAddress,
    quote.city,
    quote.postalCode,
    quote.country,
  ].filter(Boolean).join(', ');
}

function quoteItemsText(quote) {
  return (quote.items || [])
    .map((item) => `- ${item.productName} x${Number(item.quantity) || 1}: ${Number(item.subtotal).toFixed(2)} $`)
    .join('\n');
}

async function sendQuoteRequestNotification(quote) {
  const to = process.env.ORDER_NOTIFICATION_EMAIL || process.env.BUSINESS_EMAIL;
  if (!to) return;

  const content = `
    <p>Une nouvelle demande de devis panier vient d'arriver.</p>
    ${emailBox(`
      <strong>Devis :</strong> #${Number(quote.id)}<br>
      <strong>Client :</strong> ${emailEscape(quote.customerName)}<br>
      <strong>Email :</strong> ${emailEscape(quote.customerEmail)}<br>
      <strong>Téléphone :</strong> ${emailEscape(quote.customerPhone || '-')}<br>
      <strong>Total estimé :</strong> ${Number(quote.totalAmount).toFixed(2)} $<br>
      <strong>Adresse :</strong> ${emailEscape(quoteAddress(quote))}
    `)}
    ${quote.items?.length ? emailBox(`<strong>Articles :</strong><br>${emailEscape(quoteItemsText(quote)).replace(/\n/g, '<br>')}`) : ''}
    ${quote.message ? emailBox(`<strong>Message :</strong><br>${emailEscape(quote.message).replace(/\n/g, '<br>')}`) : ''}
  `;

  await sendEmail({
    to,
    profile: 'system',
    subject: `Nouveau devis panier #${quote.id}`,
    text: `Nouveau devis panier #${quote.id}\n\nClient: ${quote.customerName}\nEmail: ${quote.customerEmail}\nTéléphone: ${quote.customerPhone || '-'}\nTotal estimé: ${Number(quote.totalAmount).toFixed(2)} $\nAdresse: ${quoteAddress(quote)}\n\nArticles:\n${quoteItemsText(quote)}\n\nMessage:\n${quote.message || '-'}`,
    html: emailHtml({ title: `Nouveau devis panier #${quote.id}`, recipientEmail: to, content }),
  });
}

async function sendQuoteRequestReceipt(quote) {
  const lang = languageOf(quote);
  const en = isEnglish(lang);
  const content = `
    <p>${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(quote.customerName)}</strong>,</p>
    <p>${en ? 'We have received your quote request.' : 'Nous avons bien reçu votre demande de devis.'}</p>
    ${emailBox(`<strong>${en ? 'Quote:' : 'Devis :'}</strong> #${Number(quote.id)}<br><strong>${en ? 'Estimated total:' : 'Total estimé :'}</strong> ${Number(quote.totalAmount).toFixed(2)} $`)}
    <p>${en ? 'We will review your request and reply with the next steps.' : 'Nous allons regarder votre demande et vous répondre avec les prochaines étapes.'}</p>
  `;

  await sendEmail({
    to: quote.customerEmail,
    profile: 'system',
    lang,
    subject: en ? `Your quote request #${quote.id} was received` : `Votre demande de devis #${quote.id} est reçue`,
    text: en
      ? `Hello ${quote.customerName},\n\nWe have received your quote request #${quote.id}.\n\nEstimated total: ${Number(quote.totalAmount).toFixed(2)} $\n\nWe will review your request and reply with the next steps.`
      : `Bonjour ${quote.customerName},\n\nNous avons bien reçu votre demande de devis #${quote.id}.\n\nTotal estimé: ${Number(quote.totalAmount).toFixed(2)} $\n\nNous allons regarder votre demande et vous répondre avec les prochaines étapes.`,
    html: emailHtml({ lang, title: en ? `Quote request #${quote.id}` : `Demande de devis #${quote.id}`, recipientEmail: quote.customerEmail, content }),
  });
}

router.post('/', actionLimiter, async (req, res, next) => {
  try {
    const customerLanguage = languageFromRequest(req);
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      city,
      postalCode,
      country,
      message,
      items,
    } = req.body;
    assertShippingDestinationAllowed(country, customerLanguage);

    if (!customerName || !customerEmail || !shippingAddress || !city || !postalCode || !country) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const productIds = items.map((i) => i.productId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isDeleted: false, isDraft: false },
    });

    const errors = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) errors.push(`Product ${item.productId} not found`);
      else if (product.soldOut) errors.push(`Product "${product.name}" is sold out`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    let totalAmount = 0;
    const itemsData = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = Number(product.price);
      const quantity = Number(item.quantity) || 1;
      const subtotal = price * quantity;
      totalAmount += subtotal;
      return {
        productId: product.id,
        productName: product.name,
        productPrice: price,
        productImageUrl: product.mainImageUrl || null,
        quantity,
        subtotal,
      };
    });

    const quote = await prisma.quoteRequest.create({
      data: {
        customerName: cleanText(customerName, 100),
        customerEmail: cleanText(customerEmail, 255),
        customerPhone: cleanText(formatPhoneForCountry(customerPhone, country), 30) || null,
        shippingAddress: cleanText(shippingAddress, 255),
        city: cleanText(city, 100),
        postalCode: cleanText(postalCode, 20),
        country: cleanText(country, 10),
        customerLanguage,
        message: cleanText(message, 5000) || null,
        totalAmount,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    sendQuoteRequestNotification(quote).catch((err) => {
      console.error(`Failed to send quote request notification for #${quote.id}:`, err.message);
    });
    sendQuoteRequestReceipt(quote).catch((err) => {
      console.error(`Failed to send quote request receipt for #${quote.id}:`, err.message);
    });

    res.status(201).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const where = req.query.status ? { status: req.query.status } : {};
    const quotes = await prisma.quoteRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: quotes });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const quote = await prisma.quoteRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
});

export default router;
