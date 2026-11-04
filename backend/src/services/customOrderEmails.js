import { sendEmail } from './email.js';
import { emailBox, emailEscape, emailHtml } from '../utils/emailTemplate.js';
import { isEnglish, languageOf } from '../utils/language.js';

export function isNewCustomShippedTransition(previousStatus, nextStatus) {
  return nextStatus === 'SHIPPED' && previousStatus !== 'SHIPPED';
}

export async function sendCustomOrderShippedEmail(order) {
  if (!order?.customerEmail || String(order.customerEmail).endsWith('@pos.local')) return;
  const lang = languageOf(order);
  const en = isEnglish(lang);
  const project = order.category || (en ? 'Custom order' : 'Commande sur mesure');
  const title = en
    ? `Your custom order #${order.id} has shipped`
    : `Votre commande sur mesure #${order.id} est expédiée`;
  const intro = en
    ? `Good news. Your custom order <strong>#${order.id}</strong> has shipped and is on its way to you.`
    : `Bonne nouvelle ! Votre commande sur mesure <strong>#${order.id}</strong> a été expédiée et est en route vers vous.`;
  const nextStep = en
    ? 'You should receive your package within the usual delivery time. You can reply to this email if you have any questions.'
    : 'Vous devriez recevoir votre colis dans les délais habituels. Vous pouvez répondre à ce courriel si vous avez des questions.';

  await sendEmail({
    to: order.customerEmail,
    profile: 'system',
    lang,
    subject: title,
    text: en
      ? `Hello ${order.customerName},\n\nYour custom order #${order.id} (${project}) has shipped and is on its way to you.\n\n${nextStep}\n\nThank you for your trust.`
      : `Bonjour ${order.customerName},\n\nVotre commande sur mesure #${order.id} (${project}) a été expédiée et est en route vers vous.\n\n${nextStep}\n\nMerci de votre confiance !`,
    html: emailHtml({
      lang,
      title,
      recipientEmail: order.customerEmail,
      footerEmail: process.env.NOTIFICATIONS_EMAIL || process.env.SYSTEM_EMAIL || 'notifications@example.test',
      content: `
        <p>${en ? 'Hello' : 'Bonjour'} <strong>${emailEscape(order.customerName)}</strong>,</p>
        <p>${intro}</p>
        ${emailBox(`<strong>${en ? 'Project:' : 'Projet :'}</strong> ${emailEscape(project)}<br><strong>${en ? 'Status:' : 'Statut :'}</strong> ${en ? 'Shipped' : 'Expédiée'}`)}
        <p>${emailEscape(nextStep)}</p>
        <p>${en ? 'Thank you for your trust.' : 'Merci de votre confiance !'}</p>
      `,
    }),
  });
}
