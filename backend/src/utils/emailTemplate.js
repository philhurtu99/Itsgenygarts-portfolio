import { newsletterUnsubscribeUrl } from './newsletterUnsubscribe.js';
import { isEnglish, normalizeLanguage } from './language.js';

function extractEmailAddress(value) {
  const str = String(value || '').trim()
  const match = str.match(/<([^>]+)>/)
  return (match ? match[1] : str).trim()
}

const BIZ = (footerEmail) => ({
  name: process.env.BUSINESS_NAME || 'Itsgenygarts',
  email: footerEmail || process.env.BUSINESS_EMAIL || extractEmailAddress(process.env.SMTP_FROM) || process.env.SMTP_USER || '',
  primary: '#DD7A8F',
  primaryDark: '#C4607A',
  secondary: '#6FC7CE',
  accent: '#FFFAF0',
  text: '#2C2018',
  muted: '#8A7A6A',
})

function copy(lang) {
  const en = isEnglish(lang);
  return {
    htmlLang: en ? 'en' : 'fr',
    tagline: en ? 'Handmade crochet creations' : 'Créations crochet artisanales',
    receivedBecause: en
      ? 'You are receiving this email because you placed an order, requested a quote, created an account, or agreed to receive our news.'
      : 'Vous recevez cet email car vous avez passé une commande, demandé un devis, créé un compte ou accepté de recevoir nos nouvelles.',
    unsubscribeStart: en ? 'You can' : 'Vous pouvez',
    unsubscribeLink: en ? 'unsubscribe from newsletters' : 'vous désabonner des infolettres',
    unsubscribeEnd: en
      ? 'Order, quote, and payment emails will continue to be sent.'
      : "Les courriels liés à vos commandes, devis et paiements continueront d'être envoyés.",
  };
}

/**
 * Wraps HTML content in a branded email shell.
 * @param {{ title: string, content: string, recipientEmail?: string, footerEmail?: string, lang?: string }} opts
 * @returns {string} Full HTML email string
 */
export function emailHtml({ title, content, recipientEmail, footerEmail, lang = 'en' }) {
  const c = copy(normalizeLanguage(lang));
  const biz = BIZ(footerEmail)
  const unsubscribeUrl = recipientEmail ? newsletterUnsubscribeUrl(recipientEmail) : null
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${biz.accent};font-family:Arial,Helvetica,sans-serif;color:${biz.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${biz.accent};border-collapse:collapse;">
    <tr>
      <td style="padding:32px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #F1D6DD;box-shadow:0 10px 30px rgba(44,32,24,0.10);border-collapse:separate;">

      <!-- Header -->
                <tr>
                  <td style="background:${biz.primary};padding:28px 30px;border-bottom:5px solid ${biz.secondary};">
                    <p style="margin:0 0 6px;color:rgba(255,255,255,0.78);font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;">${escHtml(c.tagline)}</p>
                    <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.1;font-weight:800;">${escHtml(biz.name)}</h1>
                  </td>
                </tr>

      <!-- Body -->
                <tr>
                  <td style="padding:34px 30px;color:${biz.text};font-size:16px;line-height:1.7;">
                    <h2 style="margin:0 0 18px;color:${biz.text};font-size:22px;line-height:1.25;font-weight:800;">${escHtml(title)}</h2>
                    <div style="color:${biz.text};">
                      ${content}
                    </div>
                  </td>
                </tr>

      <!-- Footer -->
                <tr>
                  <td style="background:#FFF5F7;padding:22px 30px;border-top:1px solid #F1D6DD;font-size:13px;color:${biz.muted};line-height:1.6;">
                    <p style="margin:0 0 6px;font-weight:700;color:${biz.text};">${escHtml(biz.name)}</p>
                    ${biz.email ? `<p style="margin:0 0 6px;"><a href="mailto:${escHtml(biz.email)}" style="color:${biz.primaryDark};text-decoration:none;font-weight:700;">${escHtml(biz.email)}</a></p>` : ''}
                    <p style="margin:0 0 8px;font-size:12px;">${escHtml(c.receivedBecause)}</p>
                    ${unsubscribeUrl ? `<p style="margin:0;font-size:12px;">${escHtml(c.unsubscribeStart)} <a href="${escHtml(unsubscribeUrl)}" style="color:${biz.primaryDark};font-weight:700;text-decoration:underline;">${escHtml(c.unsubscribeLink)}</a>. ${escHtml(c.unsubscribeEnd)}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emailEscape(str) {
  return escHtml(str)
}

export function emailTextBlock(text) {
  const paragraphs = String(text || '')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return ''

  return paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;">${escHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Primary CTA button */
export function emailButton(text, href) {
  return `<p style="margin:26px 0;">
    <a href="${escHtml(href)}" style="display:inline-block;padding:13px 26px;background:#DD7A8F;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:0.01em;border:2px solid #DD7A8F;">${escHtml(text)}</a>
  </p>`
}

/** Subtle info box */
export function emailBox(html) {
  return `<div style="background:#FFFAF0;border:1px solid #F0DFC0;border-left:5px solid #6FC7CE;border-radius:12px;padding:16px 18px;margin:22px 0;font-size:14px;line-height:1.65;color:#2C2018;">${html}</div>`
}
