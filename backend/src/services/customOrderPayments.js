import { sendEmail } from './email.js';
import { emailBox, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageOf } from '../utils/language.js';
import { paidAtFromStripeObject, stripeObjectId } from '../utils/stripeCheckout.js';
import {
  customPaymentInvoiceNumber,
  generateCustomPaymentInvoicePDF,
} from './customPaymentInvoice.js';

const PAYMENT_PHASE_STATUSES = new Set(['NEW', 'DISCUSSING', 'AWAITING_PAYMENT', 'PAID']);

export function customOrderFinancials(order) {
  const total = Math.max(0, Number(order?.price || 0));
  const paid = Math.min(total, Math.max(0, Number(order?.amountPaid || 0)));
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { total, paid, balance };
}

export function validatedCustomPaymentAmount(order, value) {
  const amount = Math.round(Number(value) * 100) / 100;
  const { balance } = customOrderFinancials(order);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Le montant du paiement doit être supérieur à 0.'), { statusCode: 400 });
  }
  if (amount > balance + 0.001) {
    throw Object.assign(new Error(`Le montant dépasse le solde de ${balance.toFixed(2)} $.`), { statusCode: 400 });
  }
  return amount;
}

function nextOrderPaymentData(order, amount, paidAt, stripePaymentId = null) {
  const { total, paid } = customOrderFinancials(order);
  const amountPaid = Math.min(total, Math.round((paid + amount) * 100) / 100);
  const paymentStatus = amountPaid >= total - 0.001 ? 'PAID' : 'PARTIALLY_PAID';
  let status = order.status;

  if (PAYMENT_PHASE_STATUSES.has(status)) {
    status = paymentStatus === 'PAID' ? 'PAID' : 'AWAITING_PAYMENT';
  }

  return {
    amountPaid,
    paymentStatus,
    status,
    ...(paymentStatus === 'PAID' ? { paidAt } : {}),
    ...(stripePaymentId ? { stripePaymentId } : {}),
  };
}

export async function recordManualCustomOrderPayment(prisma, {
  customOrderId,
  amount,
  kind = 'BALANCE',
  method = 'CASH',
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.customOrder.findUnique({ where: { id: Number(customOrderId) } });
    if (!order) throw Object.assign(new Error('Commande custom introuvable.'), { statusCode: 404 });
    const validAmount = validatedCustomPaymentAmount(order, amount);
    const paidAt = new Date();
    const payment = await tx.customOrderPayment.create({
      data: {
        customOrderId: order.id,
        amount: validAmount,
        kind,
        method,
        status: 'PAID',
        paidAt,
      },
    });
    const updatedOrder = await tx.customOrder.update({
      where: { id: order.id },
      data: nextOrderPaymentData(order, validAmount, paidAt),
      include: {
        images: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { order: updatedOrder, payment, newlyPaid: true };
  });
}

export async function settleCustomOrderPayment(prisma, paymentId, stripeObject) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.customOrderPayment.findUnique({
      where: { id: Number(paymentId) },
      include: { customOrder: true },
    });
    if (!payment) throw Object.assign(new Error('Paiement custom introuvable.'), { statusCode: 404 });

    if (payment.status === 'PAID') {
      const order = await tx.customOrder.findUnique({
        where: { id: payment.customOrderId },
        include: { images: true, payments: { orderBy: { createdAt: 'asc' } } },
      });
      return { order, payment, newlyPaid: false };
    }

    const paidAt = paidAtFromStripeObject(stripeObject);
    const paymentIntentId = stripeObjectId(stripeObject?.payment_intent) || stripeObject?.id || null;
    const updatedPayment = await tx.customOrderPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt,
        ...(paymentIntentId ? { stripePaymentId: paymentIntentId } : {}),
      },
    });
    const order = await tx.customOrder.update({
      where: { id: payment.customOrderId },
      data: nextOrderPaymentData(payment.customOrder, Number(payment.amount), paidAt, paymentIntentId),
      include: {
        images: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { order, payment: updatedPayment, newlyPaid: true };
  });
}

export async function markLegacyCustomOrderPaid(prisma, customOrderId, stripeObject) {
  const order = await prisma.customOrder.findUnique({ where: { id: Number(customOrderId) } });
  if (!order) return { order: null, newlyPaid: false };
  const { total, paid } = customOrderFinancials(order);
  if (order.paymentStatus === 'PAID' || (total > 0 && paid >= total - 0.001)) {
    return { order, newlyPaid: false };
  }
  const paidAt = paidAtFromStripeObject(stripeObject);
  const stripePaymentId = stripeObjectId(stripeObject?.payment_intent) || stripeObject?.id || null;
  const updatedOrder = await prisma.customOrder.update({
    where: { id: order.id },
    data: {
      status: PAYMENT_PHASE_STATUSES.has(order.status) ? 'PAID' : order.status,
      amountPaid: Number(order.price || 0),
      paymentStatus: 'PAID',
      stripePaymentId,
      paidAt,
    },
    include: {
      images: true,
      payments: { orderBy: { createdAt: 'asc' } },
    },
  });
  return { order: updatedOrder, newlyPaid: true };
}

export async function sendCustomPaymentReceipt(order, payment) {
  if (!order?.customerEmail || String(order.customerEmail).endsWith('@pos.local')) return;
  const lang = languageOf(order);
  const en = isEnglish(lang);
  const { total, paid, balance } = customOrderFinancials(order);
  const amount = Number(payment.amount);
  const fullyPaid = balance <= 0.001;
  const isDeposit = payment.kind === 'DEPOSIT' && balance > 0;
  const title = fullyPaid
    ? (en ? `Payment completed for custom order #${order.id}` : `Paiement complété pour la commande custom #${order.id}`)
    : isDeposit
      ? (en ? `Deposit received for custom order #${order.id}` : `Dépôt reçu pour la commande custom #${order.id}`)
      : (en ? `Payment received for custom order #${order.id}` : `Paiement reçu pour la commande custom #${order.id}`);
  const confirmation = fullyPaid
    ? (en ? 'Your custom order is now fully paid.' : 'Votre commande custom est maintenant payée en totalité.')
    : isDeposit
      ? (en ? 'We received your deposit.' : 'Nous avons reçu votre dépôt.')
      : (en ? 'We received your payment.' : 'Nous avons reçu votre paiement.');
  const invoiceAttached = en
    ? 'Your payment invoice is attached to this email.'
    : 'Votre facture de paiement est jointe à ce courriel.';
  const summary = en
    ? `<strong>Payment received:</strong> ${amount.toFixed(2)} $ CAD<br><strong>Total:</strong> ${total.toFixed(2)} $ CAD<br><strong>Paid:</strong> ${paid.toFixed(2)} $ CAD<br><strong>Balance:</strong> ${balance.toFixed(2)} $ CAD`
    : `<strong>Paiement reçu :</strong> ${amount.toFixed(2)} $ CAD<br><strong>Total :</strong> ${total.toFixed(2)} $ CAD<br><strong>Payé :</strong> ${paid.toFixed(2)} $ CAD<br><strong>Solde :</strong> ${balance.toFixed(2)} $ CAD`;
  const pdf = await generateCustomPaymentInvoicePDF(order, payment);
  const invoiceNumber = customPaymentInvoiceNumber(order, payment);

  await sendEmail({
    to: order.customerEmail,
    profile: 'system',
    lang,
    subject: title,
    text: en
      ? `Hello ${order.customerName},\n\n${confirmation}\n\nPayment received: ${amount.toFixed(2)} $ CAD\nTotal: ${total.toFixed(2)} $ CAD\nPaid: ${paid.toFixed(2)} $ CAD\nBalance: ${balance.toFixed(2)} $ CAD\n\n${invoiceAttached}\n\nThank you.`
      : `Bonjour ${order.customerName},\n\n${confirmation}\n\nPaiement reçu : ${amount.toFixed(2)} $ CAD\nTotal : ${total.toFixed(2)} $ CAD\nPayé : ${paid.toFixed(2)} $ CAD\nSolde : ${balance.toFixed(2)} $ CAD\n\n${invoiceAttached}\n\nMerci!`,
    html: emailHtml({
      lang,
      title,
      recipientEmail: order.customerEmail,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content: `<p>${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(order.customerName)}</strong>,</p><p>${emailEscape(confirmation)}</p>${emailBox(summary)}<p>${emailEscape(invoiceAttached)}</p><p>${en ? 'Thank you.' : 'Merci!'}</p>`,
    }),
    attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}
