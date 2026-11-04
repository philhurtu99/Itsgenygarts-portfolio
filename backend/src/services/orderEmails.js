import { generateInvoicePDF, invoiceNumber } from './invoice.js';
import { getStripeInvoiceData } from './stripeInvoice.js';
import { sendEmail } from './email.js';
import { emailBox, emailButton, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageOf } from '../utils/language.js';
import { orderInvoiceDownloadUrl } from '../utils/orderInvoiceToken.js';
import { importFeesReminder } from '../utils/importFeesPolicy.js';

function customerOrderCopy(order) {
  const lang = languageOf(order);
  const en = isEnglish(lang);
  return {
    lang,
    variant: en ? 'Variant' : 'Variation',
    article: en ? 'Item' : 'Article',
    qty: en ? 'Qty' : 'Qté',
    subtotal: en ? 'Subtotal' : 'Sous-total',
    total: en ? 'Total' : 'Total',
    shippingTo: en ? 'Ship to:' : 'Livraison à :',
    transaction: en ? 'Transaction details' : 'Détails de la transaction',
    orderNumber: en ? 'Order' : 'Commande',
    paymentMethod: en ? 'Payment method' : 'Méthode de paiement',
    paymentDate: en ? 'Payment date' : 'Date du paiement',
    marketSale: en ? 'In-person sale' : 'Vente en personne',
    marketBundle: en ? 'In-person bundle sale' : 'Vente groupée en personne',
    onlinePayment: en ? 'Online payment' : 'Paiement en ligne',
    tapToPay: en ? 'Tap to Pay' : 'Tap to Pay',
    cash: en ? 'Cash' : 'Comptant',
    interac: en ? 'Interac / e-transfer' : 'Interac / virement',
    manual: en ? 'Manual payment' : 'Paiement manuel',
    card: en ? 'Card' : 'Carte',
    subject: en ? `Order confirmation #${order.id}` : `Confirmation de votre commande #${order.id}`,
    title: en ? `Order confirmation #${order.id}` : `Confirmation commande #${order.id}`,
    greeting: en ? 'Hello' : 'Bonjour',
    paid: en
      ? `Thank you for your order. Your payment of ${Number(order.total).toFixed(2)} ${order.currency} has been received.`
      : `Merci pour votre commande ! Votre paiement de ${Number(order.total).toFixed(2)} ${order.currency} a bien été reçu.`,
    invoiceAttached: en
      ? (invNum) => `Your invoice (${invNum}) is attached to this email. You can also download it with the link below.`
      : (invNum) => `Votre facture (${invNum}) est jointe à cet email. Vous pouvez aussi la télécharger avec le lien ci-dessous.`,
    downloadInvoice: en ? 'Download invoice' : 'Télécharger la facture',
    invoiceDownloadLink: en ? 'Invoice download link:' : 'Lien de téléchargement de la facture :',
    nextStep: en
      ? 'We will contact you as soon as your order ships. Thank you for your trust.'
      : 'Nous vous contacterons dès que votre commande sera expédiée. Merci de votre confiance !',
  };
}

function orderAddress(order) {
  return [
    order.customerAddress,
    order.customerCity,
    order.customerProvince,
    order.customerPostalCode,
    order.customerCountry,
  ].filter(Boolean).join(', ');
}

function orderItemName(item, variantLabel = 'Variation') {
  return item.variantLabelSnapshot
    ? `${item.productName} - ${variantLabel} ${item.variantLabelSnapshot}`
    : item.productName;
}

function orderItemImageUrl(item) {
  return item?.productImageUrl || item?.imageUrl || item?.images?.[0] || '';
}

function orderItemsRows(order, labels = customerOrderCopy(order)) {
  return (order.items || []).map((item) =>
    `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #F1D6DD;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            ${orderItemImageUrl(item) ? `<td style="padding:0 10px 0 0;width:52px;"><img src="${emailEscape(orderItemImageUrl(item))}" width="52" height="52" alt="" style="display:block;width:52px;height:52px;object-fit:cover;border-radius:10px;border:1px solid #F1D6DD;"></td>` : ''}
            <td style="padding:0;vertical-align:middle;">${emailEscape(orderItemName(item, labels.variant))}</td>
          </tr>
        </table>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #F1D6DD;text-align:center;">${Number(item.quantity) || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F1D6DD;text-align:right;font-weight:700;">${Number(item.subtotal).toFixed(2)} ${emailEscape(order.currency)}</td>
    </tr>`
  ).join('');
}

function orderItemsText(order, labels = customerOrderCopy(order)) {
  return (order.items || [])
    .map((item) => `- ${orderItemName(item, labels.variant)} x${Number(item.quantity) || 1}: ${Number(item.subtotal).toFixed(2)} ${order.currency}`)
    .join('\n');
}

function paymentMethodLabel(order, stripeInvoiceData, labels) {
  const id = String(order?.stripePaymentId || '');
  const source = String(stripeInvoiceData?.sessionId || order?.stripeSessionId || '');
  const method = stripeInvoiceData?.paymentMethod;
  if (method?.type === 'card') {
    return `${labels.card}${method.brand ? ` ${method.brand}` : ''}${method.last4 ? ` •••• ${method.last4}` : ''}`;
  }
  if (String(order?.customerAddress || '').toLowerCase().includes('vente en personne') && id.startsWith('pi_')) {
    return labels.tapToPay;
  }
  if (id.startsWith('pi_') || source.startsWith('cs_')) return labels.onlinePayment;
  if (id.startsWith('market-bundle-')) {
    return (order?.items || []).length > 1 ? labels.marketBundle : labels.marketSale;
  }
  if (id.startsWith('market-')) return labels.marketSale;
  if (id.includes('tap-to-pay')) return labels.tapToPay;
  if (id.includes('-cash-')) return labels.cash;
  if (id.includes('-interac-')) return labels.interac;
  if (id.includes('-manual-')) return labels.manual;
  return labels.onlinePayment;
}

function paidDateLabel(order, lang) {
  const date = order?.paidAt || order?.createdAt;
  if (!date) return '-';
  const en = isEnglish(lang);
  const formatted = new Date(date).toLocaleString(en ? 'en-CA' : 'fr-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return en ? `${formatted} Montreal time` : `${formatted} heure de Montréal`;
}

function splitRecipients(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function uniqueRecipients(recipients) {
  return [...new Set(recipients.filter(Boolean))];
}

function configuredOrderNotificationRecipients() {
  return uniqueRecipients([
    ...splitRecipients(process.env.ORDER_NOTIFICATION_EMAIL),
    ...splitRecipients(process.env.ADMIN_EMAIL),
    ...splitRecipients(process.env.BUSINESS_EMAIL),
  ]);
}

export async function resolveOrderNotificationRecipients(prisma) {
  const configuredRecipients = configuredOrderNotificationRecipients();
  if (!prisma?.user?.findMany) return configuredRecipients;

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });
    return uniqueRecipients([
      ...configuredRecipients,
      ...(admins || []).map((admin) => admin.email),
    ]);
  } catch (err) {
    console.error('Failed to resolve admin order notification recipients:', err.message);
    return configuredRecipients;
  }
}

export async function sendOrderConfirmationEmail(order) {
  const customerEmail = String(order?.customerEmail || '').trim().toLowerCase();
  if (!customerEmail || customerEmail.endsWith('@pos.local') || customerEmail.endsWith('@pending.local')) return;

  const labels = customerOrderCopy(order);
  let stripeInvoiceData = null;
  try {
    stripeInvoiceData = await getStripeInvoiceData(order);
  } catch (err) {
    console.error(`Failed to fetch Stripe invoice data for order #${order.id}:`, err.message);
  }

  const pdf = await generateInvoicePDF(order, stripeInvoiceData);
  const invNum = invoiceNumber(order);
  const invoiceUrl = orderInvoiceDownloadUrl(order);
  const methodLabel = paymentMethodLabel(order, stripeInvoiceData, labels);
  const paidDate = paidDateLabel(order, labels.lang);
  const importNotice = importFeesReminder(order, labels.lang);
  const content = `
    <p>${labels.greeting} <strong>${emailEscape(order.customerName)}</strong>,</p>
    <p>${emailEscape(labels.paid)}</p>
    ${emailBox(`
      <strong>${emailEscape(labels.transaction)}</strong><br>
      ${emailEscape(labels.orderNumber)} : #${Number(order.id)}<br>
      ${emailEscape(labels.paymentMethod)} : ${emailEscape(methodLabel)}<br>
      ${emailEscape(labels.paymentDate)} : ${emailEscape(paidDate)}<br>
      ${emailEscape(labels.total)} : ${Number(order.total).toFixed(2)} ${emailEscape(order.currency)}
    `)}
    ${order.items?.length ? `
    <table style="width:100%;border-collapse:collapse;margin:22px 0;font-size:0.875rem;border:1px solid #F1D6DD;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#FFF5F7;">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #F1D6DD;color:#2C2018;">${emailEscape(labels.article)}</th>
          <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #F1D6DD;color:#2C2018;">${emailEscape(labels.qty)}</th>
          <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #F1D6DD;color:#2C2018;">${emailEscape(labels.subtotal)}</th>
        </tr>
      </thead>
      <tbody>${orderItemsRows(order, labels)}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:10px 12px;text-align:right;font-weight:700;">${emailEscape(labels.total)} :</td>
          <td style="padding:10px 12px;text-align:right;font-weight:800;color:#DD7A8F;font-size:1rem;">${Number(order.total).toFixed(2)} ${emailEscape(order.currency)}</td>
        </tr>
      </tfoot>
    </table>` : ''}
    ${emailBox(`<strong>${emailEscape(labels.shippingTo)}</strong><br>${emailEscape(orderAddress(order))}`)}
    ${importNotice ? emailBox(emailEscape(importNotice)) : ''}
    <p>${emailEscape(labels.invoiceAttached(invNum))}</p>
    ${emailButton(labels.downloadInvoice, invoiceUrl)}
    <p>${emailEscape(labels.nextStep)}</p>
  `;

  await sendEmail({
    to: order.customerEmail,
    profile: 'system',
    lang: labels.lang,
    subject: labels.subject,
    text: [
      `${labels.greeting} ${order.customerName},`,
      '',
      labels.paid,
      '',
      `${labels.transaction}`,
      `${labels.orderNumber}: #${Number(order.id)}`,
      `${labels.paymentMethod}: ${methodLabel}`,
      `${labels.paymentDate}: ${paidDate}`,
      `${labels.total}: ${Number(order.total).toFixed(2)} ${order.currency}`,
      '',
      orderItemsText(order, labels),
      '',
      labels.invoiceAttached(invNum),
      `${labels.invoiceDownloadLink} ${invoiceUrl}`,
      '',
      labels.nextStep,
      importNotice,
    ].filter(Boolean).join('\n'),
    html: emailHtml({
      lang: labels.lang,
      title: labels.title,
      recipientEmail: order.customerEmail,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content,
    }),
    attachments: [{ filename: `${invNum}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}

export async function sendBusinessOrderNotificationEmail(order, recipients = configuredOrderNotificationRecipients()) {
  const to = uniqueRecipients(Array.isArray(recipients) ? recipients : splitRecipients(recipients));
  if (!to.length) return;
  const frenchLabels = customerOrderCopy({ ...order, customerLanguage: 'fr' });

  const content = `
    <p>Une nouvelle commande payée vient d'arriver.</p>
    ${emailBox(`
      <strong>Commande :</strong> #${Number(order.id)}<br>
      <strong>Client :</strong> ${emailEscape(order.customerName)}<br>
      <strong>Email :</strong> ${emailEscape(order.customerEmail)}<br>
      <strong>Téléphone :</strong> ${emailEscape(order.customerPhone || '-') }<br>
      <strong>Total :</strong> ${Number(order.total).toFixed(2)} ${emailEscape(order.currency)}<br>
      <strong>Livraison :</strong> ${emailEscape(orderAddress(order))}
    `)}
    ${order.items?.length ? `
    <table style="width:100%;border-collapse:collapse;margin:22px 0;font-size:0.875rem;border:1px solid #F1D6DD;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#FFF5F7;">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #F1D6DD;color:#2C2018;">Article</th>
          <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #F1D6DD;color:#2C2018;">Qté</th>
          <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #F1D6DD;color:#2C2018;">Sous-total</th>
        </tr>
      </thead>
      <tbody>${orderItemsRows(order, frenchLabels)}</tbody>
    </table>` : ''}
  `;

  await sendEmail({
    to,
    profile: 'system',
    subject: `Nouvelle commande payée #${order.id}`,
    text: `Nouvelle commande payée #${order.id}\n\nClient: ${order.customerName}\nEmail: ${order.customerEmail}\nTéléphone: ${order.customerPhone || '-'}\nTotal: ${Number(order.total).toFixed(2)} ${order.currency}\nLivraison: ${orderAddress(order)}\n\n${orderItemsText(order, frenchLabels)}`,
    html: emailHtml({ title: `Nouvelle commande payée #${order.id}`, recipientEmail: to[0], content }),
  });
}

export async function sendPaidOrderEmails(order, { prisma } = {}) {
  const notificationRecipients = await resolveOrderNotificationRecipients(prisma);
  const jobs = [
    sendOrderConfirmationEmail(order),
    sendBusinessOrderNotificationEmail(order, notificationRecipients),
  ];
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`Failed to send paid order email for order #${order.id}:`, result.reason?.message || result.reason);
    }
  }
}
