import jwt from 'jsonwebtoken';
import { publicApiBaseUrl } from './publicApiUrl.js';

const PURPOSE = 'newsletter-unsubscribe';

function secret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for newsletter unsubscribe tokens');
  }
  return process.env.JWT_SECRET;
}

export function createNewsletterUnsubscribeToken(email) {
  return jwt.sign({
    purpose: PURPOSE,
    email: String(email || '').trim().toLowerCase(),
  }, secret());
}

export function verifyNewsletterUnsubscribeToken(token) {
  const decoded = jwt.verify(token, secret());
  if (decoded?.purpose !== PURPOSE || !decoded?.email) {
    throw new Error('Invalid unsubscribe token');
  }
  return decoded.email;
}

export function newsletterUnsubscribeUrl(email) {
  const token = createNewsletterUnsubscribeToken(email);
  return `${publicApiBaseUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}
