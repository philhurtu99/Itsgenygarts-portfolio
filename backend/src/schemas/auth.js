import { z } from 'zod';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(100, 'Nom trop long'),
  email: z.string().trim().toLowerCase().email('Email invalide').max(255),
  password: z.string().regex(PASSWORD_REGEX, 'Mot de passe: 8+ caractères, majuscule, chiffre, caractère spécial'),
  newsletterConsent: z.boolean().optional().default(false),
  preferredLanguage: z.enum(['fr', 'en']).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token invalide'),
  password: z.string().regex(PASSWORD_REGEX, 'Mot de passe: 8+ caractères, majuscule, chiffre, caractère spécial'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis pour confirmer la suppression'),
});

export const confirmDeleteAccountSchema = z.object({
  token: z.string().min(10, 'Token invalide'),
});
