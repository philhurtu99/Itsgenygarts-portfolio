import rateLimit from 'express-rate-limit';

// Broad abuse protection. Sensitive routes keep their stricter limiters below.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
});

// Strict: login, register, forgot-password — anti brute-force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

// Applied after email validation, in addition to the per-IP auth limiter.
export const verificationResendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.body.email,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'VERIFICATION_COOLDOWN', message: 'Please wait one minute before requesting another email.' },
});

// Moderate: checkout, custom orders, quotes — anti spam
export const actionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez plus tard.' },
});

// Page views must never consume the checkout/custom-order action budget.
export const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes analytiques. Réessayez plus tard.' },
});

// Cost protection for carrier quotes. Identical valid requests are also cached server-side.
export const shippingQuoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de calculs de livraison. Réessayez dans quelques minutes.' },
});
