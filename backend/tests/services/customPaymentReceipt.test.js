import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const sendEmail = jest.fn(async () => {});
const generateCustomPaymentInvoicePDF = jest.fn(async () => Buffer.from('%PDF custom'));
const customPaymentInvoiceNumber = jest.fn(() => 'FACT-CUSTOM-2026-000012-001');

jest.unstable_mockModule('../../src/services/email.js', () => ({ sendEmail }));
jest.unstable_mockModule('../../src/services/customPaymentInvoice.js', () => ({
  generateCustomPaymentInvoicePDF,
  customPaymentInvoiceNumber,
}));

const { sendCustomPaymentReceipt } = await import('../../src/services/customOrderPayments.js');

function makeOrder(overrides = {}) {
  return {
    id: 12,
    customerName: 'Alice',
    customerEmail: 'alice@test.com',
    customerLanguage: 'fr',
    price: 200,
    amountPaid: 100,
    images: [{ purpose: 'REFERENCE', storagePathOrUrl: 'https://cdn.test/reference.png' }],
    ...overrides,
  };
}

beforeEach(() => {
  sendEmail.mockClear();
  generateCustomPaymentInvoicePDF.mockClear();
  customPaymentInvoiceNumber.mockClear();
});

describe('custom payment receipt email', () => {
  it('skips sending a receipt when the customer has no email', async () => {
    await sendCustomPaymentReceipt(makeOrder({ customerEmail: '' }), { id: 1, amount: 50, kind: 'DEPOSIT' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(generateCustomPaymentInvoicePDF).not.toHaveBeenCalled();
  });
  it('sends the deposit receipt from the system profile with a PDF invoice', async () => {
    const order = makeOrder();
    const payment = { id: 1, amount: 100, kind: 'DEPOSIT', method: 'STRIPE_LINK' };

    await sendCustomPaymentReceipt(order, payment);

    expect(generateCustomPaymentInvoicePDF).toHaveBeenCalledWith(order, payment);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.com',
      profile: 'system',
      subject: 'Dépôt reçu pour la commande custom #12',
      attachments: [{
        filename: 'FACT-CUSTOM-2026-000012-001.pdf',
        content: expect.any(Buffer),
        contentType: 'application/pdf',
      }],
    }));
    expect(sendEmail.mock.calls[0][0].html).not.toContain('https://cdn.test/reference.png');
  });

  it('sends a completed-payment email when the final balance is paid', async () => {
    await sendCustomPaymentReceipt(
      makeOrder({ amountPaid: 200 }),
      { id: 2, amount: 100, kind: 'BALANCE', method: 'TAP_TO_PAY' },
    );

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      profile: 'system',
      subject: 'Paiement complété pour la commande custom #12',
      text: expect.stringContaining('maintenant payée en totalité'),
    }));
  });
});
