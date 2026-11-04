import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { requireAdmin } from '../../middleware/auth.js';
import { sendEmail } from '../../services/email.js';
import { emailBox, emailButton, emailHtml, emailTextBlock } from '../../utils/emailTemplate.js';
import { isEnglish, languageForEmail, languageOf } from '../../utils/language.js';
import { imageUpload, normalizeUploadedImage } from '../../utils/imageUpload.js';
import { uploadImage } from '../../services/cloudinary.js';
import { applyNewsletterConsent, isEmailLike, normalizeEmail } from '../../services/newsletterConsent.js';
import {
  customOrderFinancials,
  recordManualCustomOrderPayment,
  sendCustomPaymentReceipt,
  settleCustomOrderPayment,
  validatedCustomPaymentAmount,
} from '../../services/customOrderPayments.js';
import { notifyPaidCustomOrder } from '../../services/adminPushNotifications.js';
import {
  isNewCustomShippedTransition,
  sendCustomOrderShippedEmail,
} from '../../services/customOrderEmails.js';
import { protectPrivateMedia } from '../../utils/privateMedia.js';

const router = Router();
const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const upload = imageUpload({ files: 5, fileSize: 8 * 1024 * 1024 });

router.use(requireAdmin);

const ALLOWED_STATUSES = ['NEW', 'DISCUSSING', 'AWAITING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED'];

const orderInclude = {
  images: true,
  payments: { orderBy: { createdAt: 'asc' } },
  productReference: true,
  customModelOption: true,
};

function paymentKind(value, fallback = 'BALANCE') {
  const normalized = String(value || fallback).toUpperCase();
  return ['DEPOSIT', 'BALANCE', 'FULL'].includes(normalized) ? normalized : fallback;
}

function manualPaymentMethod(value) {
  const normalized = String(value || 'CASH').toUpperCase();
  return ['CASH', 'E_TRANSFER', 'STRIPE_MANUAL', 'OTHER'].includes(normalized) ? normalized : 'OTHER';
}

async function createCustomCheckoutSession(order, requestedAmount, kind = 'BALANCE') {
  if (!stripe) throw Object.assign(new Error('Stripe non configuré'), { statusCode: 500 });
  const amount = validatedCustomPaymentAmount(order, requestedAmount);
  const lang = languageOf(order);
  const en = isEnglish(lang);
  const payment = await prisma.customOrderPayment.create({
    data: {
      customOrderId: order.id,
      amount,
      kind: paymentKind(kind),
      method: 'STRIPE_LINK',
      status: 'PENDING',
    },
  });

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const metadata = {
      customOrderId: String(order.id),
      customOrderPaymentId: String(payment.id),
      customPaymentKind: payment.kind,
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.customerEmail,
      invoice_creation: { enabled: true },
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: payment.kind === 'DEPOSIT'
              ? `${en ? 'Deposit - custom order' : 'Dépôt - commande sur mesure'} #${order.id}`
              : `${en ? 'Custom order' : 'Commande sur mesure'} #${order.id}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${frontendUrl}/order-confirmation?type=custom&id=${order.id}`,
      cancel_url: `${frontendUrl}`,
    });

    await prisma.$transaction([
      prisma.customOrderPayment.update({
        where: { id: payment.id },
        data: { stripeSessionId: session.id },
      }),
      prisma.customOrder.update({
        where: { id: order.id },
        data: { status: 'AWAITING_PAYMENT', stripeSessionId: session.id },
      }),
    ]);
    return { amount, payment, session };
  } catch (err) {
    await prisma.customOrderPayment.delete({ where: { id: payment.id } }).catch(() => {});
    throw err;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.customOrder.findMany({
        skip,
        take: limit,
        orderBy: { createdAtUtc: 'desc' },
        include: orderInclude,
      }),
      prisma.customOrder.count(),
    ]);

    res.json({
      success: true,
      data: protectPrivateMedia(orders),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/market', upload.array('images', 5), async (req, res, next) => {
  try {
    const customerName = String(req.body.customerName || '').trim();
    const customerEmail = normalizeEmail(req.body.customerEmail);
    const category = String(req.body.category || '').trim() || 'Commande sur mesure';
    const description = String(req.body.description || '').trim();
    const price = Math.round(Number(req.body.price) * 100) / 100;

    if (!customerName) {
      return res.status(400).json({ success: false, message: 'Le nom du client est requis.' });
    }
    if (customerEmail && !isEmailLike(customerEmail)) {
      return res.status(400).json({ success: false, message: 'Le courriel client est invalide.' });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: 'Ajoute une description de la commande custom.' });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'Le prix total doit être supérieur à 0.' });
    }

    const requestedLanguage = String(req.body.customerLanguage || '').toLowerCase();
    const customerLanguage = ['fr', 'en'].includes(requestedLanguage)
      ? requestedLanguage
      : await languageForEmail(prisma, customerEmail, req);
    const uploadedImages = [];
    for (const file of req.files || []) {
      const normalized = await normalizeUploadedImage(file);
      const result = await uploadImage(normalized.buffer, 'custom-orders/market');
      uploadedImages.push({
        fileName: file.originalname || `custom-${Date.now()}`,
        contentType: normalized.mimetype,
        storagePathOrUrl: result.secure_url,
        purpose: 'REFERENCE',
      });
    }

    const order = await prisma.customOrder.create({
      data: {
        category,
        colorStyle: String(req.body.colorStyle || '').trim() || 'À définir',
        description,
        customerName,
        customerEmail,
        customerPhone: String(req.body.customerPhone || '').trim() || null,
        customerAddress: 'Vente en personne',
        customerCity: 'Marché',
        customerPostalCode: 'POS',
        customerCountry: 'CA',
        customerLanguage,
        status: 'NEW',
        source: 'MARKET',
        price,
        amountPaid: 0,
        paymentStatus: 'UNPAID',
        ...(uploadedImages.length ? { images: { create: uploadedImages } } : {}),
      },
      include: orderInclude,
    });

    if (customerEmail) {
      await applyNewsletterConsent(prisma, {
        email: customerEmail,
        name: customerName,
        consent: true,
      });
    }

    res.status(201).json({ success: true, data: protectPrivateMedia(order) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/market-payment', async (req, res, next) => {
  try {
    const result = await recordManualCustomOrderPayment(prisma, {
      customOrderId: req.params.id,
      amount: req.body.amount,
      kind: paymentKind(req.body.kind),
      method: manualPaymentMethod(req.body.method),
    });
    sendCustomPaymentReceipt(result.order, result.payment).catch((err) => {
      console.error(`Failed to send custom payment receipt for #${result.order.id}:`, err.message);
    });
    res.status(201).json({ success: true, data: protectPrivateMedia(result) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

router.post('/:id/tap-to-pay-intent', async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    const order = await prisma.customOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!order) return res.status(404).json({ success: false, message: 'Commande custom introuvable.' });
    const amount = validatedCustomPaymentAmount(order, req.body.amount);
    const kind = paymentKind(req.body.kind);
    const payment = await prisma.customOrderPayment.create({
      data: {
        customOrderId: order.id,
        amount,
        kind,
        method: 'TAP_TO_PAY',
        status: 'PENDING',
      },
    });

    try {
      const metadata = {
        customOrderId: String(order.id),
        customOrderPaymentId: String(payment.id),
        customPaymentKind: kind,
        source: 'admin-market-custom-tap-to-pay',
      };
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'cad',
        payment_method_types: ['card_present', 'interac_present'],
        capture_method: 'automatic',
        description: `${kind === 'DEPOSIT' ? 'Dépôt' : 'Paiement'} custom #${order.id}`,
        metadata,
      });
      await prisma.$transaction([
        prisma.customOrderPayment.update({
          where: { id: payment.id },
          data: { stripePaymentId: paymentIntent.id },
        }),
        prisma.customOrder.update({
          where: { id: order.id },
          data: { status: 'AWAITING_PAYMENT', stripePaymentId: paymentIntent.id },
        }),
      ]);
      res.status(201).json({
        success: true,
        data: {
          customOrderId: order.id,
          customOrderPaymentId: payment.id,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount,
          currency: 'CAD',
        },
      });
    } catch (err) {
      await prisma.customOrderPayment.delete({ where: { id: payment.id } }).catch(() => {});
      throw err;
    }
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

router.post('/terminal/payment-intents/:paymentIntentId/sync', async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
    const paymentId = paymentIntent.metadata?.customOrderPaymentId;
    if (!paymentId) return res.status(404).json({ success: false, message: 'Paiement custom introuvable.' });

    if (paymentIntent.status === 'succeeded') {
      const result = await settleCustomOrderPayment(prisma, paymentId, paymentIntent);
      if (result.newlyPaid) {
        sendCustomPaymentReceipt(result.order, result.payment).catch((err) => {
          console.error(`Failed to send custom Tap to Pay receipt for #${result.order.id}:`, err.message);
        });
        notifyPaidCustomOrder(prisma, result.order, result.payment).catch((err) => {
          console.error(`Failed to send custom Tap to Pay push notification for #${result.order.id}:`, err.message);
        });
      }
      return res.json({ success: true, data: protectPrivateMedia({ status: paymentIntent.status, ...result }) });
    }
    res.json({ success: true, data: { status: paymentIntent.status, order: null } });
  } catch (err) {
    next(err);
  }
});

router.post('/terminal/payment-intents/:paymentIntentId/cancel', async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
    const paymentId = Number(paymentIntent.metadata?.customOrderPaymentId);
    if (paymentIntent.status !== 'succeeded') {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      if (Number.isInteger(paymentId)) {
        await prisma.customOrderPayment.updateMany({
          where: { id: paymentId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }
    }
    res.json({ success: true, data: { status: paymentIntent.status } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/final-product-image', upload.single('image'), async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande custom introuvable.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Sélectionne une photo du produit terminé.' });
    }

    const normalized = await normalizeUploadedImage(req.file);
    const result = await uploadImage(normalized.buffer, 'custom-orders/final-products');
    const image = await prisma.customOrderImage.create({
      data: {
        customOrderId: order.id,
        fileName: req.file.originalname || `produit-final-${Date.now()}`,
        contentType: normalized.mimetype,
        storagePathOrUrl: result.secure_url,
        purpose: 'FINAL_PRODUCT',
      },
    });

    res.status(201).json({ success: true, data: protectPrivateMedia(image) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.customOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: protectPrivateMedia(order) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-email', async (req, res, next) => {
  try {
    const { subject, body, price } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Objet et corps du message requis' });
    }
    const order = await prisma.customOrder.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (!isEmailLike(order.customerEmail)) {
      return res.status(400).json({ success: false, message: 'Cette commande ne comporte pas de courriel client.' });
    }
    let emailText = body.trim();
    let paymentUrl = null;
    const lang = languageOf(order);
    const en = isEnglish(lang);

    let paymentAmount = null;
    if (price && Number(price) > 0 && !stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }
    if (price && Number(price) > 0 && stripe) {
      const totalPrice = Math.round(Number(price) * 100) / 100;
      if (totalPrice < Number(order.amountPaid || 0)) {
        return res.status(400).json({ success: false, message: 'Le prix total ne peut pas être inférieur au montant déjà payé.' });
      }
      const orderForPayment = await prisma.customOrder.update({
        where: { id: order.id },
        data: { price: totalPrice },
      });
      const balance = customOrderFinancials(orderForPayment).balance;
      if (balance <= 0) {
        return res.status(400).json({ success: false, message: 'Cette commande est déjà entièrement payée.' });
      }
      const { session, amount } = await createCustomCheckoutSession(orderForPayment, balance, 'BALANCE');
      paymentUrl = session.url;
      paymentAmount = amount;
      emailText += en
        ? `\n\n---\nAmount: ${amount.toFixed(2)} $ CAD\nPay here: ${session.url}`
        : `\n\n---\nMontant : ${amount.toFixed(2)} $ CAD\nCliquez ici pour payer : ${session.url}`;
    }

    await sendEmail({
      to: order.customerEmail,
      profile: 'business',
      lang,
      subject: subject.trim(),
      text: emailText,
      html: emailHtml({
        lang,
        title: subject.trim(),
        recipientEmail: order.customerEmail,
        content: [
          emailTextBlock(body.trim()),
          paymentUrl
            ? emailBox(`<strong>${en ? 'Amount:' : 'Montant :'}</strong> ${paymentAmount.toFixed(2)} $ CAD`) + emailButton(en ? 'Pay my order' : 'Payer ma commande', paymentUrl)
            : '',
        ].join(''),
      }),
    });

    res.json({ success: true, message: `Courriel envoyé à ${order.customerEmail}`, paymentUrl });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const existing = await prisma.customOrder.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Commande custom introuvable.' });
    }
    const order = await prisma.customOrder.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: orderInclude,
    });
    if (isNewCustomShippedTransition(existing.status, status)) {
      sendCustomOrderShippedEmail(order).catch((err) => {
        console.error(`Failed to send shipped email for custom order #${order.id}:`, err.message);
      });
    }
    res.json({ success: true, data: protectPrivateMedia(order) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/price', async (req, res, next) => {
  try {
    const price = Number(req.body.price);
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: 'Prix invalide' });
    }
    const existing = await prisma.customOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (price < Number(existing.amountPaid || 0)) {
      return res.status(400).json({ success: false, message: 'Le prix ne peut pas être inférieur au montant déjà payé.' });
    }
    const order = await prisma.customOrder.update({
      where: { id: Number(req.params.id) },
      data: { price },
      include: orderInclude,
    });
    res.json({ success: true, data: protectPrivateMedia(order) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-payment-link', async (req, res, next) => {
  try {
    const order = await prisma.customOrder.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (!isEmailLike(order.customerEmail)) {
      return res.status(400).json({ success: false, message: 'Un courriel client est requis pour envoyer un lien de paiement.' });
    }
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe non configuré' });
    }

    const { total, balance } = customOrderFinancials(order);
    if (!total || total <= 0) {
      return res.status(400).json({ success: false, message: 'Définir un prix avant d\'envoyer le lien de paiement' });
    }
    if (balance <= 0) {
      return res.status(400).json({ success: false, message: 'Cette commande est déjà entièrement payée.' });
    }

    const lang = languageOf(order);
    const en = isEnglish(lang);
    const requestedAmount = req.body.amount === undefined ? balance : req.body.amount;
    const kind = paymentKind(req.body.kind, balance >= total - 0.001 ? 'FULL' : 'BALANCE');
    const { session, amount } = await createCustomCheckoutSession(order, requestedAmount, kind);

    await sendEmail({
      to: order.customerEmail,
      profile: 'system',
      lang,
      subject: en ? `Payment for your custom order #${order.id}` : `Paiement pour votre commande sur mesure #${order.id}`,
      text: en
        ? `Hello ${order.customerName},\n\nYour custom order is ready for payment.\n\nAmount: ${amount.toFixed(2)} $ CAD\n\nPay here: ${session.url}\n\nThank you.`
        : `Bonjour ${order.customerName},\n\nVotre commande sur mesure est prête pour le paiement.\n\nMontant : ${amount.toFixed(2)} $ CAD\n\nCliquez ici pour payer : ${session.url}\n\nMerci!`,
      html: emailHtml({
        lang,
        title: en ? `Payment for your custom order #${order.id}` : `Paiement pour votre commande sur mesure #${order.id}`,
        recipientEmail: order.customerEmail,
        content: en
          ? `
          <p>Hello <strong>${order.customerName}</strong>,</p>
          <p>Your custom order is ready for payment.</p>
          ${emailBox(`<strong>Amount:</strong> ${amount.toFixed(2)} $ CAD`)}
          ${emailButton('Pay my order', session.url)}
          <p>Thank you.</p>
        `
          : `
          <p>Bonjour <strong>${order.customerName}</strong>,</p>
          <p>Votre commande sur mesure est prête pour le paiement.</p>
          ${emailBox(`<strong>Montant :</strong> ${amount.toFixed(2)} $ CAD`)}
          ${emailButton('Payer ma commande', session.url)}
          <p>Merci !</p>
        `,
      }),
    });

    res.json({ success: true, data: { checkoutUrl: session.url, amount, balance: Math.max(0, balance - amount) } });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

export default router;
