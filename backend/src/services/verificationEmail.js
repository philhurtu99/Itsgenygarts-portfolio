import { sendEmail } from './email.js';
import { emailHtml, emailButton } from '../utils/emailTemplate.js';
import { getStorefrontUrl } from '../utils/frontendUrl.js';
import { verificationExpiresAt } from '../utils/verificationExpiry.js';
import { isEnglish } from '../utils/language.js';

export async function sendVerificationEmail(req, customer) {
  const lang = customer.preferredLanguage || 'en';
  const en = isEnglish(lang);
  const url = `${getStorefrontUrl(req)}/verify-email?token=${encodeURIComponent(customer.verificationToken)}`;
  const deadline = verificationExpiresAt(customer.createdAt).toLocaleString(en ? 'en-CA' : 'fr-CA', {
    timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short',
  });
  const expiry = en ? `Confirm before ${deadline} (Montreal time).` : `Confirmez avant le ${deadline} (heure de Montréal).`;
  const title = en ? 'Confirm your email address' : 'Confirmez votre adresse courriel';
  const text = en
    ? `Thanks for signing up. Confirm your email address using this link:\n\n${url}\n\n${expiry}\nThis email was sent by notifications@example.test.`
    : `Merci de vous être inscrit ! Confirmez votre adresse courriel avec ce lien :\n\n${url}\n\n${expiry}\nCe courriel est envoyé par notifications@example.test.`;
  await sendEmail({
    to: customer.email, profile: 'system', lang, subject: title, text,
    html: emailHtml({
      lang, title, recipientEmail: customer.email, footerEmail: 'notifications@example.test',
      content: `<p>${en ? 'Welcome. Confirm your email address to activate your account.' : 'Bienvenue ! Confirmez votre adresse courriel pour activer votre compte.'}</p>
${emailButton(en ? 'Confirm my email' : 'Confirmer mon courriel', url)}
<p>${expiry}</p>
<p>${en ? 'If you did not create an account, you can ignore this message.' : "Si vous n'avez pas créé de compte, ignorez ce message."}</p>`,
    }),
  });
}
