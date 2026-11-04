import { describe, it, expect } from '@jest/globals';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../src/schemas/auth.js';

describe('registerSchema', () => {
  it('accepts a valid payload', () => {
    const r = registerSchema.safeParse({
      name: 'Alice',
      email: 'ALICE@example.com',
      password: 'Secret1!',
      preferredLanguage: 'en',
    });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('alice@example.com');
    expect(r.data.name).toBe('Alice');
    expect(r.data.preferredLanguage).toBe('en');
  });

  it('rejects unsupported preferred languages', () => {
    const r = registerSchema.safeParse({
      name: 'Alice',
      email: 'a@b.co',
      password: 'Secret1!',
      preferredLanguage: 'es',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a name that is too short', () => {
    const r = registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'Secret1!' });
    expect(r.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const r = registerSchema.safeParse({ name: 'Alice', email: 'not-an-email', password: 'Secret1!' });
    expect(r.success).toBe(false);
  });

  it('rejects a password missing an uppercase letter', () => {
    const r = registerSchema.safeParse({ name: 'Alice', email: 'a@b.co', password: 'secret1!' });
    expect(r.success).toBe(false);
  });

  it('rejects a password missing a digit', () => {
    const r = registerSchema.safeParse({ name: 'Alice', email: 'a@b.co', password: 'Secretx!' });
    expect(r.success).toBe(false);
  });

  it('rejects a password missing a special char', () => {
    const r = registerSchema.safeParse({ name: 'Alice', email: 'a@b.co', password: 'Secret12' });
    expect(r.success).toBe(false);
  });

  it('rejects a password shorter than 8 chars', () => {
    const r = registerSchema.safeParse({ name: 'Alice', email: 'a@b.co', password: 'Aa1!' });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid payload', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'x' });
    expect(r.success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const r = loginSchema.safeParse({ email: '  BOB@Example.COM  ', password: 'x' });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('bob@example.com');
  });

  it('rejects empty password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: '' });
    expect(r.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const r = forgotPasswordSchema.safeParse({ email: 'a@b.co' });
    expect(r.success).toBe(true);
  });

  it('rejects a bad email', () => {
    const r = forgotPasswordSchema.safeParse({ email: 'nope' });
    expect(r.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid token + password', () => {
    const r = resetPasswordSchema.safeParse({ token: 'a'.repeat(12), password: 'Secret1!' });
    expect(r.success).toBe(true);
  });

  it('rejects a token shorter than 10 chars', () => {
    const r = resetPasswordSchema.safeParse({ token: 'abc', password: 'Secret1!' });
    expect(r.success).toBe(false);
  });

  it('rejects a password that does not match the policy', () => {
    const r = resetPasswordSchema.safeParse({ token: 'a'.repeat(12), password: 'weak' });
    expect(r.success).toBe(false);
  });
});
