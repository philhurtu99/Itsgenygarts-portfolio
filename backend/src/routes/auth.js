import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../services/email.js';
import { emailHtml, emailButton } from '../utils/emailTemplate.js';
import { setAuthCookie, clearAuthCookie, readAuthCookie } from '../utils/authCookie.js';
import { getStorefrontUrl } from '../utils/frontendUrl.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, verificationResendLimiter } from '../middleware/rateLimit.js';
import { sendVerificationEmail } from '../services/verificationEmail.js';
import { isVerificationExpired } from '../utils/verificationExpiry.js';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, deleteAccountSchema, confirmDeleteAccountSchema,
} from '../schemas/auth.js';
import { generateInvoicePDF, invoiceNumber } from '../services/invoice.js';
import { getStripeInvoiceData } from '../services/stripeInvoice.js';
import { isEnglish, languageFromRequest } from '../utils/language.js';
import { canDownloadInvoice } from '../utils/orderInvoiceToken.js';
import { protectPrivateMedia } from '../utils/privateMedia.js';

const router = Router();
const prisma = new PrismaClient();

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function extractEmailAddress(value) {
  const str = String(value || '').trim();
  const match = str.match(/<([^>]+)>/);
  return (match ? match[1] : str).trim();
}

function systemFooterEmail() {
  return process.env.NOTIFICATIONS_EMAIL
    || extractEmailAddress(process.env.NOTIFICATIONS_FROM)
    || process.env.SYSTEM_EMAIL
    || 'notifications@example.test';
}

function normalizeContactRecord(record = {}) {
  return {
    phone: firstValue(record.customerPhone),
    address: firstValue(record.customerAddress, record.shippingAddress),
    city: firstValue(record.customerCity, record.city),
    province: firstValue(record.customerProvince),
    postalCode: firstValue(record.customerPostalCode, record.postalCode),
    country: firstValue(record.customerCountry, record.country),
    createdAt: record.createdAt || record.createdAtUtc,
  };
}

async function findLatestCustomerContact(email) {
  if (!email) return {};

  const [orders, customOrders, personalizedQuotes, quoteRequests] = await Promise.all([
    prisma.order.findMany({
      where: { customerEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        customerPhone: true, customerAddress: true, customerCity: true, customerProvince: true,
        customerPostalCode: true, customerCountry: true, createdAt: true,
      },
    }),
    prisma.customOrder.findMany({
      where: { customerEmail: email },
      orderBy: { createdAtUtc: 'desc' },
      take: 1,
      select: {
        customerPhone: true, customerAddress: true, customerCity: true, customerProvince: true,
        customerPostalCode: true, customerCountry: true, createdAtUtc: true,
      },
    }),
    prisma.personalizedQuote.findMany({
      where: { customerEmail: email },
      orderBy: { createdAtUtc: 'desc' },
      take: 1,
      select: {
        customerPhone: true, customerAddress: true, customerCity: true, customerProvince: true,
        customerPostalCode: true, customerCountry: true, createdAtUtc: true,
      },
    }),
    prisma.quoteRequest.findMany({
      where: { customerEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        customerPhone: true, shippingAddress: true, city: true, postalCode: true, country: true, createdAt: true,
      },
    }),
  ]);

  const latest = [orders, customOrders, personalizedQuotes, quoteRequests]
    .flatMap((records) => (Array.isArray(records) ? records : []))
    .map(normalizeContactRecord)
    .filter((contact) => contact.address || contact.city || contact.postalCode || contact.phone)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

  if (!latest) return {};
  const { createdAt, ...contact } = latest;
  return contact;
}

async function customerWithLatestContact(customer) {
  const contact = await findLatestCustomerContact(customer?.email);
  return {
    ...customer,
    phone: contact.phone || customer?.phone,
    address: contact.address || customer?.address,
    city: contact.city || customer?.city,
    province: contact.province || customer?.province,
    postalCode: contact.postalCode || customer?.postalCode,
    country: contact.country || customer?.country,
    latestContact: contact,
  };
}

async function deleteCustomerAccount(customer) {
  const anonEmail = `deleted-${customer.id}-${Date.now()}@anonymized.local`;
  const anonData = {
    customerName: 'Utilisateur supprimé',
    customerEmail: anonEmail,
    customerPhone: null,
    customerAddress: 'Anonymisé',
    customerCity: 'Anonymisé',
    customerProvince: null,
    customerPostalCode: 'Anonymisé',
    customerCountry: 'Anonymisé',
  };

  await prisma.$transaction([
    prisma.order.updateMany({ where: { customerEmail: customer.email }, data: anonData }),
    prisma.customOrder.updateMany({ where: { customerEmail: customer.email }, data: anonData }),
    prisma.personalizedQuote.updateMany({ where: { customerEmail: customer.email }, data: anonData }),
    prisma.customer.delete({ where: { id: customer.id } }),
  ]);
}

async function requireCustomer(req, res, next) {
  const cookieToken = readAuthCookie(req, 'customer');
  const auth = req.headers.authorization;
  const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = cookieToken || bearerToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Non authentifié' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.type !== 'customer') {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const customerId = Number(decoded.id);
    if (!Number.isInteger(customerId)) {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, email: true, emailVerified: true, isActive: true, createdAt: true, passwordHash: true, preferredLanguage: true },
    });
    if (!customer || !customer.isActive) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    if (!customer.emailVerified) {
      return res.status(403).json({ success: false, message: 'Veuillez confirmer votre adresse courriel avant de continuer.' });
    }

    req.customer = customer;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, newsletterConsent = false } = req.body;
    const lang = languageFromRequest(req);
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing && !existing.emailVerified && existing.verificationToken && isVerificationExpired(existing)) {
      await prisma.customer.delete({ where: { id: existing.id } });
    } else if (existing) {
      return res.status(409).json({
        success: false,
        ...(existing.emailVerified ? {} : { code: 'EMAIL_UNVERIFIED' }),
        message: existing.emailVerified
          ? 'Un compte existe déjà avec cet email'
          : 'Ce compte attend encore la confirmation du courriel. Demandez un nouveau courriel ci-dessous.',
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await prisma.customer.create({
      data: { name, email, passwordHash, verificationToken, newsletterConsent, preferredLanguage: lang },
      select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, preferredLanguage: true },
    });

    let verificationEmailSent = false;
    try {
      await sendVerificationEmail(req, { ...customer, verificationToken, preferredLanguage: lang });
      verificationEmailSent = true;
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }

    res.status(201).json({ success: true, data: { customer, verificationEmailSent } });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', authLimiter, validate(forgotPasswordSchema), verificationResendLimiter, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { email: req.body.email } });
    if (customer?.isActive && !customer.emailVerified && customer.verificationToken && !isVerificationExpired(customer)) {
      try {
        // Reuse the link and original deadline; repeated requests cannot prolong account retention.
        await sendVerificationEmail(req, customer);
      } catch (err) {
        console.error('Failed to resend verification email:', err.message);
      }
    }
    // Acknowledge the request, not delivery, without revealing whether an account exists.
    res.status(202).json({ success: true, data: { requested: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token manquant' });
    }

    const customer = await prisma.customer.findUnique({ where: { verificationToken: token } });
    if (!customer || !customer.isActive || customer.emailVerified || isVerificationExpired(customer)) {
      return res.status(400).json({ success: false, message: 'Lien invalide, expiré ou déjà utilisé' });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { emailVerified: true, verificationToken: null },
    });

    res.json({ success: true, message: 'Courriel confirmé avec succès' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const preferredLanguage = languageFromRequest(req);

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer || !customer.isActive) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    if (!customer.emailVerified) {
      return res.status(403).json({ success: false, message: 'Veuillez confirmer votre adresse courriel avant de vous connecter. Vérifiez votre boîte de réception.' });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { preferredLanguage },
    });

    const token = jwt.sign(
      { type: 'customer', id: customer.id, email: customer.email, name: customer.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    setAuthCookie(res, 'customer', token);

    res.json({
      success: true,
      data: {
        customer: await customerWithLatestContact({ id: customer.id, name: customer.name, email: customer.email, emailVerified: true, preferredLanguage }),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res, 'customer');
  res.json({ success: true });
});

// ── Password reset ───────────────────────────────────────────────────────────

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const customer = await prisma.customer.findUnique({ where: { email } });

    // Always respond success to avoid email enumeration
    if (customer && customer.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await prisma.customer.update({
        where: { id: customer.id },
        data: { resetPasswordToken: token, resetPasswordExpires: expires },
      });

      const frontendUrl = getStorefrontUrl(req);
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const lang = languageFromRequest(req, customer.preferredLanguage || 'en');
      const en = isEnglish(lang);

      try {
        await sendEmail({
          to: email,
          profile: 'system',
          lang,
          subject: en ? 'Reset your password' : 'Réinitialisation de votre mot de passe',
          text: en
            ? `Hello ${customer.name},\n\nYou asked to reset your password. Click the link below (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not make this request, you can ignore this email.`
            : `Bonjour ${customer.name},\n\nVous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous (valide 1 heure) :\n\n${resetUrl}\n\nSi vous n'avez pas fait cette demande, ignorez ce courriel.`,
          html: emailHtml({
            lang,
            title: en ? 'Reset your password' : 'Réinitialisation de votre mot de passe',
            recipientEmail: email,
            footerEmail: systemFooterEmail(),
            content: en
              ? `<p>Hello <strong>${customer.name}</strong>,</p>
<p>You asked to reset your password. Click the button below to create a new password. This link is valid for <strong>1 hour</strong>.</p>
${emailButton('Reset my password', resetUrl)}
<p style="font-size:0.875rem;color:#8A7A6A;">If you did not make this request, you can ignore this message. Your current password will remain unchanged.</p>`
              : `<p>Bonjour <strong>${customer.name}</strong>,</p>
<p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien est valide pendant <strong>1 heure</strong>.</p>
${emailButton('Réinitialiser mon mot de passe', resetUrl)}
<p style="font-size:0.875rem;color:#8A7A6A;">Si vous n'avez pas fait cette demande, ignorez ce message — votre mot de passe actuel reste inchangé.</p>`,
          }),
        });
      } catch (emailErr) {
        console.error('Failed to send reset email:', emailErr.message);
      }
    }

    res.json({ success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const customer = await prisma.customer.findUnique({
      where: { resetPasswordToken: token },
    });

    if (!customer || !customer.resetPasswordExpires || customer.resetPasswordExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    try {
      const lang = languageFromRequest(req, customer.preferredLanguage || 'en');
      const en = isEnglish(lang);
      await sendEmail({
        to: customer.email,
        profile: 'system',
        lang,
        subject: en ? 'Your password was changed' : 'Votre mot de passe a été modifié',
        text: en
          ? `Hello ${customer.name},\n\nYour password was changed successfully. If you did not make this change, contact us immediately.`
          : `Bonjour ${customer.name},\n\nVotre mot de passe a bien été modifié. Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.`,
        html: emailHtml({
          lang,
          title: en ? 'Password changed' : 'Mot de passe modifié',
          recipientEmail: customer.email,
          footerEmail: systemFooterEmail(),
          content: en
            ? `<p>Hello <strong>${customer.name}</strong>,</p>
<p>Your password was changed successfully.</p>
<p style="background:#fef3cd;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;font-size:0.875rem;">If you did not make this change, contact us immediately by replying to this email.</p>`
            : `<p>Bonjour <strong>${customer.name}</strong>,</p>
<p>Votre mot de passe a bien été modifié avec succès.</p>
<p style="background:#fef3cd;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;font-size:0.875rem;">Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement en répondant à cet email.</p>`,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send password-changed email:', emailErr.message);
    }

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    next(err);
  }
});

// ── Cart routes ──────────────────────────────────────────────────────────────

function isUnavailable(product) {
  if (!product || product.isDeleted || product.isDraft) return true;
  if (product.variants?.length) {
    return product.variants.filter((variant) => variant.status === 'AVAILABLE').length <= 0;
  }
  const reserved = (product.reservations || []).reduce((sum, reservation) => sum + Number(reservation.quantity || 0), 0);
  const availableStock = Math.max(0, Number(product.stockQuantity ?? 0) - reserved);
  return Boolean(product.soldOut) || availableStock <= 0;
}

function activeReservationQuantity(product) {
  return (product?.reservations || []).reduce((sum, reservation) => sum + Number(reservation.quantity || 0), 0);
}

function isPermanentlyUnavailable(product) {
  if (!product || product.isDeleted || product.isDraft) return true;
  if (product.variants?.length) {
    return product.variants.filter((variant) => variant.status !== 'SOLD').length <= 0;
  }
  if (activeReservationQuantity(product) > 0) {
    return false;
  }
  return Boolean(product.soldOut) || Number(product.stockQuantity ?? 0) <= 0;
}

function availableStock(product) {
  if (product?.variants?.length) {
    return product.variants.filter((variant) => variant.status === 'AVAILABLE').length;
  }
  const reserved = activeReservationQuantity(product);
  return Math.max(0, Number(product.stockQuantity ?? 0) - reserved);
}

async function deleteUnavailableCustomerCartItems(customerId, items) {
  const staleItemIds = items
    .filter((i) => isPermanentlyUnavailable(i.product) || (i.productVariant && i.productVariant.status === 'SOLD'))
    .map((i) => i.id)
    .filter(Boolean);

  if (staleItemIds.length > 0) {
    await prisma.cartItem.deleteMany({
      where: {
        customerId,
        id: { in: staleItemIds },
      },
    });
  }
}

async function deleteUnavailableCustomerFavoriteItems(customerId, items) {
  const staleFavoriteIds = items
    .filter((i) => isPermanentlyUnavailable(i.product))
    .map((i) => i.id)
    .filter(Number.isInteger);
  const staleVariantFavoriteIds = items
    .filter((i) => i.productVariant && i.productVariant.status !== 'AVAILABLE')
    .map((i) => i.id)
    .filter(Number.isInteger);
  const staleIds = [...new Set([...staleFavoriteIds, ...staleVariantFavoriteIds])];

  if (staleIds.length > 0) {
    await prisma.favoriteItem.deleteMany({
      where: {
        customerId,
        id: { in: staleIds },
      },
    });
  }
}

function serializeFavorite(item) {
  const product = item.product;
  const variant = item.productVariant || (product.variants || [])[0] || null;
  const variantLabel = variant ? variantLabelFor(product, variant.id) : null;
  const variantImageUrl = variant?.images?.[0]?.imageUrl || null;
  return {
    id: product.id,
    productId: product.id,
    productVariantId: variant?.id || null,
    variantLabel,
    variantImageUrl,
    name: product.name,
    nameFr: product.nameFr,
    nameEn: product.nameEn,
    description: product.description,
    descriptionFr: product.descriptionFr,
    descriptionEn: product.descriptionEn,
    price: Number(product.price),
    mainImageUrl: variantImageUrl || product.mainImageUrl,
    stockQuantity: availableStock(product),
    soldOut: isUnavailable(product),
    category: product.category,
    images: product.images,
    variants: product.variants,
    createdAt: item.createdAt,
  };
}

function variantLabelFor(product, variantId) {
  const variants = (product?.variants || [])
    .filter((variant) => variant.status === 'AVAILABLE')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  if (variants.length <= 1) return null;
  const index = variants.findIndex((variant) => variant.id === variantId);
  return index >= 0 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index] : null;
}

function serializeCartItem(item) {
  const product = item.product;
  const variant = item.productVariant;
  const variantLabel = variant ? variantLabelFor(product, variant.id) : null;
  const variantImageUrl = variant?.images?.[0]?.imageUrl || null;
  return {
    id: product.id,
    productId: product.id,
    productVariantId: variant?.id || null,
    variantLabel,
    variantImageUrl,
    name: product.name,
    nameFr: product.nameFr,
    nameEn: product.nameEn,
    description: product.description,
    descriptionFr: product.descriptionFr,
    descriptionEn: product.descriptionEn,
    price: Number(product.price),
    mainImageUrl: variantImageUrl || product.mainImageUrl,
    stockQuantity: availableStock(product),
    soldOut: isUnavailable(product),
    quantity: 1,
  };
}

router.get('/cart', requireCustomer, async (req, res, next) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { customerId: req.customer.id },
      include: {
        product: {
          select: {
            id: true, name: true, nameFr: true, nameEn: true, description: true, descriptionFr: true, descriptionEn: true, price: true, mainImageUrl: true, stockQuantity: true, soldOut: true, isDeleted: true, isDraft: true,
            reservations: { where: { expiresAt: { gt: new Date() } }, select: { quantity: true } },
            variants: { where: { status: { not: 'SOLD' } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { images: { orderBy: { order: 'asc' } } } },
          },
        },
        productVariant: { include: { images: { orderBy: { order: 'asc' } } } },
      },
    });
    await deleteUnavailableCustomerCartItems(req.customer.id, items);
    const data = items
      .filter((i) => !i.product.isDeleted && !isUnavailable(i.product))
      .filter((i) => !i.productVariant || i.productVariant.status === 'AVAILABLE')
      .map(serializeCartItem);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/cart/sync', requireCustomer, async (req, res, next) => {
  try {
    const { items, replace } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items requis' });
    }

    const updateCart = async (db) => {
      if (replace === true) {
        // Keep overlapping saves for one account in order, including across reloads.
        await db.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${req.customer.id} FOR UPDATE`;
      }
      const retained = [];
      for (const item of items) {
        const productId = Number(item.id || item.productId);
        let productVariantId = item.productVariantId ? Number(item.productVariantId) : null;
        const quantity = 1;
        if (!Number.isInteger(productId) || productId <= 0) continue;
        const product = await db.product.findUnique({
          where: { id: productId },
          select: {
            id: true, isDeleted: true, isDraft: true, soldOut: true,
            variants: { where: { status: 'AVAILABLE' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } },
          },
        });
        if (!product || product.isDeleted || product.isDraft || product.soldOut) continue;
        if (product.variants.length > 0) {
          if (!productVariantId && product.variants.length === 1) {
            productVariantId = product.variants[0].id;
          }
          if (!product.variants.some((variant) => variant.id === productVariantId)) continue;
        } else {
          productVariantId = null;
        }
        const existing = await db.cartItem.findFirst({
          where: { customerId: req.customer.id, productId, productVariantId },
        });
        if (existing) {
          await db.cartItem.update({ where: { id: existing.id }, data: { quantity } });
          retained.push(existing.id);
        } else {
          const created = await db.cartItem.create({ data: { customerId: req.customer.id, productId, productVariantId, quantity } });
          retained.push(created.id);
        }
      }
      if (replace === true) {
        await db.cartItem.deleteMany({
          where: { customerId: req.customer.id, ...(retained.length ? { id: { notIn: retained } } : {}) },
        });
      }
    };
    if (replace === true) await prisma.$transaction(updateCart);
    else await updateCart(prisma);

    const updated = await prisma.cartItem.findMany({
      where: { customerId: req.customer.id },
      include: {
        product: {
          select: {
            id: true, name: true, nameFr: true, nameEn: true, description: true, descriptionFr: true, descriptionEn: true, price: true, mainImageUrl: true, stockQuantity: true, soldOut: true, isDeleted: true, isDraft: true,
            reservations: { where: { expiresAt: { gt: new Date() } }, select: { quantity: true } },
            variants: { where: { status: { not: 'SOLD' } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { images: { orderBy: { order: 'asc' } } } },
          },
        },
        productVariant: { include: { images: { orderBy: { order: 'asc' } } } },
      },
    });
    await deleteUnavailableCustomerCartItems(req.customer.id, updated);
    const data = updated
      .filter((i) => !i.product.isDeleted && !isUnavailable(i.product))
      .filter((i) => !i.productVariant || i.productVariant.status === 'AVAILABLE')
      .map(serializeCartItem);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.delete('/cart', requireCustomer, async (req, res, next) => {
  try {
    await prisma.cartItem.deleteMany({ where: { customerId: req.customer.id } });
    res.json({ success: true, data: [] });
  } catch (err) {
    next(err);
  }
});

// ── Favorites routes ────────────────────────────────────────────────────────

router.get('/favorites', requireCustomer, async (req, res, next) => {
  try {
    const items = await prisma.favoriteItem.findMany({
      where: { customerId: req.customer.id },
      include: {
        product: {
          include: {
            images: { orderBy: { order: 'asc' } },
            category: true,
            reservations: { where: { expiresAt: { gt: new Date() } }, select: { quantity: true } },
            variants: { where: { status: { not: 'SOLD' } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        productVariant: { include: { images: { orderBy: { order: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await deleteUnavailableCustomerFavoriteItems(req.customer.id, items);

    const data = items
      .filter((i) => !isUnavailable(i.product))
      .map(serializeFavorite);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/favorites/sync', requireCustomer, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items requis' });
    }

    for (const item of items) {
      const productId = Number(item.id || item.productId);
      let productVariantId = item.productVariantId ? Number(item.productVariantId) : null;
      if (!Number.isInteger(productId)) continue;
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          isDeleted: false,
          isDraft: false,
          soldOut: false,
          stockQuantity: { gt: 0 },
        },
        select: {
          id: true,
          variants: { where: { status: 'AVAILABLE' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } },
        },
      });
      if (!product) continue;
      if (product.variants.length > 0) {
        if (!productVariantId) productVariantId = product.variants[0].id;
        if (!product.variants.some((variant) => variant.id === productVariantId)) continue;
      } else {
        productVariantId = null;
      }
      const existing = await prisma.favoriteItem.findFirst({
        where: { customerId: req.customer.id, productId, productVariantId },
      });
      if (!existing) {
        await prisma.favoriteItem.create({ data: { customerId: req.customer.id, productId, productVariantId } });
      }
    }

    const updated = await prisma.favoriteItem.findMany({
      where: { customerId: req.customer.id },
      include: {
        product: {
          include: {
            images: { orderBy: { order: 'asc' } },
            category: true,
            reservations: { where: { expiresAt: { gt: new Date() } }, select: { quantity: true } },
            variants: { where: { status: { not: 'SOLD' } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        productVariant: { include: { images: { orderBy: { order: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await deleteUnavailableCustomerFavoriteItems(req.customer.id, updated);

    const data = updated
      .filter((i) => !isUnavailable(i.product))
      .map(serializeFavorite);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/favorites/:productId', requireCustomer, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ success: false, message: 'Produit invalide' });
    }

    let productVariantId = req.body.productVariantId ? Number(req.body.productVariantId) : null;
    const product = await prisma.product.findFirst({
      where: { id: productId, isDeleted: false, isDraft: false },
      include: {
        reservations: { where: { expiresAt: { gt: new Date() } }, select: { quantity: true } },
        variants: { where: { status: 'AVAILABLE' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } },
      },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }
    if (isUnavailable(product)) {
      await prisma.favoriteItem.deleteMany({ where: { productId } });
      return res.status(409).json({ success: false, message: 'Produit vendu' });
    }
    if (product.variants.length > 0) {
      if (!productVariantId) productVariantId = product.variants[0].id;
      if (!product.variants.some((variant) => variant.id === productVariantId)) {
        return res.status(409).json({ success: false, message: 'Variation vendue' });
      }
    } else {
      productVariantId = null;
    }

    const existing = await prisma.favoriteItem.findFirst({
      where: { customerId: req.customer.id, productId, productVariantId },
    });
    if (!existing) {
      await prisma.favoriteItem.create({ data: { customerId: req.customer.id, productId, productVariantId } });
    }

    res.status(201).json({ success: true, data: { productId, productVariantId } });
  } catch (err) {
    next(err);
  }
});

router.delete('/favorites/:productId', requireCustomer, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ success: false, message: 'Produit invalide' });
    }
    const productVariantId = req.query.productVariantId ? Number(req.query.productVariantId) : null;

    await prisma.favoriteItem.deleteMany({
      where: {
        customerId: req.customer.id,
        productId,
        OR: Number.isInteger(productVariantId)
          ? [{ productVariantId }, { productVariantId: null }]
          : [{ productVariantId: null }],
      },
    });

    res.json({ success: true, data: { productId, productVariantId: Number.isInteger(productVariantId) ? productVariantId : null } });
  } catch (err) {
    next(err);
  }
});

// ── Profile & order history ─────────────────────────────────────────────────

router.get('/me', requireCustomer, async (req, res, next) => {
  try {
    const { passwordHash, isActive, ...customer } = req.customer;
    res.json({ success: true, data: await customerWithLatestContact(customer) });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id/invoice', requireCustomer, async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.customerEmail !== req.customer.email) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    if (!canDownloadInvoice(order)) {
      return res.status(400).json({ success: false, message: 'Facture disponible uniquement pour les commandes payées' });
    }

    let stripeInvoiceData = null;
    try {
      stripeInvoiceData = await getStripeInvoiceData(order);
    } catch (stripeErr) {
      console.error(`Failed to fetch Stripe invoice data for order #${order.id}:`, stripeErr.message);
    }

    const pdf = await generateInvoicePDF(order, stripeInvoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber(order)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.post('/me/delete-request', requireCustomer, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const { password } = req.body;
    const customer = req.customer;

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.customer.update({
      where: { id: customer.id },
      data: { deleteAccountToken: token, deleteAccountExpires: expires },
    });

    const frontendUrl = getStorefrontUrl(req);
    const confirmUrl = `${frontendUrl}/delete-account-confirmation?token=${token}`;

    try {
      const lang = languageFromRequest(req, customer.preferredLanguage || 'en');
      const en = isEnglish(lang);
      await sendEmail({
        to: customer.email,
        profile: 'system',
        lang,
        subject: en ? 'Confirm account deletion' : 'Confirmez la suppression de votre compte',
        text: en
          ? `Hello ${customer.name},\n\nYou asked to delete your Itsgenygarts account. Click the link below to confirm permanent deletion:\n\n${confirmUrl}\n\nThis link is valid for 1 hour. If you did not make this request, you can ignore this email.`
          : `Bonjour ${customer.name},\n\nVous avez demandé la suppression de votre compte Itsgenygarts. Cliquez sur le lien suivant pour confirmer la suppression définitive :\n\n${confirmUrl}\n\nCe lien est valide pendant 1 heure. Si vous n'avez pas fait cette demande, ignorez ce courriel.`,
        html: emailHtml({
          lang,
          title: en ? 'Confirm account deletion' : 'Confirmez la suppression de votre compte',
          recipientEmail: customer.email,
          footerEmail: systemFooterEmail(),
          content: en
            ? `<p>Hello <strong>${customer.name}</strong>,</p>
<p>You asked to delete your Itsgenygarts account. This action is permanent.</p>
${emailButton('Delete my account', confirmUrl)}
<p style="font-size:0.875rem;color:#8A7A6A;">This link is valid for <strong>1 hour</strong>. If you did not make this request, you can ignore this email.</p>`
            : `<p>Bonjour <strong>${customer.name}</strong>,</p>
<p>Vous avez demandé la suppression de votre compte Itsgenygarts. Cette action est définitive.</p>
${emailButton('Supprimer mon compte', confirmUrl)}
<p style="font-size:0.875rem;color:#8A7A6A;">Ce lien est valide pendant <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez ce courriel.</p>`,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send delete-account confirmation email:', emailErr.message);
      return res.status(500).json({ success: false, message: "Impossible d'envoyer le courriel de confirmation. Réessayez plus tard." });
    }

    res.json({ success: true, message: 'Un courriel de confirmation vous a été envoyé.' });
  } catch (err) {
    next(err);
  }
});

// GDPR right-to-erasure (art. 17).
// Anonymizes PII on historical orders (kept for accounting/tax obligations) and deletes the Customer row.
router.post('/delete-account/confirm', validate(confirmDeleteAccountSchema), async (req, res, next) => {
  try {
    const { token } = req.body;
    const customer = await prisma.customer.findUnique({ where: { deleteAccountToken: token } });

    if (!customer || !customer.deleteAccountExpires || customer.deleteAccountExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }

    await deleteCustomerAccount(customer);

    clearAuthCookie(res, 'customer');
    res.json({ success: true, message: 'Compte supprimé avec succès' });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', requireCustomer, async (req, res, next) => {
  try {
    const email = req.customer.email;

    const [orders, customOrders, personalizedQuotes] = await Promise.all([
      prisma.order.findMany({
        where: { customerEmail: email },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customOrder.findMany({
        where: { customerEmail: email },
        include: { images: true, productReference: true, customModelOption: true },
        orderBy: { createdAtUtc: 'desc' },
      }),
      prisma.personalizedQuote.findMany({
        where: { customerEmail: email },
        include: { images: true },
        orderBy: { createdAtUtc: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: protectPrivateMedia({ orders, customOrders, personalizedQuotes }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
