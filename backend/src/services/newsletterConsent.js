import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isEmailLike(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || '').trim());
}

export async function applyNewsletterConsent(prisma, { email, name, consent }) {
  if (!consent || !isEmailLike(email)) return null;

  const normalizedEmail = normalizeEmail(email);
  const fallbackName = String(name || '').trim() || normalizedEmail.split('@')[0] || 'Client';
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);

  return prisma.customer.upsert({
    where: { email: normalizedEmail },
    update: { newsletterConsent: true },
    create: {
      name: fallbackName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      newsletterConsent: true,
    },
  });
}
