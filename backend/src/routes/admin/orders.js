import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';
import { sendEmail } from '../../services/email.js';
import { emailHtml, emailBox, emailTextBlock, emailEscape } from '../../utils/emailTemplate.js';
import { isEnglish, languageOf } from '../../utils/language.js';
import { isInPersonMarketOrder } from '../../utils/marketOrders.js';
import { importFeesReminder } from '../../utils/importFeesPolicy.js';
import {
  createShippoShipment,
  downloadShippoCommercialInvoice,
  downloadShippoLabel,
  reconcileShippoShipment,
} from '../../services/shippoLabels.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

async function sendPreparingEmail(order) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const lang = languageOf(order);
    const en = isEnglish(lang);
    const content = `
      <p>${en ? 'Hello' : 'Bonjour'} ${order.customerName},</p>
      <p>${en ? `Your order <strong>#${order.id}</strong> is now being prepared.` : `Votre commande <strong>#${order.id}</strong> est maintenant en préparation.`}</p>
      <p>${en ? 'We are preparing your items with care and will write to you once the order has shipped.' : 'Nous préparons vos articles avec soin et nous vous écrirons dès que la commande sera expédiée.'}</p>
      <p>${en ? 'If you have any questions in the meantime, you can simply reply to this email.' : 'Si vous avez une question entre-temps, vous pouvez simplement répondre à ce courriel.'}</p>
      <p style="margin-top:32px;"><a href="${frontendUrl}/profile" style="color:#C4607A;font-weight:700;text-decoration:none;">${en ? 'View my order history' : 'Voir mon historique de commandes'}</a></p>
    `;
    await sendEmail({
      to: order.customerEmail,
      profile: 'business',
      lang,
      subject: en ? `Your order #${order.id} is being prepared` : `Votre commande #${order.id} est en préparation`,
      text: en
        ? `Hello ${order.customerName},\n\nYour order #${order.id} is now being prepared.\n\nWe are preparing your items with care and will write to you once the order has shipped.\n\nThank you for your trust.`
        : `Bonjour ${order.customerName},\n\nVotre commande #${order.id} est maintenant en préparation.\n\nNous préparons vos articles avec soin et nous vous écrirons dès que la commande sera expédiée.\n\nMerci de votre confiance !`,
      html: emailHtml({ lang, title: en ? `Order #${order.id} is being prepared` : `Commande #${order.id} en préparation`, recipientEmail: order.customerEmail, content }),
    });
  } catch (err) {
    console.error(`Failed to send preparing email for order #${order.id}:`, err.message);
  }
}

async function sendShippedEmail(order) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const lang = languageOf(order);
    const en = isEnglish(lang);
    const address = [order.customerAddress, order.customerCity, order.customerProvince, order.customerPostalCode, order.customerCountry].filter(Boolean).join(', ');
    const importNotice = importFeesReminder(order, lang);
    const trackingUrl = order.shippingTrackingUrl
      || (order.shippingTrackingNumber && String(order.shippingServiceName || '').toUpperCase().includes('UPS')
        ? `https://www.ups.com/track?tracknum=${encodeURIComponent(order.shippingTrackingNumber)}`
        : null);
    const content = `
      <p>${en ? 'Hello' : 'Bonjour'} ${order.customerName},</p>
      <p>${en ? `Good news. Your order <strong>#${order.id}</strong> has shipped and is on its way to you.` : `Bonne nouvelle ! Votre commande <strong>#${order.id}</strong> vient d'être expédiée et est en route vers vous.`}</p>
      ${emailBox(`
        <strong>${en ? 'Shipping address:' : 'Adresse de livraison :'}</strong><br>
        ${address}
      `)}
      ${order.shippingTrackingNumber ? emailBox(`
        <strong>${en ? 'Tracking number:' : 'Numéro de suivi :'}</strong><br>
        ${order.shippingTrackingNumber}<br>
        ${trackingUrl ? `<a href="${trackingUrl}" style="color:#C4607A;font-weight:700;text-decoration:none;">${en ? 'Track my package' : 'Suivre mon colis'}</a>` : ''}
      `) : ''}
      <p>${en ? 'You should receive your package within the usual delivery time. If you have any questions, reply to this email.' : "Vous recevrez votre colis dans les délais habituels. Si vous avez la moindre question, n'hésitez pas à nous contacter en répondant à cet email."}</p>
      <p>${en ? 'Thank you for your trust.' : 'Merci de votre confiance et bonne réception !'}</p>
      ${importNotice ? emailBox(emailEscape(importNotice)) : ''}
      <p style="margin-top:32px;"><a href="${frontendUrl}/profile" style="color:#C4607A;font-weight:700;text-decoration:none;">${en ? 'View my order history' : 'Voir mon historique de commandes'}</a></p>
    `;
    await sendEmail({
      to: order.customerEmail,
      profile: 'system',
      lang,
      subject: en ? `Your order #${order.id} has shipped` : `Votre commande #${order.id} est expédiée !`,
      text: (en
        ? `Hello ${order.customerName},\n\nYour order #${order.id} has shipped and is on its way to you.\n\nShipping address: ${address}${order.shippingTrackingNumber ? `\nTracking number: ${order.shippingTrackingNumber}${trackingUrl ? `\n${trackingUrl}` : ''}` : ''}\n\nThank you for your trust.`
        : `Bonjour ${order.customerName},\n\nVotre commande #${order.id} a été expédiée et est en route vers vous.\n\nAdresse de livraison : ${address}${order.shippingTrackingNumber ? `\nNuméro de suivi : ${order.shippingTrackingNumber}${trackingUrl ? `\n${trackingUrl}` : ''}` : ''}\n\nMerci de votre confiance !`) + (importNotice ? `\n\n${importNotice}` : ''),
      html: emailHtml({
        lang,
        title: en ? `Order #${order.id} shipped` : `Commande #${order.id} expédiée`,
        recipientEmail: order.customerEmail,
        footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
        content,
      }),
    });
  } catch (err) {
    console.error(`Failed to send shipped email for order #${order.id}:`, err.message);
  }
}

// List all orders
router.get('/', async (req, res, next) => {
  try {
    const where = req.query.status
      ? { status: req.query.status }
      : { status: { not: 'PENDING' } };
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// Get single order
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/shipping-label', async (req, res, next) => {
  let labelLockAcquired = false;
  let purchaseMayHaveSucceeded = false;
  let purchaseStartedAt;
  let transactionId = null;
  let id;
  try {
    id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (isInPersonMarketOrder(order)) {
      return res.status(400).json({ success: false, message: 'Une vente sur place ne requiert pas d’étiquette.' });
    }
    if (!['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(order.status)) {
      return res.status(409).json({ success: false, message: 'La commande doit être payée avant de créer l’étiquette.' });
    }
    if (order.shippingProvider !== 'SHIPPO') {
      return res.status(409).json({ success: false, message: 'Cette commande n’utilise pas une livraison Shippo.' });
    }
    transactionId = order.shippingTransactionId || null;
    purchaseStartedAt = order.shippingLabelPurchaseStartedAt;

    if (!order.shippingTransactionId) {
      purchaseStartedAt = new Date();
      // An unresolved provider response must not allow a later duplicate purchase.
      const lock = await prisma.order.updateMany({
        where: {
          id,
          shippingTransactionId: null,
          shippingLabelPurchaseStartedAt: null,
        },
        data: { shippingLabelPurchaseStartedAt: purchaseStartedAt },
      });
      if (lock.count !== 1) {
        const current = await prisma.order.findUnique({ where: { id }, include: { items: true } });
        if (current?.shippingTransactionId) {
          return res.json({ success: true, data: current });
        }
        return res.status(409).json({
          success: false,
          message: 'L’achat de l’étiquette est déjà en cours ou son résultat est incertain. Vérifie la transaction dans Shippo avant de réessayer.',
        });
      }
      labelLockAcquired = true;
    }

    const shipment = await createShippoShipment(order, {
      onRate: (rateId) => prisma.order.update({ where: { id }, data: { shippingRateId: rateId } }),
      onTransaction: async (savedId) => {
        await prisma.order.update({ where: { id }, data: { shippingTransactionId: savedId } });
        transactionId = savedId;
      },
    });
    purchaseMayHaveSucceeded = shipment.created;
    const updated = shipment.created
      ? await prisma.order.update({
        where: { id },
        data: {
          shippingTrackingNumber: shipment.trackingNumber,
          shippingTrackingUrl: shipment.trackingUrl,
          shippingTransactionId: shipment.transactionId,
          shippingLabelPurchaseStartedAt: null,
          shippingLabelCreatedAt: new Date(),
        },
        include: { items: true },
      })
      : order;

    res.json({ success: true, data: updated });
  } catch (err) {
    if ((labelLockAcquired || err.purchaseRejected) && Number.isInteger(id)
      && !purchaseMayHaveSucceeded && !err.purchaseOutcomeUnknown) {
      await prisma.order.updateMany({
        where: { id, shippingLabelCreatedAt: null, shippingTransactionId: transactionId, shippingLabelPurchaseStartedAt: purchaseStartedAt || null },
        data: { shippingLabelPurchaseStartedAt: null, ...(err.purchaseRejected ? { shippingTransactionId: null } : {}) },
      }).catch(() => {});
    }
    next(err);
  }
});

router.post('/:id/shipping-label/reconcile', async (req, res, next) => {
  let order;
  try {
    const id = Number(req.params.id);
    order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (order.shippingProvider !== 'SHIPPO' || isInPersonMarketOrder(order)) {
      return res.status(409).json({ success: false, message: 'Cette commande n’utilise pas une livraison Shippo.' });
    }
    if (order.shippingLabelCreatedAt) return res.json({ success: true, data: order });
    if (!order.shippingLabelPurchaseStartedAt && !order.shippingTransactionId) {
      return res.status(409).json({ success: false, message: 'Aucun achat d’étiquette n’est en attente.' });
    }
    const shipment = await reconcileShippoShipment(order, order.shippingTransactionId || req.body.transactionId);
    const updated = await prisma.order.update({
      where: { id },
      data: {
        shippingTransactionId: shipment.transactionId,
        shippingTrackingNumber: shipment.trackingNumber,
        shippingTrackingUrl: shipment.trackingUrl,
        shippingLabelCreatedAt: new Date(),
        shippingLabelPurchaseStartedAt: null,
      },
      include: { items: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.purchaseRejected && order) {
      await prisma.order.updateMany({
        where: {
          id: order.id,
          shippingLabelCreatedAt: null,
          shippingTransactionId: order.shippingTransactionId || null,
          shippingLabelPurchaseStartedAt: order.shippingLabelPurchaseStartedAt || null,
        },
        data: { shippingTransactionId: null, shippingLabelPurchaseStartedAt: null },
      }).catch(() => {});
    }
    next(err);
  }
});

router.get('/:id/shipping-label/pdf', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (!order.shippingTransactionId) {
      return res.status(409).json({ success: false, message: 'Crée d’abord l’étiquette Shippo.' });
    }

    const document = await downloadShippoLabel(order.shippingTransactionId);
    const safeTrackingNumber = String(order.shippingTrackingNumber || order.id).replace(/[^A-Za-z0-9_-]/g, '');
    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="shippo-${safeTrackingNumber}.pdf"`);
    res.send(document.data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/shipping-label/commercial-invoice/pdf', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (!order.shippingTransactionId) {
      return res.status(409).json({ success: false, message: 'Crée d’abord l’étiquette Shippo.' });
    }
    if (String(order.customerCountry || '').trim().toUpperCase() === 'CA') {
      return res.status(409).json({ success: false, message: 'Aucune facture commerciale n’est requise pour cet envoi canadien.' });
    }

    const document = await downloadShippoCommercialInvoice(order.shippingTransactionId);
    const safeTrackingNumber = String(order.shippingTrackingNumber || order.id).replace(/[^A-Za-z0-9_-]/g, '');
    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="facture-commerciale-${safeTrackingNumber}.pdf"`);
    res.send(document.data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-email', async (req, res, next) => {
  try {
    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Objet et corps du message requis' });
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (!order.customerEmail || String(order.customerEmail).toLowerCase().endsWith('.local')) {
      return res.status(400).json({ success: false, message: 'Aucun courriel client fourni pour cette commande' });
    }
    const lang = languageOf(order);
    await sendEmail({
      to: order.customerEmail,
      profile: 'business',
      lang,
      subject: subject.trim(),
      text: body.trim(),
      html: emailHtml({
        lang,
        title: subject.trim(),
        recipientEmail: order.customerEmail,
        content: emailTextBlock(body.trim()),
      }),
    });

    res.json({ success: true, message: `Courriel envoyé à ${order.customerEmail}` });
  } catch (err) {
    next(err);
  }
});

// Update order status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const trackingNumber = String(req.body.trackingNumber || '').trim().slice(0, 100);
    const validStatuses = ['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const existing = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (isInPersonMarketOrder(existing)) {
      return res.status(400).json({ success: false, message: 'Cette vente sur place est déjà complétée et ne change pas de statut.' });
    }
    const data = { status };
    if (status === 'SHIPPED') {
      const effectiveTrackingNumber = trackingNumber || existing.shippingTrackingNumber || null;
      if (existing.shippingTrackingIncluded && !effectiveTrackingNumber) {
        return res.status(400).json({
          success: false,
          message: 'Achète d’abord l’étiquette ou ajoute le numéro de suivi avant de marquer la commande comme expédiée.',
        });
      }
      data.shippingTrackingNumber = existing.shippingTrackingIncluded ? effectiveTrackingNumber : null;
    }
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data,
      include: { items: true },
    });

    if (status === 'PREPARING') {
      await sendPreparingEmail(order);
    }

    if (status === 'SHIPPED') {
      await sendShippedEmail(order);
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

export default router;
