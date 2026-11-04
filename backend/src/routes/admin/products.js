import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { requireAdmin } from '../../middleware/auth.js';
import { uploadImage, deleteImage } from '../../services/cloudinary.js';
import { removeProductFromCustomerLists } from '../../services/cartCleanup.js';
import { commitStockForOrder, reserveStockForOrder } from '../../services/stock.js';
import { discardPendingOrder } from '../../services/pendingOrders.js';
import { markRegularOrderPaid } from '../../services/regularOrderPayment.js';
import { sendEmail } from '../../services/email.js';
import { sendPaidOrderEmails } from '../../services/orderEmails.js';
import { expireConflictingPendingPaymentLinks } from '../../services/paymentLinkAvailability.js';
import { applyNewsletterConsent, isEmailLike, normalizeEmail } from '../../services/newsletterConsent.js';
import { emailBox, emailButton, emailEscape, emailHtml } from '../../utils/emailTemplate.js';
import { imageUpload, normalizeUploadedImage } from '../../utils/imageUpload.js';
import { getConfiguredFrontendUrl } from '../../utils/frontendUrl.js';
import { bilingualData } from '../../utils/bilingualFields.js';
import { productDetailsFromBody } from '../../utils/productDetails.js';
import { customsFieldsFromBody } from '../../utils/customsFields.js';
import { isEnglish, languageForEmail } from '../../utils/language.js';
import {
  imageWithVariantLabels,
  primaryProductImageUrl,
  syncProductVariants,
  isSimpleProduct,
  variantsWithLabels,
} from '../../utils/productVariants.js';

const router = Router();
const prisma = new PrismaClient();
const upload = imageUpload({ files: 1, fileSize: 12 * 1024 * 1024, allowPhonePhotos: true });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES = 24 * 60;

router.use(requireAdmin);

const productInclude = {
  images: { orderBy: { order: 'asc' } },
  variants: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { images: { orderBy: { order: 'asc' } } },
  },
  category: true,
};

const yarnInclude = {
  images: { orderBy: { order: 'asc' } },
  category: true,
};

function soldOutFromStock(stockQuantity, fallback) {
  if (stockQuantity !== undefined) return Number(stockQuantity) <= 0;
  return fallback;
}

function parseVariantColors(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw Object.assign(new Error('Les couleurs des variations sont invalides.'), { statusCode: 400 });
  return value.map((color) => {
    if (color === null || color === '') return null;
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
      throw Object.assign(new Error('Chaque couleur doit être un code hexadécimal valide.'), { statusCode: 400 });
    }
    return color.toUpperCase();
  });
}

async function saveVariantColors(tx, productId, colors) {
  if (!colors) return;
  const variants = await tx.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  await Promise.all(variants.map((variant, index) => (
    colors[index] === undefined
      ? Promise.resolve()
      : tx.productVariant.update({ where: { id: variant.id }, data: { colorHex: colors[index] } })
  )));
}

function serializeAdminProduct(product) {
  if (!product) return product;
  const variants = variantsWithLabels(product.variants || []);
  const visibleVariantIds = new Set(variants.map((variant) => variant.id));
  const visibleImages = (product.images || []).filter((image) => !image.variantId || visibleVariantIds.has(image.variantId));
  const orderedImages = imageWithVariantLabels(visibleImages, variants);
  if (isSimpleProduct(product, variants)) orderedImages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
  return {
    ...product,
    mainImageUrl: primaryProductImageUrl(product, variants),
    variants,
    images: orderedImages,
  };
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
      ? { error: 'Le poids et les dimensions emballées sont requis pour publier le produit.' }
      : { data: {} };
  }
  const hasAnyValue = fields.some(([key]) => body[key] !== undefined && body[key] !== null && body[key] !== '');
  if (!hasAnyValue && !required) {
    return { data: Object.fromEntries(fields.map(([key]) => [key, null])) };
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

function resolveSellableVariant(product, productVariantId) {
  const variants = product?.variants || [];
  if (variants.length === 0) return null;
  if (productVariantId) {
    return variants.find((variant) => variant.id === Number(productVariantId) && variant.status === 'AVAILABLE') || null;
  }
  return variants.find((variant) => variant.status === 'AVAILABLE') || null;
}

function variantLabel(product, variantId) {
  if (!variantId) return null;
  const variants = variantsWithLabels(product?.variants || [])
    .filter((variant) => variant.status !== 'SOLD');
  if (variants.length <= 1) return null;
  return variants.find((variant) => variant.id === variantId)?.label || null;
}

function ensureSellableProduct(product, variant, { allowDraft = false } = {}) {
  if (!product || product.isDeleted || (!allowDraft && product.isDraft)) return 'Produit introuvable';
  if (product.variants?.length && !variant) return 'Variation indisponible';
  if (!product.variants?.length && (product.soldOut || Number(product.stockQuantity || 0) <= 0)) return 'Produit vendu';
  return null;
}

function ensureSellableYarn(yarn) {
  if (!yarn || yarn.isDeleted) return 'Laine introuvable';
  if (yarn.soldOut || Number(yarn.stockQuantity || 0) <= 0) return 'Laine vendue';
  return null;
}

function orderItemForProduct(product, variant, { shippingTotal = 0, salePrice = null } = {}) {
  const price = salePrice ?? Number(product.price);
  const variantImageUrl = variant?.images?.[0]?.imageUrl || null;
  return {
    productId: product.id,
    productVariantId: variant?.id || null,
    productName: product.name,
    productImageUrl: variantImageUrl || product.mainImageUrl,
    variantLabelSnapshot: variantLabel(product, variant?.id),
    variantImageUrl,
    unitPrice: price,
    shippingPrice: shippingTotal,
    quantity: 1,
    subtotal: price,
  };
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

async function createSingleProductOrder(product, variant, {
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
  const item = orderItemForProduct(product, variant, { shippingTotal, salePrice });
  const subtotal = Number(item.subtotal);
  const total = Math.round((subtotal + shippingTotal) * 100) / 100;

  const order = await prisma.order.create({
    data: {
      customerName,
      customerEmail: customerEmail || `payment-link-${Date.now()}@pending.local`,
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

async function createBundleProductOrder(items, {
  status = 'PENDING',
  shippingTotal = 0,
  customerName,
  customerEmail,
  customerPhone = null,
  customerAddress = 'Vente en personne',
  customerCity = 'Marché',
  customerProvince = null,
  customerPostalCode = 'POS',
  customerCountry = 'CA',
  stripePaymentId = null,
  paidAt = null,
  customerLanguage = 'en',
}) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const total = Math.round((subtotal + Number(shippingTotal || 0)) * 100) / 100;

  const order = await prisma.order.create({
    data: {
      customerName,
      customerEmail,
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
      items: { create: items },
    },
    include: { items: true },
  });

  return { order, items };
}

function parseYarnProductIdsFromStripe(stripeObject) {
  const raw = stripeObject?.metadata?.yarnProductIds;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function paymentSourceAllowsDraftProduct(stripeObject) {
  const source = String(stripeObject?.metadata?.source || '');
  return source.startsWith('admin-market-') || source === 'admin-payment-link' || source === 'admin-tap-to-pay';
}

async function decrementYarnStockForBundle(yarnProductIds) {
  if (!yarnProductIds.length) return [];
  return prisma.$transaction(async (tx) => {
    const decremented = [];
    for (const yarnProductId of yarnProductIds) {
      const yarn = await tx.yarnProduct.findUnique({
        where: { id: Number(yarnProductId) },
        include: yarnInclude,
      });
      const unavailable = ensureSellableYarn(yarn);
      if (unavailable) throw new Error(`${yarn?.name || `Laine ${yarnProductId}`}: ${unavailable}`);

      const nextStock = Math.max(0, Number(yarn.stockQuantity || 0) - 1);
      await tx.yarnProduct.update({
        where: { id: yarn.id },
        data: {
          stockQuantity: nextStock,
          soldOut: nextStock <= 0,
        },
      });
      decremented.push(yarn.id);
    }
    return decremented;
  });
}

async function restoreYarnStockForBundle(yarnProductIds) {
  if (!yarnProductIds.length) return;
  await prisma.$transaction(yarnProductIds.map((id) => prisma.yarnProduct.update({
    where: { id: Number(id) },
    data: {
      stockQuantity: { increment: 1 },
      soldOut: false,
    },
  })));
}

async function markMarketCartOrderPaid(stripeObject, context) {
  const yarnProductIds = parseYarnProductIdsFromStripe(stripeObject);
  let decrementedYarnProductIds = [];
  try {
    decrementedYarnProductIds = await decrementYarnStockForBundle(yarnProductIds);
    const order = await markRegularOrderPaid(
      prisma,
      stripeObject?.metadata?.orderId,
      stripeObject,
      context,
      { allowDraft: true },
    );
    if (!order) {
      await restoreYarnStockForBundle(decrementedYarnProductIds).catch(() => {});
    }
    return order;
  } catch (err) {
    await restoreYarnStockForBundle(decrementedYarnProductIds).catch(() => {});
    throw err;
  }
}

async function buildMarketCart(rawItems) {
  const seen = new Set();
  const orderItems = [];
  const productReservationItems = [];
  const yarnProductIds = [];

  for (const rawItem of rawItems) {
    const type = rawItem.type === 'yarn' || rawItem.yarnProductId ? 'yarn' : 'product';
    const hasCustomPrice = rawItem.salePrice !== undefined && rawItem.salePrice !== null && rawItem.salePrice !== '';
    const itemSalePrice = hasCustomPrice ? parseMoney(rawItem.salePrice, null) : null;
    if (hasCustomPrice && itemSalePrice === null) {
      const err = new Error('Prix de ligne invalide');
      err.statusCode = 400;
      throw err;
    }

    if (type === 'yarn') {
      const yarnProductId = Number(rawItem.yarnProductId || rawItem.id);
      const key = `yarn:${yarnProductId}`;
      if (!Number.isInteger(yarnProductId) || yarnProductId <= 0 || seen.has(key)) continue;
      seen.add(key);

      const yarn = await prisma.yarnProduct.findUnique({
        where: { id: yarnProductId },
        include: yarnInclude,
      });
      const unavailable = ensureSellableYarn(yarn);
      if (unavailable) {
        const err = new Error(`${yarn?.name || `Laine ${yarnProductId}`}: ${unavailable}`);
        err.statusCode = 409;
        throw err;
      }
      orderItems.push(orderItemForYarn(yarn, { salePrice: itemSalePrice }));
      yarnProductIds.push(yarn.id);
      continue;
    }

    const productId = Number(rawItem.productId || rawItem.id);
    const productVariantId = rawItem.productVariantId ? Number(rawItem.productVariantId) : null;
    const key = `product:${productId}:${productVariantId || ''}`;
    if (!Number.isInteger(productId) || productId <= 0 || seen.has(key)) continue;
    seen.add(key);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    const variant = resolveSellableVariant(product, productVariantId);
    const unavailable = ensureSellableProduct(product, variant, { allowDraft: true });
    if (unavailable) {
      const err = new Error(`${product?.name || `Produit ${productId}`}: ${unavailable}`);
      err.statusCode = 409;
      throw err;
    }
    orderItems.push(orderItemForProduct(product, variant, { salePrice: itemSalePrice }));
    productReservationItems.push({ productId, productVariantId, quantity: 1 });
  }

  return { orderItems, productReservationItems, yarnProductIds };
}

function stripeLineItemForOrderItem(item, lang = 'en') {
  const en = isEnglish(lang);
  return {
    price_data: {
      currency: 'cad',
      product_data: {
        name: item.variantLabelSnapshot ? `${item.productName} - ${en ? 'Variant' : 'Variation'} ${item.variantLabelSnapshot}` : item.productName,
        ...(item.productImageUrl ? { images: [item.productImageUrl] } : {}),
      },
      unit_amount: Math.round(Number(item.unitPrice) * 100),
    },
    quantity: Number(item.quantity) || 1,
  };
}

async function sendMarketCartPaymentLinkEmail({ to, customerName, order, checkoutUrl, expiresInMinutes, lang = 'en' }) {
  const en = isEnglish(lang);
  const name = String(customerName || '').trim() || (en ? 'Hello' : 'Bonjour');
  const expiresText = expiresInMinutes >= 60 && expiresInMinutes % 60 === 0
    ? `${expiresInMinutes / 60} ${en ? 'hours' : 'heures'}`
    : `${expiresInMinutes} ${en ? 'minutes' : 'minutes'}`;
  const itemLines = (order.items || [])
    .map((item) => `- ${item.variantLabelSnapshot ? `${item.productName} (${item.variantLabelSnapshot})` : item.productName}: ${Number(item.subtotal).toFixed(2)} $ CAD`)
    .join('\n');

  await sendEmail({
    to,
    profile: 'system',
    lang,
    subject: en ? `Payment link - ${Number(order.total).toFixed(2)} $ CAD` : `Lien de paiement - ${Number(order.total).toFixed(2)} $ CAD`,
    text: en ? [
      `${name},`,
      '',
      'Here is your payment link.',
      itemLines,
      Number(order.shippingTotal || 0) > 0 ? `Shipping: ${Number(order.shippingTotal).toFixed(2)} $ CAD` : null,
      `Total: ${Number(order.total).toFixed(2)} $ CAD`,
      `The link expires in ${expiresText}.`,
      '',
      checkoutUrl,
      '',
      'Items will only be marked as sold after the payment is confirmed.',
    ].filter(Boolean).join('\n') : [
      `${name},`,
      '',
      'Voici votre lien de paiement.',
      itemLines,
      Number(order.shippingTotal || 0) > 0 ? `Livraison: ${Number(order.shippingTotal).toFixed(2)} $ CAD` : null,
      `Total: ${Number(order.total).toFixed(2)} $ CAD`,
      `Le lien expire dans ${expiresText}.`,
      '',
      checkoutUrl,
      '',
      'Les articles seront marqués comme vendus seulement après le paiement confirmé.',
    ].filter(Boolean).join('\n'),
    html: emailHtml({
      lang,
      title: en ? 'Payment link' : 'Lien de paiement',
      recipientEmail: to,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content: [
        `<p style="margin:0 0 16px;">${emailEscape(name)},</p>`,
        `<p style="margin:0 0 16px;">${en ? 'Here is your payment link.' : 'Voici votre lien de paiement.'}</p>`,
        emailBox(en
          ? `Total: <strong>${Number(order.total).toFixed(2)} $ CAD</strong>${Number(order.shippingTotal || 0) > 0 ? `<br>Shipping included: ${Number(order.shippingTotal).toFixed(2)} $` : ''}<br>Items will only be marked as sold after the payment is confirmed.`
          : `Total: <strong>${Number(order.total).toFixed(2)} $ CAD</strong>${Number(order.shippingTotal || 0) > 0 ? `<br>Livraison incluse: ${Number(order.shippingTotal).toFixed(2)} $` : ''}<br>Les articles seront marqués comme vendus seulement après le paiement confirmé.`),
        emailButton(en ? 'Pay now' : 'Payer maintenant', checkoutUrl),
        `<p style="margin:0;color:#8A7A6A;font-size:14px;">${en ? `This link expires in ${expiresText}.` : `Ce lien expire dans ${expiresText}.`}</p>`,
      ].join(''),
    }),
  });
}

async function sendProductPaymentLinkEmail({ to, customerName, product, item, checkoutUrl, shippingTotal, expiresInMinutes, lang = 'en' }) {
  const en = isEnglish(lang);
  const name = String(customerName || '').trim() || (en ? 'Hello' : 'Bonjour');
  const variantText = item.variantLabelSnapshot ? ` (${item.variantLabelSnapshot})` : '';
  const total = Number(item.subtotal) + Number(shippingTotal || 0);
  const expiresText = expiresInMinutes >= 60 && expiresInMinutes % 60 === 0
    ? `${expiresInMinutes / 60} ${en ? 'hours' : 'heures'}`
    : `${expiresInMinutes} ${en ? 'minutes' : 'minutes'}`;
  const title = en ? 'Payment link' : 'Lien de paiement';
  const text = en ? [
    `${name},`,
    '',
    `Here is the link to pay for ${product.name}${variantText}.`,
    `Total: ${total.toFixed(2)} $ CAD${Number(shippingTotal || 0) > 0 ? `, including ${Number(shippingTotal).toFixed(2)} $ shipping.` : '.'}`,
    `The link expires in ${expiresText}.`,
    '',
    checkoutUrl,
    '',
    'The product will only be marked as sold after the payment is confirmed.',
  ].join('\n') : [
    `${name},`,
    '',
    `Voici le lien pour payer ${product.name}${variantText}.`,
    `Total: ${total.toFixed(2)} $ CAD${Number(shippingTotal || 0) > 0 ? `, incluant ${Number(shippingTotal).toFixed(2)} $ de livraison.` : '.'}`,
    `Le lien expire dans ${expiresText}.`,
    '',
    checkoutUrl,
    '',
    'Le produit sera marqué comme vendu seulement après le paiement confirmé.',
  ].join('\n');

  await sendEmail({
    to,
    profile: 'system',
    lang,
    subject: en ? `${product.name} - payment link` : `${product.name} - lien de paiement`,
    text,
    html: emailHtml({
      lang,
      title,
      recipientEmail: to,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content: [
        `<p style="margin:0 0 16px;">${emailEscape(name)},</p>`,
        `<p style="margin:0 0 16px;">${en ? 'Here is the link to pay for' : 'Voici le lien pour payer'} <strong>${emailEscape(product.name)}${emailEscape(variantText)}</strong>.</p>`,
        emailBox(en
          ? `Total: <strong>${total.toFixed(2)} $ CAD</strong>${Number(shippingTotal || 0) > 0 ? `<br>Shipping included: ${Number(shippingTotal).toFixed(2)} $` : ''}<br>The product will only be marked as sold after the payment is confirmed.`
          : `Total: <strong>${total.toFixed(2)} $ CAD</strong>${Number(shippingTotal || 0) > 0 ? `<br>Livraison incluse: ${Number(shippingTotal).toFixed(2)} $` : ''}<br>Le produit sera marqué comme vendu seulement après le paiement confirmé.`),
        emailButton(en ? 'Pay now' : 'Payer maintenant', checkoutUrl),
        `<p style="margin:0;color:#8A7A6A;font-size:14px;">${en ? `This link expires in ${expiresText}.` : `Ce lien expire dans ${expiresText}.`}</p>`,
      ].join(''),
    }),
  });
}

router.get('/', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: products.map(serializeAdminProduct) });
  } catch (err) {
    next(err);
  }
});

router.post('/terminal/connection-token', async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ success: true, data: { secret: token.secret } });
  } catch (err) {
    next(err);
  }
});

router.get('/terminal/config', async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }
    if (!process.env.STRIPE_TERMINAL_LOCATION_ID) {
      return res.status(500).json({
        success: false,
        message: 'STRIPE_TERMINAL_LOCATION_ID manquant. Crée une Location Stripe Terminal puis ajoute son ID dans le .env.',
      });
    }

    try {
      await stripe.terminal.locations.retrieve(process.env.STRIPE_TERMINAL_LOCATION_ID);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `Location Stripe Terminal introuvable pour la clé Stripe active. Vérifie que STRIPE_SECRET_KEY et STRIPE_TERMINAL_LOCATION_ID sont dans le même mode test/live. Détail: ${err.message}`,
      });
    }

    res.json({
      success: true,
      data: {
        locationId: process.env.STRIPE_TERMINAL_LOCATION_ID,
        merchantDisplayName: process.env.STRIPE_TERMINAL_MERCHANT_NAME || 'Itsgenygarts',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: productInclude,
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: serializeAdminProduct(product) });
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
    if (!orderId) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    if (paymentIntent.status === 'succeeded') {
      const hasMarketCartYarn = parseYarnProductIdsFromStripe(paymentIntent).length > 0;
      const order = hasMarketCartYarn
        ? await markMarketCartOrderPaid(paymentIntent, 'terminal.market-cart.tap-to-pay.sync')
        : await markRegularOrderPaid(
          prisma,
          orderId,
          paymentIntent,
          'terminal.tap-to-pay.sync',
          { allowDraft: paymentSourceAllowsDraftProduct(paymentIntent) },
        );
      const email = normalizeEmail(order?.customerEmail);
      if (isEmailLike(email) && !email.endsWith('@pos.local')) {
        await applyNewsletterConsent(prisma, {
          email,
          name: order.customerName,
          consent: true,
        });
      }
      return res.json({ success: true, data: { status: paymentIntent.status, order } });
    }

    res.json({ success: true, data: { status: paymentIntent.status, order: null } });
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

    if (paymentIntent.status !== 'succeeded') {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      if (orderId) await discardPendingOrder(orderId).catch(() => {});
    }

    res.json({ success: true, data: { status: paymentIntent.status, orderId: orderId ? Number(orderId) : null } });
  } catch (err) {
    next(err);
  }
});

router.post('/market-bundle-sale', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article dans la caisse.' });
    }

    const paymentMethod = String(req.body.paymentMethod || 'MANUAL').toUpperCase();
    const customerName = req.body.customerName?.trim() || `Caisse marché (${paymentMethod})`;
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `market-bundle-${Date.now()}@pos.local`;

    let cart;
    try {
      cart = await buildMarketCart(rawItems);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
    const { orderItems, productReservationItems, yarnProductIds } = cart;

    if (orderItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article valide dans la caisse.' });
    }

    const { order, items } = await createBundleProductOrder(orderItems, {
      status: 'PENDING',
      customerName,
      customerEmail,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerLanguage,
    });

    let decrementedYarnProductIds = [];
    try {
      if (productReservationItems.length) {
        await reserveStockForOrder(order.id, productReservationItems, { allowDraft: true });
      }
      decrementedYarnProductIds = await decrementYarnStockForBundle(yarnProductIds);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          stripePaymentId: `market-bundle-${paymentMethod.toLowerCase()}-${order.id}`,
          paidAt: new Date(),
        },
      });
      if (productReservationItems.length) {
        await commitStockForOrder(order.id);
      }
    } catch (stockErr) {
      await restoreYarnStockForBundle(decrementedYarnProductIds).catch(() => {});
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
    await expireConflictingPendingPaymentLinks(
      prisma,
      stripe,
      (paidOrder?.items || items).filter((item) => item.productId),
      { excludeOrderId: order.id },
    );
    res.status(201).json({ success: true, data: paidOrder });
  } catch (err) {
    next(err);
  }
});

router.post('/market-cart/tap-to-pay-intent', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article dans la caisse.' });
    }

    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }

    let cart;
    try {
      cart = await buildMarketCart(rawItems);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    if (cart.orderItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article valide dans la caisse.' });
    }

    const { order, items } = await createBundleProductOrder(cart.orderItems, {
      status: 'PENDING',
      customerName: req.body.customerName?.trim() || 'Vente Tap to Pay',
      customerEmail: rawCustomerEmail ? normalizedCustomerEmail : `tap-to-pay-cart-${Date.now()}@pos.local`,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerLanguage,
    });

    try {
      if (cart.productReservationItems.length) {
        await reserveStockForOrder(order.id, cart.productReservationItems, { allowDraft: true });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100),
        currency: 'cad',
        payment_method_types: ['card_present', 'interac_present'],
        capture_method: 'automatic',
        description: `Tap to Pay - caisse marché #${order.id}`,
        metadata: {
          orderId: String(order.id),
          source: 'admin-market-cart-tap-to-pay',
          yarnProductIds: JSON.stringify(cart.yarnProductIds),
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentId: paymentIntent.id },
      });
      await expireConflictingPendingPaymentLinks(prisma, stripe, items.filter((item) => item.productId), { excludeOrderId: order.id });

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

router.post('/market-cart/payment-link', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article dans la caisse.' });
    }

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
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `market-payment-link-${Date.now()}@pos.local`;

    let cart;
    try {
      cart = await buildMarketCart(rawItems);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    if (cart.orderItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article valide dans la caisse.' });
    }

    const { order, items } = await createBundleProductOrder(cart.orderItems, {
      status: 'PENDING',
      shippingTotal,
      customerName,
      customerEmail,
      customerLanguage,
    });

    try {
      const lineItems = items.map((item) => stripeLineItemForOrderItem(item, customerLanguage));
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
      const metadata = {
        orderId: String(order.id),
        source: 'admin-market-cart-payment-link',
        yarnProductIds: JSON.stringify(cart.yarnProductIds),
      };
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        invoice_creation: { enabled: true },
        ...(rawCustomerEmail ? { customer_email: normalizedCustomerEmail } : {}),
        phone_number_collection: { enabled: true },
        shipping_address_collection: { allowed_countries: ['CA', 'US'] },
        metadata,
        payment_intent_data: { metadata },
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

        sendMarketCartPaymentLinkEmail({
          to: normalizedCustomerEmail,
          customerName,
          order: { ...order, items },
          checkoutUrl: session.url,
          expiresInMinutes: ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES,
          lang: customerLanguage,
        }).catch((emailErr) => {
          console.error(`Failed to send market cart payment link email for order #${order.id}:`, emailErr.message);
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

router.post('/market-cart/payment-qr', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article dans la caisse.' });
    }

    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }
    const customerName = String(req.body.customerName || '').trim() || 'Client QR marché';
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `market-qr-${Date.now()}@pos.local`;

    let cart;
    try {
      cart = await buildMarketCart(rawItems);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }

    if (cart.orderItems.length < 1) {
      return res.status(400).json({ success: false, message: 'Ajoute au moins un article valide dans la caisse.' });
    }

    const { order, items } = await createBundleProductOrder(cart.orderItems, {
      status: 'PENDING',
      shippingTotal: 0,
      customerName,
      customerEmail,
      customerLanguage,
    });

    try {
      const frontendUrl = getConfiguredFrontendUrl();
      const metadata = {
        orderId: String(order.id),
        source: 'admin-market-cart-payment-qr',
        yarnProductIds: JSON.stringify(cart.yarnProductIds),
      };
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: items.map((item) => stripeLineItemForOrderItem(item, customerLanguage)),
        invoice_creation: { enabled: true },
        ...(rawCustomerEmail ? { customer_email: normalizedCustomerEmail } : {}),
        phone_number_collection: { enabled: true },
        metadata,
        payment_intent_data: { metadata },
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

        sendMarketCartPaymentLinkEmail({
          to: normalizedCustomerEmail,
          customerName,
          order: { ...order, items },
          checkoutUrl: session.url,
          expiresInMinutes: ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES,
          lang: customerLanguage,
        }).catch((emailErr) => {
          console.error(`Failed to send market QR payment email for order #${order.id}:`, emailErr.message);
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

router.post('/:id/market-sale', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    const productId = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    const variant = resolveSellableVariant(product, req.body.productVariantId);
    const unavailable = ensureSellableProduct(product, variant, { allowDraft: true });
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });

    const paymentMethod = String(req.body.paymentMethod || 'MANUAL').toUpperCase();
    const customerName = req.body.customerName?.trim() || `Vente marché (${paymentMethod})`;
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `market-sale-${Date.now()}@pos.local`;
    const salePrice = parseMoney(req.body.salePrice, product.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }

    const { order, item } = await createSingleProductOrder(product, variant, {
      status: 'PENDING',
      customerName,
      customerEmail,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
      salePrice,
      customerLanguage,
    });

    try {
      await reserveStockForOrder(
        order.id,
        [{ productId: item.productId, productVariantId: item.productVariantId, quantity: 1 }],
        { allowDraft: true },
      );
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          stripePaymentId: `market-${paymentMethod.toLowerCase()}-${order.id}`,
          paidAt: new Date(),
        },
      });
      await commitStockForOrder(order.id);
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
    await expireConflictingPendingPaymentLinks(prisma, stripe, paidOrder?.items || [item], { excludeOrderId: order.id });
    res.status(201).json({ success: true, data: paidOrder });
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

    const productId = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    const variant = resolveSellableVariant(product, req.body.productVariantId);
    const unavailable = ensureSellableProduct(product, variant, { allowDraft: true });
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });
    const salePrice = parseMoney(req.body.salePrice, product.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }
    const rawCustomerEmail = String(req.body.customerEmail || '').trim();
    const normalizedCustomerEmail = normalizeEmail(rawCustomerEmail);
    if (rawCustomerEmail && !isEmailLike(normalizedCustomerEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse courriel client invalide.' });
    }

    const { order, item } = await createSingleProductOrder(product, variant, {
      status: 'PENDING',
      customerName: req.body.customerName?.trim() || 'Vente Tap to Pay',
      customerEmail: rawCustomerEmail ? normalizedCustomerEmail : `tap-to-pay-${Date.now()}@pos.local`,
      customerPhone: req.body.customerPhone?.trim() || null,
      customerAddress: 'Vente en personne',
      customerCity: 'Marché',
      customerPostalCode: 'POS',
      customerCountry: 'CA',
      salePrice,
      customerLanguage,
    });

    try {
      await reserveStockForOrder(
        order.id,
        [{ productId: item.productId, productVariantId: item.productVariantId, quantity: 1 }],
        { allowDraft: true },
      );
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100),
        currency: 'cad',
        payment_method_types: ['card_present', 'interac_present'],
        capture_method: 'automatic',
        description: item.variantLabelSnapshot ? `Tap to Pay - ${item.productName} (${item.variantLabelSnapshot})` : `Tap to Pay - ${item.productName}`,
        metadata: {
          orderId: String(order.id),
          source: 'admin-tap-to-pay',
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentId: paymentIntent.id },
      });
      await expireConflictingPendingPaymentLinks(prisma, stripe, order.items || [item], { excludeOrderId: order.id });

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

router.post('/:id/payment-link', async (req, res, next) => {
  try {
    const customerLanguage = await languageForEmail(prisma, req.body.customerEmail, req);
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const productId = Number(req.params.id);
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
    const customerEmail = rawCustomerEmail ? normalizedCustomerEmail : `product-payment-link-${Date.now()}@pos.local`;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    const variant = resolveSellableVariant(product, req.body.productVariantId);
    const unavailable = ensureSellableProduct(product, variant, { allowDraft: true });
    if (unavailable) return res.status(409).json({ success: false, message: unavailable });
    const salePrice = parseMoney(req.body.salePrice, product.price);
    if (salePrice === null) {
      return res.status(400).json({ success: false, message: 'Prix de vente invalide' });
    }

    const { order, item } = await createSingleProductOrder(product, variant, {
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
            name: item.variantLabelSnapshot ? `${item.productName} - ${isEnglish(customerLanguage) ? 'Variant' : 'Variation'} ${item.variantLabelSnapshot}` : item.productName,
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
          source: 'admin-payment-link',
        },
        payment_intent_data: {
          metadata: {
            orderId: String(order.id),
            source: 'admin-payment-link',
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

        sendProductPaymentLinkEmail({
          to: normalizedCustomerEmail,
          customerName,
          product,
          item,
          checkoutUrl: session.url,
          shippingTotal,
          expiresInMinutes: ADMIN_PAYMENT_LINK_EXPIRATION_MINUTES,
          lang: customerLanguage,
        }).catch((emailErr) => {
          console.error(`Failed to send product payment link email for order #${order.id}:`, emailErr.message);
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

router.post('/', async (req, res, next) => {
  try {
    const { price, stockQuantity, categoryId, soldOut, isDraft, isFeatured, isReference, showSoldVariants } = req.body;
    if (showSoldVariants !== undefined && typeof showSoldVariants !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Affichage des variations vendues invalide.' });
    }
    const bilingual = bilingualData(req.body);
    const details = productDetailsFromBody(req.body);
    if (details.error) return res.status(400).json({ success: false, message: details.error });
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const packaged = packagedDimensionsFromBody(req.body, { required: isDraft !== true });
    if (packaged.error) return res.status(400).json({ success: false, message: packaged.error });
    const customs = customsFieldsFromBody(req.body, { kind: 'product' });
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
      if (!cat) return res.status(400).json({ success: false, message: 'Category not found' });
    }
    const qty = stockQuantity !== undefined ? Number(stockQuantity) : 0;
    const variantColors = parseVariantColors(req.body.variantColors);
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...bilingual,
          ...details.data,
          price: Number(price),
          stockQuantity: qty,
          soldOut: soldOutFromStock(qty, soldOut),
          showSoldVariants: qty > 0 ? false : showSoldVariants,
          isDraft: isDraft ?? false,
          categoryId: categoryId ? Number(categoryId) : null,
          isFeatured: isFeatured ?? false,
          isReference: isReference ?? false,
          ...packaged.data,
          ...customs.data,
        },
      });
      await syncProductVariants(tx, created.id, qty);
      await saveVariantColors(tx, created.id, variantColors);
      return tx.product.findUnique({ where: { id: created.id }, include: productInclude });
    });
    res.status(201).json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
});

async function updateProduct(req, res, next) {
  try {
    const { price, stockQuantity, categoryId, soldOut, isDraft, isFeatured, isReference, showSoldVariants } = req.body;
    if (showSoldVariants !== undefined && typeof showSoldVariants !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Affichage des variations vendues invalide.' });
    }
    const bilingual = bilingualData(req.body);
    const details = productDetailsFromBody(req.body);
    if (details.error) return res.status(400).json({ success: false, message: details.error });
    if (!bilingual.name) return res.status(400).json({ success: false, message: 'Le nom français ou anglais est requis.' });
    const packaged = packagedDimensionsFromBody(req.body, { required: isDraft === false });
    if (packaged.error) return res.status(400).json({ success: false, message: packaged.error });
    const customs = customsFieldsFromBody(req.body, { kind: 'product' });
    if (customs.error) return res.status(400).json({ success: false, message: customs.error });
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
      if (!cat) return res.status(400).json({ success: false, message: 'Category not found' });
    }
    const qty = stockQuantity !== undefined ? Number(stockQuantity) : undefined;
    const variantColors = parseVariantColors(req.body.variantColors);
    const productId = Number(req.params.id);
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: selectProductChanges({
          ...bilingual,
          ...details.data,
          price: Number(price),
          stockQuantity: qty,
          soldOut: soldOutFromStock(qty, soldOut),
          showSoldVariants: qty > 0 ? false : showSoldVariants,
          isDraft: isDraft ?? undefined,
          categoryId: categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : undefined,
          isFeatured: isFeatured ?? undefined,
          isReference: isReference ?? undefined,
          ...packaged.data,
          ...customs.data,
        }, req.autosaveFields),
      });
      if (qty !== undefined) await syncProductVariants(tx, productId, updated.stockQuantity);
      await saveVariantColors(tx, productId, variantColors);
      return tx.product.findUnique({ where: { id: productId }, include: productInclude });
    });
    await removeProductFromCustomerLists(prisma, product);
    res.json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
}

function selectProductChanges(data, fields) {
  return fields ? Object.fromEntries(Object.entries(data).filter(([key]) => fields.has(key))) : data;
}

router.put('/:id', updateProduct);

// Partial updates never resend images or unchanged inventory from an open form.
router.patch('/:id', async (req, res, next) => {
  try {
    const patch = req.body;
    const fields = new Set(Object.keys(patch));
    const allowed = new Set([
      'nameFr', 'nameEn', 'descriptionFr', 'descriptionEn', 'price', 'stockQuantity', 'variantColors',
      'categoryId', 'soldOut', 'showSoldVariants', 'isDraft', 'isFeatured',
      'packageWeightGrams', 'packageLengthCm', 'packageWidthCm', 'packageHeightCm',
      'customsProfileKey', 'customsDescription', 'customsHsCode', 'customsWeightGrams', 'customsOriginCountry',
      'sizeFitFr', 'sizeFitEn', 'materialsFr', 'materialsEn', 'careFr', 'careEn',
    ]);
    if (!fields.size || [...fields].some(key => !allowed.has(key))) {
      return res.status(400).json({ success: false, message: 'Champs de modification invalides.' });
    }
    if (!Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) <= 0) {
      return res.status(400).json({ success: false, message: 'Produit invalide.' });
    }
    if (fields.has('price') && (patch.price === null || patch.price === '' || !Number.isFinite(Number(patch.price)) || Number(patch.price) < 0)) {
      return res.status(400).json({ success: false, message: 'Prix invalide.' });
    }
    if (fields.has('stockQuantity') && (!Number.isInteger(patch.stockQuantity) || patch.stockQuantity < 0 || patch.stockQuantity > 26)) {
      return res.status(400).json({ success: false, message: 'Quantité invalide.' });
    }
    for (const key of ['soldOut', 'showSoldVariants', 'isDraft', 'isFeatured']) {
      if (fields.has(key) && typeof patch[key] !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
      }
    }
    const current = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!current) return res.status(404).json({ success: false, message: 'Product not found' });
    req.body = {
      nameFr: current.nameFr === undefined ? current.name : current.nameFr, nameEn: current.nameEn,
      descriptionFr: current.descriptionFr === undefined ? current.description : current.descriptionFr, descriptionEn: current.descriptionEn,
      price: current.price, ...patch,
    };
    if (fields.has('nameFr') || fields.has('nameEn')) fields.add('name');
    if (fields.has('descriptionFr') || fields.has('descriptionEn')) fields.add('description');
    if (fields.has('stockQuantity')) {
      fields.add('soldOut');
      if (patch.stockQuantity > 0) fields.add('showSoldVariants');
    }
    const measures = ['packageWeightGrams', 'packageLengthCm', 'packageWidthCm', 'packageHeightCm'];
    if (measures.some(key => fields.has(key)) || fields.has('customsWeightGrams') || patch.isDraft === false) {
      for (const key of measures) if (!fields.has(key)) req.body[key] = current[key];
      req.body.isDraft = patch.isDraft ?? current.isDraft;
    }
    // Validate weight against the other existing measure without rewriting it.
    if (fields.has('customsWeightGrams') || fields.has('packageWeightGrams')) {
      req.body.customsWeightGrams = fields.has('customsWeightGrams') ? patch.customsWeightGrams : current.customsWeightGrams;
      req.body.packageWeightGrams = fields.has('packageWeightGrams') ? patch.packageWeightGrams : current.packageWeightGrams;
    }
    if (fields.has('customsProfileKey')) {
      fields.add('customsDescription');
      fields.add('customsHsCode');
    }
    req.autosaveFields = fields;
    return updateProduct(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { images: true },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await Promise.all(product.images.filter((img) => img.publicId).map((img) => deleteImage(img.publicId)));
    await prisma.cartItem.deleteMany({ where: { productId: product.id } });
    await prisma.favoriteItem.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const stock = Number(req.body.stock);
    const productId = Number(req.params.id);
    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: stock, soldOut: stock <= 0, ...(stock > 0 ? { showSoldVariants: false } : {}) },
      });
      await syncProductVariants(tx, productId, stock);
      return tx.product.findUnique({ where: { id: productId }, include: productInclude });
    });
    await removeProductFromCustomerLists(prisma, product);
    res.json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const { existingImageUrl, variantId } = req.body;

    if (!req.file && !existingImageUrl) {
      return res.status(400).json({ success: false, message: 'No file or image URL provided' });
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, variants: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    const parsedVariantId = variantId ? Number(variantId) : null;
    if (parsedVariantId) {
      const validVariant = existing.variants.find((variant) => variant.id === parsedVariantId);
      if (!validVariant) {
        return res.status(400).json({ success: false, message: 'Variation invalide pour ce produit' });
      }
    }

    let imageUrl, publicId;
    if (req.file) {
      const image = await normalizeUploadedImage(req.file, { allowPhonePhotos: true });
      const result = await uploadImage(image.buffer);
      imageUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      imageUrl = existingImageUrl;
      publicId = '';
    }

    const nextOrder = existing.images.length > 0 ? Math.max(...existing.images.map(i => i.order)) + 1 : 0;

    await prisma.productImage.create({
      data: {
        productId,
        variantId: parsedVariantId,
        imageUrl,
        publicId,
        order: nextOrder,
      },
    });

    // Presentation photos take priority over variation photos.
    const mainImageUrl = primaryProductImageUrl({
      ...existing,
      images: [...existing.images, { imageUrl, variantId: parsedVariantId, order: nextOrder }],
    }) || imageUrl;
    if (mainImageUrl !== existing.mainImageUrl) {
      await prisma.product.update({
        where: { id: productId },
        data: { mainImageUrl },
      });
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, include: productInclude });
    res.status(201).json({ success: true, data: serializeAdminProduct(product) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/images/order', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const { imageIds } = req.body;
    if (!Number.isInteger(productId) || productId <= 0 || !Array.isArray(imageIds) || !imageIds.length
      || imageIds.some(id => !Number.isInteger(id) || id <= 0) || new Set(imageIds).size !== imageIds.length) {
      return res.status(400).json({ success: false, message: 'Ordre des photos invalide.' });
    }
    const result = await prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id: productId }, include: productInclude });
      if (!product || product.isDeleted) return { status: 404, message: 'Produit introuvable.' };
      const byId = new Map(product.images.map(image => [image.id, image]));
      if (imageIds.length !== byId.size || imageIds.some(id => !byId.has(id))) {
        return { status: 409, message: 'Les photos ont changé. Recharge le produit avant de les déplacer.' };
      }
      const updates = await Promise.all(imageIds.map((id, order) => tx.productImage.updateMany({
        where: { id, productId }, data: { order },
      })));
      if (updates.some(update => update.count !== 1)) {
        throw Object.assign(new Error('Les photos ont changé. Recharge le produit avant de les déplacer.'), { statusCode: 409 });
      }
      const images = imageIds.map((id, order) => ({ ...byId.get(id), order }));
      await tx.product.update({ where: { id: productId }, data: { mainImageUrl: primaryProductImageUrl({ ...product, images }) } });
      return { product: await tx.product.findUnique({ where: { id: productId }, include: productInclude }) };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    res.json({ success: true, data: serializeAdminProduct(result.product) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/images/:imageId', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

    if (image.publicId) await deleteImage(image.publicId);
    await prisma.productImage.delete({ where: { id: imageId } });

    // If deleted image was the main image, set next available or null
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { order: 'asc' } }, variants: true },
    });
    if (product.mainImageUrl === image.imageUrl) {
      await prisma.product.update({
        where: { id: productId },
        data: { mainImageUrl: primaryProductImageUrl({ ...product, mainImageUrl: null }) || product.images[0]?.imageUrl || null },
      });
    }

    const updated = await prisma.product.findUnique({ where: { id: productId }, include: productInclude });
    res.json({ success: true, data: serializeAdminProduct(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
