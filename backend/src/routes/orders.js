import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { actionLimiter, shippingQuoteLimiter } from '../middleware/rateLimit.js';
import { releaseStockForOrder, reserveStockForOrder, RESERVATION_MINUTES } from '../services/stock.js';
import { discardPendingOrder } from '../services/pendingOrders.js';
import { markRegularOrderPaid } from '../services/regularOrderPayment.js';
import { expireConflictingPendingPaymentLinks } from '../services/paymentLinkAvailability.js';
import { generateInvoicePDF, invoiceNumber } from '../services/invoice.js';
import { getStripeInvoiceData } from '../services/stripeInvoice.js';
import { getStorefrontUrl } from '../utils/frontendUrl.js';
import { formatPhoneForCountry } from '../utils/phone.js';
import { isEnglish, languageFromRequest } from '../utils/language.js';
import { canDownloadInvoice, verifyOrderInvoiceToken } from '../utils/orderInvoiceToken.js';
import { quoteShipping } from '../services/shipping.js';
import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';
import { importFeesPolicy, isInternationalDestination } from '../utils/importFeesPolicy.js';

const router = Router();
const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function createCancelToken(orderId) {
  return jwt.sign(
    { type: 'order-cancel', orderId: Number(orderId) },
    process.env.JWT_SECRET,
    { expiresIn: `${RESERVATION_MINUTES}m` },
  );
}

function verifyCancelToken(token) {
  const decoded = jwt.verify(String(token || ''), process.env.JWT_SECRET);
  if (decoded?.type !== 'order-cancel' || !Number.isInteger(Number(decoded.orderId))) {
    throw new Error('Invalid cancel token');
  }
  return Number(decoded.orderId);
}

// ── Public routes ────────────────────────────────────────────────────────────

router.get('/currencies', async (req, res, next) => {
  try {
    const currencies = await prisma.currencyRate.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    res.json({ success: true, data: currencies });
  } catch (err) { next(err); }
});

router.post('/calculate-shipping', shippingQuoteLimiter, async (req, res, next) => {
  try {
    const {
      items, name, email, phone, address, city, country, province, postalCode,
    } = req.body;
    assertShippingDestinationAllowed(country, languageFromRequest(req));
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items required' });
    }

    const productIds = items.map((i) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isDeleted: false, isDraft: false },
      include: {
        category: true,
        variants: {
          where: { status: { not: 'SOLD' } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { images: { orderBy: { order: 'asc' } } },
        },
      },
    });
    const result = await quoteShipping({
      items,
      products,
      destination: {
        name, email, phone, address, city, country, province, postalCode,
      },
      language: languageFromRequest(req),
    });
    const preferred = result.options.find((option) => option.trackingIncluded) || result.options[0];
    res.json({
      success: true,
      data: {
        ...result,
        importFeesPolicy: isInternationalDestination(country) ? importFeesPolicy(languageFromRequest(req)) : null,
        shippingTotal: preferred?.amountCad ?? null,
        defaultServiceCode: preferred?.serviceCode ?? null,
      },
    });
  } catch (err) { next(err); }
});

router.get('/:id/invoice', async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const tokenData = verifyOrderInvoiceToken(req.query.token, orderId);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || String(order.customerEmail || '').trim().toLowerCase() !== tokenData.email) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    if (!canDownloadInvoice(order)) {
      return res.status(400).json({ success: false, message: 'Facture disponible uniquement pour les commandes payées' });
    }

    let stripeInvoiceData = null;
    try {
      stripeInvoiceData = await getStripeInvoiceData(order);
    } catch (stripeErr) {
      console.error(`Failed to fetch Stripe invoice data for order #${order.id}:`, stripeErr.message);
    }

    const pdf = await generateInvoicePDF(order, stripeInvoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber(order)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.message === 'Invalid invoice token') {
      return res.status(400).json({ success: false, message: 'Lien de facture invalide ou expiré' });
    }
    next(err);
  }
});

// ── Checkout: create order + Stripe session ──────────────────────────────────

router.post('/checkout', actionLimiter, async (req, res, next) => {
  try {
    const {
      items, currency,
      customerName, customerEmail, customerPhone,
      customerAddress, customerCity, customerProvince,
      customerPostalCode, customerCountry,
      shippingServiceCode,
      importFeesAccepted, importFeesPolicyVersion,
    } = req.body;
    const customerLanguage = languageFromRequest(req);
    const en = isEnglish(customerLanguage);
    assertShippingDestinationAllowed(customerCountry, customerLanguage);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
    if (!customerName || !customerEmail || !customerAddress || !customerCity || !customerPostalCode || !customerCountry) {
      return res.status(400).json({ success: false, message: 'Customer info required' });
    }

    const policy = isInternationalDestination(customerCountry) ? importFeesPolicy(customerLanguage) : null;
    if (policy && (importFeesAccepted !== true || importFeesPolicyVersion !== policy.version)) {
      return res.status(400).json({
        success: false,
        message: en
          ? 'Please read and accept the current import fees notice before paying.'
          : 'Veuillez lire et accepter l\'avertissement actuel sur les frais d\'importation avant de payer.',
      });
    }

    // Currency conversion
    const currencyCode = (currency || 'CAD').toUpperCase();
    let exchangeRate = 1;
    if (currencyCode !== 'CAD') {
      const curr = await prisma.currencyRate.findUnique({ where: { code: currencyCode } });
      if (curr) exchangeRate = Number(curr.rate);
    }

    // Fetch products
    const productIds = items.map((i) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isDeleted: false, isDraft: false },
      include: {
        category: true,
        variants: {
          where: { status: { not: 'SOLD' } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { images: { orderBy: { order: 'asc' } } },
        },
      },
    });
    const productMap = {};
    for (const p of products) productMap[p.id] = p;

    // Basic presence check; true availability is enforced by reserveStockForOrder below (transactional, counts active reservations)
    for (const item of items) {
      const pid = Number(item.productId);
      if (!productMap[pid]) {
        return res.status(400).json({ success: false, message: `Produit introuvable (ID ${pid})` });
      }
    }

    const shippingQuote = await quoteShipping({
      items,
      products,
      destination: {
        name: customerName,
        address: customerAddress,
        city: customerCity,
        country: customerCountry,
        province: customerProvince,
        postalCode: customerPostalCode,
        phone: customerPhone,
        email: customerEmail,
      },
      language: customerLanguage,
    });
    const selectedShipping = shippingQuote.options.find((option) => option.serviceCode === shippingServiceCode)
      || (!shippingServiceCode ? shippingQuote.options.find((option) => option.trackingIncluded) || shippingQuote.options[0] : null);
    if (!selectedShipping) {
      return res.status(400).json({ success: false, message: 'L’option de livraison sélectionnée n’est plus disponible.' });
    }

    // Build order items (converted to selected currency)
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const pid = Number(item.productId);
      const product = productMap[pid];
      if (!product) continue;

      const qty = 1;
      const variantId = item.productVariantId ? Number(item.productVariantId) : null;
      let variant = null;
      let variantLabel = null;
      let variantImageUrl = null;
      if (product.variants?.length) {
        variant = product.variants.find((v) => v.id === variantId && v.status === 'AVAILABLE');
        if (!variant) {
          return res.status(409).json({ success: false, message: `Variation indisponible pour "${product.name}"` });
        }
        const availableVariants = product.variants.filter((v) => v.status === 'AVAILABLE');
        const variantIndex = availableVariants.findIndex((v) => v.id === variant.id);
        variantLabel = availableVariants.length > 1 ? ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[variantIndex] || '') : null;
        variantImageUrl = variant.images?.[0]?.imageUrl || product.mainImageUrl;
      }
      const unitPrice = Math.round(Number(product.price) * exchangeRate * 100) / 100;
      const itemSubtotal = Math.round(unitPrice * qty * 100) / 100;

      subtotal += itemSubtotal;

      orderItems.push({
        productId: pid,
        productVariantId: variantId || null,
        productName: product.name,
        productImageUrl: variantImageUrl || product.mainImageUrl,
        variantLabelSnapshot: variantLabel,
        variantImageUrl,
        unitPrice,
        shippingPrice: 0,
        quantity: qty,
        subtotal: itemSubtotal,
      });
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products in cart' });
    }

    const shippingTotal = Math.round(selectedShipping.amountCad * exchangeRate * 100) / 100;
    const total = Math.round((subtotal + shippingTotal) * 100) / 100;
    const stripeCurrency = currencyCode.toLowerCase();

    // Create order in DB with PENDING status
    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        customerPhone: formatPhoneForCountry(customerPhone, customerCountry) || null,
        customerAddress,
        customerCity,
        customerProvince: customerProvince || null,
        customerPostalCode,
        customerCountry,
        customerLanguage,
        importFeesAcceptedAt: policy ? new Date() : null,
        importFeesPolicyVersion: policy?.version || null,
        importFeesPolicyLanguage: policy?.language || null,
        importFeesPolicyText: policy?.notice || null,
        currency: currencyCode,
        subtotal,
        shippingTotal,
        shippingProvider: selectedShipping.provider,
        shippingServiceCode: selectedShipping.serviceCode,
        shippingServiceName: selectedShipping.serviceName,
        shippingRateId: selectedShipping.rateId || null,
        shippingTrackingIncluded: selectedShipping.trackingIncluded,
        shippingEstimatedDays: selectedShipping.estimatedDays ? Math.round(selectedShipping.estimatedDays) : null,
        shippingPackage: shippingQuote.package || undefined,
        total,
        status: 'PENDING',
        items: { create: orderItems },
      },
      include: { items: true },
    });

    // Reserve stock (transactional, fails if another customer reserved it first)
    try {
      await reserveStockForOrder(order.id, orderItems.map((i) => ({ productId: i.productId, productVariantId: i.productVariantId, quantity: i.quantity })));
    } catch (stockErr) {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      return res.status(409).json({ success: false, message: stockErr.message });
    }

    // Create Stripe Checkout Session
    if (stripe) {
      const frontendUrl = getStorefrontUrl(req);
      const cancelToken = createCancelToken(order.id);

      // Build line items for Stripe
      const lineItems = orderItems.map((item) => ({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: item.variantLabelSnapshot ? `${item.productName} - ${en ? 'Variant' : 'Variation'} ${item.variantLabelSnapshot}` : item.productName,
            ...(item.productImageUrl ? { images: [item.productImageUrl] } : {}),
          },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      }));

      // Add shipping as a line item if > 0
      if (shippingTotal > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: { name: `${en ? 'Shipping' : 'Livraison'} - ${selectedShipping.serviceName}` },
            unit_amount: Math.round(shippingTotal * 100),
          },
          quantity: 1,
        });
      }

      const sessionParams = {
        mode: 'payment',
        customer_email: customerEmail,
        line_items: lineItems,
        invoice_creation: { enabled: true },
        metadata: {
          orderId: String(order.id),
          shippingServiceCode: selectedShipping.serviceCode,
        },
        payment_intent_data: {
          metadata: { orderId: String(order.id), shippingServiceCode: selectedShipping.serviceCode },
        },
        expires_at: Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60,
        success_url: `${frontendUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout?cancelled=true&cancel_token=${encodeURIComponent(cancelToken)}`,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);

      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      await expireConflictingPendingPaymentLinks(prisma, stripe, order.items, { excludeOrderId: order.id });

      return res.status(201).json({
        success: true,
        data: { order, checkoutUrl: session.url, cancelToken },
      });
    }

    // No Stripe configured
    res.status(201).json({
      success: true,
      data: { order, checkoutUrl: null },
    });
  } catch (err) { next(err); }
});

router.post('/cancel-pending', actionLimiter, async (req, res, next) => {
  try {
    let orderId;
    try {
      orderId = verifyCancelToken(req.body?.token);
    } catch {
      return res.status(400).json({ success: false, message: 'Lien d’annulation invalide ou expiré' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, stripeSessionId: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    if (order.status !== 'PENDING') {
      return res.json({ success: true, data: { cancelled: false, status: order.status } });
    }

    if (stripe?.checkout?.sessions && order.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      if (session.payment_status === 'paid') {
        return res.json({ success: true, data: { cancelled: false, status: 'PAID' } });
      }
      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(order.stripeSessionId).catch((err) => {
          console.error(`Failed to expire Stripe session ${order.stripeSessionId}:`, err.message);
        });
      }
    }

    const discarded = await discardPendingOrder(order.id);

    res.json({ success: true, data: { cancelled: discarded, discarded, status: discarded ? 'DISCARDED' : 'PENDING' } });
  } catch (err) { next(err); }
});

// ── Order lookup (for confirmation page) ─────────────────────────────────────

router.get('/by-session/:sessionId', async (req, res, next) => {
  try {
    let order = await prisma.order.findFirst({
      where: { stripeSessionId: req.params.sessionId },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (stripe && order.status === 'PENDING') {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      if (session.payment_status === 'paid') {
        await markRegularOrderPaid(prisma, order.id, session, 'checkout.session.lookup');
        order = await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: true },
        });
      } else if (session.status === 'expired') {
        await prisma.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await releaseStockForOrder(order.id);
        order = await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: true },
        });
      }
    }

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res) => {
  res.status(404).json({ success: false, message: 'Order not found' });
});

export default router;
