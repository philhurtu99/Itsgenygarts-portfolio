import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { requireAdmin } from '../../middleware/auth.js';
import { uploadImage, deleteImage } from '../../services/cloudinary.js';
import { discardPendingOrder } from '../../services/pendingOrders.js';
import { markRegularOrderPaid } from '../../services/regularOrderPayment.js';
import { sendEmail } from '../../services/email.js';
import { sendPaidOrderEmails } from '../../services/orderEmails.js';
import { applyNewsletterConsent, isEmailLike, normalizeEmail } from '../../services/newsletterConsent.js';
import { emailBox, emailButton, emailEscape, emailHtml } from '../../utils/emailTemplate.js';
import { imageUpload, normalizeUploadedImage } from '../../utils/imageUpload.js';
import { getConfiguredFrontendUrl } from '../../utils/frontendUrl.js';
import { bilingualData } from '../../utils/bilingualFields.js';
import { customsFieldsFromBody, categoryCustomsFieldsFromBody } from '../../utils/customsFields.js';
import { isEnglish, languageForEmail } from '../../utils/language.js';

const router = Router();
const prisma = new PrismaClient();
const upload = imageUpload({ files: 1, fileSize: 12 * 1024 * 1024, allowPhonePhotos: true });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES = 24 * 60;

router.use(requireAdmin);

const yarnInclude = {
  images: { orderBy: { order: 'asc' } },
  category: true,
};

function soldOutFromStock(stockQuantity, fallback) {
  if (stockQuantity !== undefined) return Number(stockQuantity) <= 0;
  return fallback;
}

function parseMoney(value, fallback = 0) {
  const amount = Number(value === undefined || value === null || value === '' ? fallback : value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function packagedDimensionsFromBody(body, { required = false } = {}) {
  const fields = [
    ['packageWeightGrams', true],
    ['packageLengthCm', false],
    ['packageWidthCm', false],
    ['packageHeightCm', false],
  ];
  const hasAnyField = fields.some(([key]) => Object.prototype.hasOwnProperty.call(body, key));
  if (!hasAnyField) {
    return required
      ? { error: 'Le poids et les dimensions emballées sont requis pour la laine.' }
      : { data: {} };
  }

  const data = {};
  for (const [key, integer] of fields) {
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value <= 0) {
      return { error: 'Le poids et les dimensions emballées doivent être supérieurs à zéro.' };
    }
    data[key] = integer ? Math.round(value) : Math.round(value * 100) / 100;
  }
  return { data };
}

function ensureSellableYarn(yarn) {
  if (!yarn || yarn.isDeleted) return 'Laine introuvable';
  if (yarn.soldOut || Number(yarn.stockQuantity || 0) <= 0) return 'Laine vendue';
  return null;
}

function yarnImageUrl(yarn) {
  return yarn.mainImageUrl || yarn.images?.[0]?.imageUrl || null;
}

function orderItemForYarn(yarn, { salePrice = null } = {}) {
  const price = salePrice ?? Number(yarn.price);
  return {
    productId: null,
    productName: `Laine - ${yarn.name}`,
    productImageUrl: yarnImageUrl(yarn),
    unitPrice: price,
    shippingPrice: 0,
    quantity: 1,
    subtotal: price,
  };
}

async function createSingleYarnOrder(yarn, {
  status = 'PENDING',
  shippingTotal = 0,
  customerName = 'Client lien de paiement',
  customerEmail = null,
  customerPhone = null,
  customerAddress = 'Adresse à confirmer',
  customerCity = 'À confirmer',
  customerProvince = null,
  customerPostalCode = 'À confirmer',
  customerCountry = 'CA',
  stripePaymentId = null,
  paidAt = null,
  salePrice = null,
  customerLanguage = 'en',
} = {}) {
  const item = orderItemForYarn(yarn, { salePrice });
  const subtotal = Number(item.subtotal);
  const total = Math.round((subtotal + Number(shippingTotal || 0)) * 100) / 100;

  const order = await prisma.order.create({
    data: {
      customerName,
      customerEmail: customerEmail || `yarn-payment-link-${Date.now()}@pending.local`,
      customerPhone,
      customerAddress,
      customerCity,
      customerProvince,
      customerPostalCode,
      customerCountry,
      customerLanguage,
      currency: 'CAD',
      subtotal,
      shippingTotal,
      total,
      status,
      stripePaymentId,
      paidAt,
      items: { create: [item] },
    },
    include: { items: true },
  });

  return { order, item };
}

async function decrementYarnStock(yarnProductId) {
  return prisma.$transaction(async (tx) => {
    const yarn = await tx.yarnProduct.findUnique({
      where: { id: Number(yarnProductId) },
      include: yarnInclude,
    });
    const unavailable = ensureSellableYarn(yarn);
    if (unavailable) throw new Error(unavailable);

    const nextStock = Math.max(0, Number(yarn.stockQuantity || 0) - 1);
    return tx.yarnProduct.update({
      where: { id: yarn.id },
      data: {
        stockQuantity: nextStock,
        soldOut: nextStock <= 0,
      },
      include: yarnInclude,
    });
  });
}

async function restoreYarnStock(yarnProductId) {
  const id = Number(yarnProductId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.yarnProduct.update({
    where: { id },
    data: {
      stockQuantity: { increment: 1 },
      soldOut: false,
    },
  });
}

async function sendYarnPaymentLinkEmail({ to, customerName, yarn, checkoutUrl, shippingTotal, total, expiresInMinutes, lang = 'en' }) {
  const en = isEnglish(lang);
  const name = String(customerName || '').trim() || (en ? 'Hello' : 'Bonjour');
  const expiresText = expiresInMinutes >= 60 && expiresInMinutes % 60 === 0
    ? `${expiresInMinutes / 60} ${en ? 'hours' : 'heures'}`
    : `${expiresInMinutes} ${en ? 'minutes' : 'minutes'}`;
  const text = en ? [
    `${name},`,
    '',
    `Here is the link to pay for ${yarn.name}.`,
    `Total: ${Number(total).toFixed(2)} $ CAD${Number(shippingTotal || 0) > 0 ? `, including ${Number(shippingTotal).toFixed(2)} $ shipping.` : '.'}`,
    `The link expires in ${expiresText}.`,
    '',
    checkoutUrl,
    '',
    'The yarn will only be marked as sold after the payment is confirmed.',
  ].join('\n') : [
    `${name},`,
    '',
    `Voici le lien pour payer ${yarn.name}.`,
    `Total: ${Number(total).toFixed(2)} $ CAD${Number(shippingTotal || 0) > 0 ? `, incluant ${Number(shippingTotal).toFixed(2)} $ de livraison.` : '.'}`,
    `Le lien expire dans ${expiresText}.`,
    '',
    checkoutUrl,
    '',
    'La laine sera marquée comme vendue seulement après le paiement confirmé.',
  ].join('\n');

  await sendEmail({
    to,
    profile: 'system',
    lang,
    subject: en ? `${yarn.name} - payment link` : `${yarn.name} - lien de paiement`,
    text,
    html: emailHtml({
      lang,
      title: en ? 'Payment link' : 'Lien de paiement',
      recipientEmail: to,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content: [
        `<p style="margin:0 0 16px;">${emailEscape(name)},</p>`,
        `<p style="margin:0 0 16px;">${en ? 'Here is the link to pay for' : 'Voici le lien pour payer'} <strong>${emailEscape(yarn.name)}</strong>.</p>`,
        emailBox(en
          ? `Total: <strong>${Number(total).toFixed(2)} $ CAD</strong>${Number(shippingTotal || 0) > 0 ? `<br>Shipping included: ${Number(shippingTotal).toFixed(2)} $` : ''}<br>The yarn will only be marked as sold after the payment is confirmed.`
          : `Total: <strong>${Number(total).toFixed(2)} $ CAD</strong>${Number(shippingTotal || 0) > 0 ? `<br>Livraison incluse: ${Number(shippingTotal).toFixed(2)} $` : ''}<br>La laine sera marquée comme vendue seulement après le paiement confirmé.`),
        emailButton(en ? 'Pay now' : 'Payer maintenant', checkoutUrl),
        `<p style="margin:0;color:#8A7A6A;font-size:14px;">${en ? `This link expires in ${expiresText}.` : `Ce lien expire dans ${expiresText}.`}</p>`,
      ].join(''),
    }),
  });
}

async function markYarnOrderPaid(orderId, stripeObject, context) {
  const yarnProductId = Number(stripeObject?.metadata?.yarnProductId || 0);
  if (!yarnProductId) return null;
  const id = Number(orderId);
  if (!Number.isInteger(id)) return null;

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existingOrder) return null;
  if (existingOrder.status !== 'PENDING') {
    return existingOrder.status === 'PAID' ? existingOrder : null;
  }

  let stockDecremented = false;
  try {
    await decrementYarnStock(yarnProductId);
    stockDecremented = true;
    const order = await markRegularOrderPaid(prisma, id, stripeObject, context);
    if (!order) {
      await restoreYarnStock(yarnProductId).catch(() => {});
      return null;
    }
    return prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
  } catch (err) {
    if (stockDecremented) {
      await restoreYarnStock(yarnProductId).catch(() => {});
    }
    throw err;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const yarn = await prisma.yarnProduct.findMany({
      include: yarnInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: yarn });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { price, stockQuantity, categoryId, soldOut } = req.body;
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const packaged = packagedDimensionsFromBody(req.body, { required: true });
    if (packaged.error) return res.status(400).json({ success: false, message: packaged.error });
    const customs = customsFieldsFromBody(req.body, { kind: 'yarn' });
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    if (categoryId) {
      const cat = await prisma.yarnCategory.findUnique({ where: { id: Number(categoryId) } });
      if (!cat) return res.status(400).json({ success: false, message: 'Yarn category not found' });
    }
    const qty = stockQuantity !== undefined ? Number(stockQuantity) : 0;
    const yarn = await prisma.yarnProduct.create({
      data: {
        ...bilingual,
        price: Number(price),
        stockQuantity: qty,
        soldOut: soldOutFromStock(qty, soldOut),
        categoryId: categoryId ? Number(categoryId) : null,
        ...packaged.data,
        ...customs.data,
      },
      include: yarnInclude,
    });
    res.status(201).json({ success: true, data: yarn });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { price, stockQuantity, categoryId, soldOut } = req.body;
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const packaged = packagedDimensionsFromBody(req.body, { required: true });
    if (packaged.error) return res.status(400).json({ success: false, message: packaged.error });
    const customs = customsFieldsFromBody(req.body, { kind: 'yarn' });
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    if (categoryId) {
      const cat = await prisma.yarnCategory.findUnique({ where: { id: Number(categoryId) } });
      if (!cat) return res.status(400).json({ success: false, message: 'Yarn category not found' });
    }
    const qty = stockQuantity !== undefined ? Number(stockQuantity) : undefined;
    const yarn = await prisma.yarnProduct.update({
      where: { id: Number(req.params.id) },
      data: {
        ...bilingual,
        price: Number(price),
        stockQuantity: qty,
        soldOut: soldOutFromStock(qty, soldOut),
        categoryId: categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : undefined,
        ...packaged.data,
        ...customs.data,
      },
      include: yarnInclude,
    });
    res.json({ success: true, data: yarn });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/market-sale', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    const yarnId = Number(req.params.id);
    const yarn = await prisma.yarnProduct.findUnique({ where: { id: yarnId }, include: yarnInclude });
    const unavailable = ensureSellableYarn(yarn);
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });

    const salePrice = parseMoney(req.body.salePrice, yarn.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }
    const paymentMethod = String(req.body.paymentMethod || 'MANUAL').toUpperCase();
    const customerName = req.body.customerName?.trim() || `Vente marché (${paymentMethod})`;
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `yarn-market-sale-${Date.now()}@pos.local`;

    const { order } = await createSingleYarnOrder(yarn, {
      status: 'PAID',
      customerName,
      customerEmail,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
      stripePaymentId: `market-${paymentMethod.toLowerCase()}-${Date.now()}`,
      paidAt: new Date(),
      salePrice,
      customerLanguage,
    });

    let updated;
    try {
      updated = await decrementYarnStock(yarnId);
    } catch (stockErr) {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      return res.status(409).json({ success: false, message: stockErr.message });
    }

    const paidOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    if (rawCustomerEmail && paidOrder) {
      await applyNewsletterConsent(prisma, {
        email: normalizedCustomerEmail,
        name: customerName,
        consent: true,
      });
      await sendPaidOrderEmails(paidOrder, { prisma });
    }

    res.status(201).json({
      success: true,
      data: {
        yarn: updated,
        order: paidOrder,
        sale: {
          paymentMethod,
          salePrice,
          soldQuantity: 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/tap-to-pay-intent', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const yarnId = Number(req.params.id);
    const yarn = await prisma.yarnProduct.findUnique({ where: { id: yarnId }, include: yarnInclude });
    const unavailable = ensureSellableYarn(yarn);
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });

    const salePrice = parseMoney(req.body.salePrice, yarn.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }

    const { order, item } = await createSingleYarnOrder(yarn, {
      status: 'PENDING',
      customerName: req.body.customerName?.trim() || 'Vente Tap to Pay',
      customerEmail: rawCustomerEmail ? normalizedCustomerEmail : `yarn-tap-to-pay-${Date.now()}@pos.local`,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
      salePrice,
      customerLanguage,
    });

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100),
        currency: 'cad',
        payment_method_types: ['card_present', 'interac_present'],
        capture_method: 'automatic',
        description: `Tap to Pay - ${item.productName}`,
        metadata: {
          orderId: String(order.id),
          yarnProductId: String(yarn.id),
          source: 'admin-yarn-tap-to-pay',
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentId: paymentIntent.id },
      });

      res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: Number(order.total),
          currency: 'CAD',
        },
      });
    } catch (err) {
      await discardPendingOrder(order.id).catch(() => {});
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.post('/terminal/payment-intents/:paymentIntentId/sync', async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
    const orderId = paymentIntent.metadata?.orderId;
    let order = null;
    if (paymentIntent.status === 'succeeded' && orderId) {
      order = await markYarnOrderPaid(orderId, paymentIntent, 'terminal.yarn.tap-to-pay.sync');
      const email = normalizeEmail(order?.customerEmail);
      if (order && isEmailLike(email) && !email.endsWith('@pos.local')) {
        await applyNewsletterConsent(prisma, {
          email,
          name: order.customerName,
          consent: true,
        });
      }
    }
    res.json({ success: true, data: { status: paymentIntent.status, orderId: orderId ? Number(orderId) : null, order } });
  } catch (err) {
    next(err);
  }
});

router.post('/terminal/payment-intents/:paymentIntentId/cancel', async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
    const orderId = paymentIntent.metadata?.orderId;
    if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status)) {
      await stripe.paymentIntents.cancel(paymentIntent.id);
    }
    if (orderId) {
      await discardPendingOrder(orderId);
    }
    res.json({ success: true, data: { status: 'canceled', orderId: orderId ? Number(orderId) : null } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payment-link', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const yarnId = Number(req.params.id);
    const shippingTotal = parseMoney(req.body.shippingTotal, 0);
    if (shippingTotal === null) {
      return res.status(400).json({ success: false, message: 'Livraison invalide' });
    }
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }
    const customerName = String(req.body.customerName || '').trim() || 'Client lien de paiement';
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `yarn-payment-link-${Date.now()}@pos.local`;

    const yarn = await prisma.yarnProduct.findUnique({ where: { id: yarnId }, include: yarnInclude });
    const unavailable = ensureSellableYarn(yarn);
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });
    const salePrice = parseMoney(req.body.salePrice, yarn.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }

    const { order, item } = await createSingleYarnOrder(yarn, {
      status: 'PENDING',
      shippingTotal,
      customerName,
      customerEmail,
      salePrice,
      customerLanguage,
    });

    try {
      const lineItems = [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: item.productName,
            ...(item.productImageUrl ? { images: [item.productImageUrl] } : {}),
          },
          unit_amount: Math.round(Number(item.unitPrice) * 100),
        },
        quantity: 1,
      }];

      if (shippingTotal > 0) {
        lineItems.push({
          price_data: {
            currency: 'cad',
            product_data: { name: isEnglish(customerLanguage) ? 'Shipping' : 'Livraison' },
            unit_amount: Math.round(shippingTotal * 100),
          },
          quantity: 1,
        });
      }

      const frontendUrl = getConfiguredFrontendUrl();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        invoice_creation: { enabled: true },
        ...(rawCustomerEmail ? { customer_email: normalizedCustomerEmail } : {}),
        phone_number_collection: { enabled: true },
        shipping_address_collection: { allowed_countries: ['CA', 'US'] },
        metadata: {
          orderId: String(order.id),
          yarnProductId: String(yarn.id),
          source: 'admin-yarn-payment-link',
        },
        payment_intent_data: {
          metadata: {
            orderId: String(order.id),
            yarnProductId: String(yarn.id),
            source: 'admin-yarn-payment-link',
          },
        },
        expires_at: Math.floor(Date.now() / 1000) + ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES * 60,
        success_url: `${frontendUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/products`,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });

      let emailQueued = false;
      if (rawCustomerEmail) {
        await applyNewsletterConsent(prisma, {
          email: normalizedCustomerEmail,
          name: customerName,
          consent: true,
        });

        sendYarnPaymentLinkEmail({
          to: normalizedCustomerEmail,
          customerName,
          yarn,
          checkoutUrl: session.url,
          shippingTotal,
          total: Number(order.total),
          expiresInMinutes: ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES,
          lang: customerLanguage,
        }).catch((emailErr) => {
          console.error(`Failed to send yarn payment link email for order #${order.id}:`, emailErr.message);
        });
        emailQueued = true;
      }

      res.status(201).json({
        success: true,
        data: {
          checkoutUrl: session.url,
          orderId: order.id,
          expiresInMinutes: ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES,
          emailQueued,
          reserved: false,
        },
      });
    } catch (err) {
      await discardPendingOrder(order.id).catch(() => {});
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.yarnProduct.update({
      where: { id: Number(req.params.id) },
      data: { isDeleted: true },
    });
    res.json({ success: true, message: 'Yarn deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    const yarnProductId = Number(req.params.id);
    const { existingImageUrl } = req.body;

    if (!req.file && !existingImageUrl) {
      return res.status(400).json({ success: false, message: 'No file or image URL provided' });
    }

    const existing = await prisma.yarnProduct.findUnique({
      where: { id: yarnProductId },
      include: { images: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Yarn not found' });

    let imageUrl;
    let publicId;
    if (req.file) {
      const image = await normalizeUploadedImage(req.file, { allowPhonePhotos: true });
      const result = await uploadImage(image.buffer);
      imageUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      imageUrl = existingImageUrl;
      publicId = '';
    }

    const nextOrder = existing.images.length > 0 ? Math.max(...existing.images.map((i) => i.order)) + 1 : 0;
    await prisma.yarnImage.create({
      data: { yarnProductId, imageUrl, publicId, order: nextOrder },
    });

    if (!existing.mainImageUrl) {
      await prisma.yarnProduct.update({
        where: { id: yarnProductId },
        data: { mainImageUrl: imageUrl },
      });
    }

    const yarn = await prisma.yarnProduct.findUnique({ where: { id: yarnProductId }, include: yarnInclude });
    res.status(201).json({ success: true, data: yarn });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/images/:imageId', async (req, res, next) => {
  try {
    const yarnProductId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const image = await prisma.yarnImage.findFirst({ where: { id: imageId, yarnProductId } });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

    if (image.publicId) await deleteImage(image.publicId);
    await prisma.yarnImage.delete({ where: { id: imageId } });

    const yarn = await prisma.yarnProduct.findUnique({
      where: { id: yarnProductId },
      include: { images: { orderBy: { order: 'asc' } } },
    });
    if (yarn.mainImageUrl === image.imageUrl) {
      await prisma.yarnProduct.update({
        where: { id: yarnProductId },
        data: { mainImageUrl: yarn.images[0]?.imageUrl || null },
      });
    }

    const updated = await prisma.yarnProduct.findUnique({ where: { id: yarnProductId }, include: yarnInclude });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/categories/all', async (req, res, next) => {
  try {
    const categories = await prisma.yarnCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { _count: { select: { yarnProducts: true } } },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const customs = categoryCustomsFieldsFromBody(req.body, 'yarn');
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const category = await prisma.yarnCategory.create({ data: { ...req.body, ...bilingual, ...customs.data } });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const customs = categoryCustomsFieldsFromBody(req.body, 'yarn');
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    const bilingual = bilingualData(req.body);
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const category = await prisma.yarnCategory.update({
      where: { id: Number(req.params.id) },
      data: { ...req.body, ...bilingual, ...customs.data },
    });
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await prisma.yarnCategory.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: 'Yarn category deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
