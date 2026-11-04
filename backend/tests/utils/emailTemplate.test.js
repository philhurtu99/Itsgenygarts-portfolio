import { describe, it, expect } from '@jest/globals';
import { emailHtml, emailButton, emailBox } from '../../src/utils/emailTemplate.js';
import { verifyNewsletterUnsubscribeToken } from '../../src/utils/newsletterUnsubscribe.js';

describe('emailHtml', () => {
  it('returns a full HTML document', () => {
    const out = emailHtml({ title: 'Welcome', content: '<p>Hi</p>' });
    expect(out).toContain('<!DOCTYPE html>');
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('<title>Welcome</title>');
    expect(out).toContain('<p>Hi</p>');
  });

  it('includes the business name from env in the header', () => {
    const out = emailHtml({ title: 't', content: '' });
    expect(out).toContain('TestShop');
  });

  it('escapes HTML-special chars in the title', () => {
    const out = emailHtml({ title: '<script>x</script>', content: '' });
    expect(out).not.toContain('<script>x</script>');
    expect(out).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  it('includes a mailto link when BUSINESS_EMAIL is set', () => {
    const out = emailHtml({ title: 't', content: '' });
    expect(out).toContain('mailto:test@shop.com');
  });

  it('can override the footer contact email for automated messages', () => {
    const out = emailHtml({ title: 't', content: '', footerEmail: 'notifications@test.local' });
    expect(out).toContain('mailto:notifications@test.local');
    expect(out).not.toContain('mailto:test@shop.com');
  });

  it('includes a signed newsletter unsubscribe link when recipientEmail is provided', () => {
    const out = emailHtml({ title: 't', content: '', recipientEmail: 'CLIENT@Example.com' });
    expect(out).toContain('/api/newsletter/unsubscribe?token=');
    expect(out).toContain('unsubscribe from newsletters');

    const token = decodeURIComponent(out.match(/unsubscribe\?token=([^"]+)/)[1]);
    expect(verifyNewsletterUnsubscribeToken(token)).toBe('client@example.com');
  });
});

describe('emailButton', () => {
  it('renders a link with the given text and href', () => {
    const out = emailButton('Click', 'https://example.com');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('>Click</a>');
  });

  it('escapes HTML in the button text', () => {
    const out = emailButton('<b>x</b>', 'https://ex.com');
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('emailBox', () => {
  it('wraps arbitrary HTML in a styled box', () => {
    const out = emailBox('<p>Info</p>');
    expect(out).toContain('<p>Info</p>');
    expect(out).toMatch(/<div[^>]*>.*<p>Info<\/p>.*<\/div>/s);
  });
});
