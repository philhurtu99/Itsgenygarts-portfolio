import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { importFeesPolicy } from '../../src/utils/importFeesPolicy.js';

const sendEmail = jest.fn(async () => {});
const generateInvoicePDF = jest.fn(async () => Buffer.from('%PDF'));
const getStripeInvoiceData = jest.fn(async () => null);
const emailHtml = jest.fn(() => '<html>');

jest.unstable_mockModule('../../src/services/email.js', () => ({
  sendEmail,
}));

jest.unstable_mockModule('../../src/services/invoice.js', () => ({
  generateInvoicePDF,
  invoiceNumber: jest.fn(() => 'FACT-2026-000001'),
}));

jest.unstable_mockModule('../../src/services/stripeInvoice.js', () => ({
  getStripeInvoiceData,
}));

jest.unstable_mockModule('../../src/utils/emailTemplate.js', () => ({
  emailHtml,
  emailBox: jest.fn((content) => content),
  emailButton: jest.fn((text, href) => `<a href="${href}">${text}</a>`),
  emailEscape: jest.fn((content) => String(content || '')),
}));

const {
  resolveOrderNotificationRecipients,
  sendPaidOrderEmails,
} = await import('../../src/services/orderEmails.js');

const ORIGINAL_ENV = { ...process.env };

const fakeOrder = {
  id: 12,
  customerLanguage: 'fr',
  customerName: 'Alice',
  customerEmail: 'alice@test.local',
  customerPhone: '514-555-0100',
  customerAddress: '1 rue Test',
  customerCity: 'Montreal',
  customerProvince: 'QC',
  customerPostalCode: 'H1A 1A1',
  customerCountry: 'CA',
  total: 42,
  currency: 'CAD',
  paidAt: new Date('2026-06-23T20:30:00.000Z'),
  items: [
    { productName: 'Tuque', quantity: 1, subtotal: 42, productImageUrl: 'https://cdn.test/tuque.jpg' },
  ],
};

const singleMarketSaleOrder = {
  ...fakeOrder,
  id: 13,
  stripePaymentId: 'market-bundle-interac-13',
  items: [
    { productName: 'Tuque', quantity: 1, subtotal: 42, productImageUrl: 'https://cdn.test/tuque.jpg' },
  ],
};

beforeEach(() => {
  sendEmail.mockClear();
  generateInvoicePDF.mockClear();
  getStripeInvoiceData.mockClear();
  emailHtml.mockClear();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ORDER_NOTIFICATION_EMAIL;
  delete process.env.ADMIN_EMAIL;
  delete process.env.BUSINESS_EMAIL;
  process.env.PUBLIC_API_URL = 'https://api.test.local/api';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('orderEmails', () => {
  it.each(['en', 'fr'])('includes the accepted %s import notice in the confirmation text and HTML', async (customerLanguage) => {
    const notice = importFeesPolicy(customerLanguage).notice;
    await sendPaidOrderEmails({
      ...fakeOrder, customerCountry: 'US', customerLanguage, importFeesPolicyText: notice,
    }, { prisma: { user: { findMany: jest.fn(async () => []) } } });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ profile: 'system', text: expect.stringContaining(notice) }));
    expect(emailHtml).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(notice) }));
  });

  it('does not include the import notice in domestic confirmation emails', async () => {
    await sendPaidOrderEmails(fakeOrder, { prisma: { user: { findMany: jest.fn(async () => []) } } });
    expect(sendEmail.mock.calls[0][0].text).not.toContain(importFeesPolicy('fr').notice);
  });
  it('resolves configured recipients and active admin user emails without duplicates', async () => {
    process.env.ORDER_NOTIFICATION_EMAIL = 'orders@test.local, owner@test.local';
    process.env.ADMIN_EMAIL = 'admin@test.local';
    process.env.BUSINESS_EMAIL = 'owner@test.local';
    const prisma = {
      user: {
        findMany: jest.fn(async () => [
          { email: 'admin@test.local' },
          { email: 'second-admin@test.local' },
        ]),
      },
    };

    const recipients = await resolveOrderNotificationRecipients(prisma);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });
    expect(recipients).toEqual([
      'orders@test.local',
      'owner@test.local',
      'admin@test.local',
      'second-admin@test.local',
    ]);
  });

  it('sends paid order emails to the customer and admin recipients', async () => {
    process.env.BUSINESS_EMAIL = 'contact@test.local';
    const prisma = {
      user: {
        findMany: jest.fn(async () => [{ email: 'admin@test.local' }]),
      },
    };

    await sendPaidOrderEmails(fakeOrder, { prisma });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.local',
      subject: 'Confirmation de votre commande #12',
      text: expect.stringContaining('Date du paiement: 2026-06-23 16 h 30 heure de Montréal'),
      attachments: [expect.objectContaining({
        filename: 'FACT-2026-000001.pdf',
        contentType: 'application/pdf',
      })],
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.local',
      text: expect.stringContaining('https://api.test.local/api/orders/12/invoice?token='),
    }));
    expect(emailHtml).toHaveBeenCalledWith(expect.objectContaining({
      footerEmail: 'notifications@example.test',
      content: expect.stringContaining('https://cdn.test/tuque.jpg'),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['contact@test.local', 'admin@test.local'],
      subject: 'Nouvelle commande payée #12',
    }));
  });

  it('labels a one-item market cart sale as an in-person sale', async () => {
    const prisma = {
      user: {
        findMany: jest.fn(async () => []),
      },
    };

    await sendPaidOrderEmails(singleMarketSaleOrder, { prisma });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.local',
      text: expect.stringContaining('Méthode de paiement: Vente en personne'),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.local',
      text: expect.not.stringContaining('Méthode de paiement: Vente groupée en personne'),
    }));
  });

  it('skips the customer receipt for anonymous POS addresses but still notifies the admin', async () => {
    const prisma = {
      user: {
        findMany: jest.fn(async () => [{ email: 'admin@test.local' }]),
      },
    };

    await sendPaidOrderEmails({
      ...singleMarketSaleOrder,
      customerEmail: 'market-bundle-123@pos.local',
    }, { prisma });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['admin@test.local'],
      subject: 'Nouvelle commande payée #13',
    }));
    expect(generateInvoicePDF).not.toHaveBeenCalled();
  });
});
