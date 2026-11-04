import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}));

const { sendEmail } = await import('../../src/services/email.js');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  sendMailMock.mockResolvedValue({ messageId: 'abc' });
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user@test.local';
  process.env.SMTP_PASS = 'pw';
  process.env.SMTP_FROM = 'noreply@test.local';
  process.env.BUSINESS_NAME = 'Crochet Test';
  process.env.BUSINESS_EMAIL = 'contact@test.local';
  delete process.env.NOTIFICATIONS_FROM;
  delete process.env.NOTIFICATIONS_SMTP_FROM;
  delete process.env.NOTIFICATIONS_SMTP_HOST;
  delete process.env.NOTIFICATIONS_SMTP_PORT;
  delete process.env.NOTIFICATIONS_SMTP_USER;
  delete process.env.NOTIFICATIONS_SMTP_PASS;
  delete process.env.NOTIFICATIONS_EMAIL;
  delete process.env.NOTIFICATIONS_REPLY_TO;
  delete process.env.SYSTEM_FROM;
  delete process.env.SYSTEM_SMTP_FROM;
  delete process.env.SYSTEM_EMAIL;
  delete process.env.SMTP_REPLY_TO;
  delete process.env.BUSINESS_FROM;
  delete process.env.BUSINESS_REPLY_TO;
  delete process.env.BUSINESS_SMTP_HOST;
  delete process.env.BUSINESS_SMTP_PORT;
  delete process.env.BUSINESS_SMTP_USER;
  delete process.env.BUSINESS_SMTP_PASS;
  delete process.env.DKIM_DOMAIN;
  delete process.env.DKIM_SELECTOR;
  delete process.env.DKIM_PRIVATE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('sendEmail', () => {
  it('builds a transport with the SMTP env vars and sends the message', async () => {
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'Hello' });
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.test.local',
      port: 587,
      secure: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: 'user@test.local', pass: 'pw' },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const [args] = sendMailMock.mock.calls[0];
    expect(args.to).toBe('x@y.z');
    expect(args.subject).toBe('Hi');
    expect(args.text).toContain('Hello');
    expect(args.text).toContain('Unsubscribe from newsletters:');
    expect(args.from).toBe('"Crochet Test" <notifications@example.test>');
    expect(args.sender).toBe('notifications@example.test');
    expect(args.replyTo).toBe('contact@test.local');
    expect(args.envelope).toEqual({ from: 'user@test.local', to: ['x@y.z'] });
    expect(args.headers['List-Unsubscribe']).toContain('/api/newsletter/unsubscribe?token=');
    expect(args.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('flags secure=true when port is 465', async () => {
    process.env.SMTP_PORT = '465';
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'Hello' });
    expect(createTransportMock.mock.calls[0][0].secure).toBe(true);
  });

  it('defaults port to 587 when SMTP_PORT is missing or invalid', async () => {
    delete process.env.SMTP_PORT;
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'Hello' });
    expect(createTransportMock.mock.calls[0][0].port).toBe(587);
  });

  it('derives html from text by replacing newlines with <br> when html is omitted', async () => {
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'line1\nline2' });
    const [args] = sendMailMock.mock.calls[0];
    expect(args.html).toContain('line1<br>line2');
    expect(args.html).toContain('Unsubscribe from newsletters:');
  });

  it('uses the provided html when given, untouched', async () => {
    await sendEmail({
      to: 'x@y.z',
      subject: 'Hi',
      text: 'plain',
      html: '<p>rich</p>',
    });
    expect(sendMailMock.mock.calls[0][0].html).toBe('<p>rich</p>');
  });

  it('forwards attachments when provided', async () => {
    const attachments = [{ filename: 'a.pdf', content: Buffer.from('x') }];
    await sendEmail({
      to: 'x@y.z',
      subject: 'Hi',
      text: 'plain',
      attachments,
    });
    expect(sendMailMock.mock.calls[0][0].attachments).toBe(attachments);
  });

  it('does not include an attachments field when none provided', async () => {
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' });
    expect('attachments' in sendMailMock.mock.calls[0][0]).toBe(false);
  });

  it('falls back to the default notifications address for system email', async () => {
    delete process.env.SMTP_FROM;
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].from).toBe('"Crochet Test" <notifications@example.test>');
    expect(sendMailMock.mock.calls[0][0].sender).toBe('notifications@example.test');
  });

  it('uses SMTP_REPLY_TO before BUSINESS_EMAIL when no notifications reply-to is configured', async () => {
    process.env.SMTP_REPLY_TO = 'support@test.local';
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('support@test.local');
  });

  it('uses notifications reply-to before the generic SMTP reply-to for system profile', async () => {
    process.env.SMTP_REPLY_TO = 'support@test.local';
    process.env.NOTIFICATIONS_REPLY_TO = 'notifications@test.local';
    await sendEmail({ to: 'x@y.z', profile: 'system', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('notifications@test.local');
  });

  it('uses the notifications address as the visible from address for system profile', async () => {
    process.env.NOTIFICATIONS_FROM = 'Itsgenygarts <notifications@example.test>';
    process.env.NOTIFICATIONS_EMAIL = 'notifications@example.test';
    await sendEmail({ to: 'x@y.z', profile: 'system', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].from).toBe('Itsgenygarts <notifications@example.test>');
    expect(sendMailMock.mock.calls[0][0].sender).toBe('notifications@example.test');
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('notifications@example.test');
  });

  it('can derive the system from address from NOTIFICATIONS_EMAIL', async () => {
    delete process.env.SMTP_FROM;
    process.env.NOTIFICATIONS_EMAIL = 'notifications@example.test';
    await sendEmail({ to: 'x@y.z', profile: 'system', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].from).toBe('"Crochet Test" <notifications@example.test>');
    expect(sendMailMock.mock.calls[0][0].sender).toBe('notifications@example.test');
  });

  it('can use a separate SMTP login for system notifications when configured', async () => {
    process.env.NOTIFICATIONS_SMTP_USER = 'notifications@example.test';
    process.env.NOTIFICATIONS_SMTP_PASS = 'notifications-pw';
    process.env.NOTIFICATIONS_FROM = 'Itsgenygarts <notifications@example.test>';
    await sendEmail({ to: 'x@y.z', profile: 'system', subject: 'Hi', text: 'plain' });
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: 'notifications@example.test', pass: 'notifications-pw' },
    }));
    expect(sendMailMock.mock.calls[0][0].from).toBe('Itsgenygarts <notifications@example.test>');
    expect(sendMailMock.mock.calls[0][0].envelope).toEqual({ from: 'notifications@example.test', to: ['x@y.z'] });
  });

  it('uses BUSINESS_EMAIL as the visible from address for business profile', async () => {
    await sendEmail({ to: 'x@y.z', profile: 'business', subject: 'Hi', text: 'plain' });
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: 'user@test.local', pass: 'pw' },
    }));
    expect(sendMailMock.mock.calls[0][0].from).toBe('"Crochet Test" <contact@test.local>');
    expect(sendMailMock.mock.calls[0][0].sender).toBe('contact@test.local');
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('contact@test.local');
    expect(sendMailMock.mock.calls[0][0].envelope).toEqual({ from: 'user@test.local', to: ['x@y.z'] });
  });

  it('can use a separate SMTP login for business profile when configured', async () => {
    process.env.BUSINESS_SMTP_USER = 'contact@test.local';
    process.env.BUSINESS_SMTP_PASS = 'business-pw';
    process.env.BUSINESS_FROM = 'Shop <contact@test.local>';
    process.env.BUSINESS_REPLY_TO = 'owner@test.local';
    await sendEmail({ to: 'x@y.z', profile: 'business', subject: 'Hi', text: 'plain' });
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: 'contact@test.local', pass: 'business-pw' },
    }));
    expect(sendMailMock.mock.calls[0][0].from).toBe('Shop <contact@test.local>');
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('owner@test.local');
    expect(sendMailMock.mock.calls[0][0].envelope).toEqual({ from: 'contact@test.local', to: ['x@y.z'] });
  });

  it('normalizes comma-separated recipients for provider-independent delivery', async () => {
    await sendEmail({ to: 'a@outlook.com, b@yahoo.com', subject: 'Hi', text: 'plain' });
    expect(sendMailMock.mock.calls[0][0].to).toBe('a@outlook.com, b@yahoo.com');
    expect(sendMailMock.mock.calls[0][0].envelope.to).toEqual(['a@outlook.com', 'b@yahoo.com']);
  });

  it('throws when recipient address is invalid', async () => {
    await expect(
      sendEmail({ to: 'not-an-email', subject: 'Hi', text: 'plain' }),
    ).rejects.toThrow(/Adresse courriel destinataire invalide/);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('adds DKIM configuration when env vars are present', async () => {
    process.env.DKIM_DOMAIN = 'test.local';
    process.env.DKIM_SELECTOR = 'default';
    process.env.DKIM_PRIVATE_KEY = 'line1\\nline2';
    await sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' });
    expect(createTransportMock.mock.calls[0][0].dkim).toEqual({
      domainName: 'test.local',
      keySelector: 'default',
      privateKey: 'line1\nline2',
    });
  });

  it('throws a descriptive error when SMTP_HOST is missing', async () => {
    delete process.env.SMTP_HOST;
    await expect(
      sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' }),
    ).rejects.toThrow(/Configuration SMTP manquante/);
  });

  it('throws when SMTP_USER is missing', async () => {
    delete process.env.SMTP_USER;
    await expect(
      sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' }),
    ).rejects.toThrow(/Configuration SMTP manquante/);
  });

  it('throws when SMTP_PASS is missing', async () => {
    delete process.env.SMTP_PASS;
    await expect(
      sendEmail({ to: 'x@y.z', subject: 'Hi', text: 'plain' }),
    ).rejects.toThrow(/Configuration SMTP manquante/);
  });
});
