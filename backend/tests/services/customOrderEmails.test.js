import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const sendEmail = jest.fn(async () => {});

jest.unstable_mockModule('../../src/services/email.js', () => ({ sendEmail }));

const {
  isNewCustomShippedTransition,
  sendCustomOrderShippedEmail,
} = await import('../../src/services/customOrderEmails.js');

beforeEach(() => {
  sendEmail.mockClear();
});

describe('custom order shipping emails', () => {
  it('recognizes only a new transition to SHIPPED', () => {
    expect(isNewCustomShippedTransition('IN_PRODUCTION', 'SHIPPED')).toBe(true);
    expect(isNewCustomShippedTransition('SHIPPED', 'SHIPPED')).toBe(false);
    expect(isNewCustomShippedTransition('PAID', 'IN_PRODUCTION')).toBe(false);
  });

  it('sends the French shipping email from the notifications profile', async () => {
    await sendCustomOrderShippedEmail({
      id: 12,
      category: 'Peluche personnalisée',
      customerName: 'Alice',
      customerEmail: 'alice@test.com',
      customerLanguage: 'fr',
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.com',
      profile: 'system',
      lang: 'fr',
      subject: 'Votre commande sur mesure #12 est expédiée',
      text: expect.stringContaining('a été expédiée et est en route vers vous'),
    }));
    expect(sendEmail.mock.calls[0][0].html).toContain('notifications@example.test');
  });

  it('uses English for an English-speaking customer', async () => {
    await sendCustomOrderShippedEmail({
      id: 13,
      category: 'Custom plush',
      customerName: 'Alex',
      customerEmail: 'alex@test.com',
      customerLanguage: 'en',
    });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Your custom order #13 has shipped',
      text: expect.stringContaining('has shipped and is on its way to you'),
    }));
  });
});
