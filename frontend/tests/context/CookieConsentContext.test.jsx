import { render, screen, act } from '@testing-library/react';
import {
  CookieConsentProvider,
  useCookieConsent,
} from '../../src/context/CookieConsentContext.jsx';

function Harness({ onCtx }) {
  const ctx = useCookieConsent();
  onCtx(ctx);
  return (
    <div>
      <p data-testid="analytics">{String(ctx.consent.analytics)}</p>
      <p data-testid="marketing">{String(ctx.consent.marketing)}</p>
      <p data-testid="decided">{String(ctx.consent.decided)}</p>
    </div>
  );
}

function renderWithCtx() {
  const capture = { current: null };
  render(
    <CookieConsentProvider>
      <Harness onCtx={(c) => (capture.current = c)} />
    </CookieConsentProvider>
  );
  return capture;
}

beforeEach(() => {
  localStorage.clear();
});

describe('CookieConsentContext', () => {
  it('defaults to essential-only, not-decided when no storage exists', () => {
    renderWithCtx();
    expect(screen.getByTestId('analytics').textContent).toBe('false');
    expect(screen.getByTestId('marketing').textContent).toBe('false');
    expect(screen.getByTestId('decided').textContent).toBe('false');
  });

  it('persists consent to localStorage on change', async () => {
    const ctx = renderWithCtx();
    await act(async () => {
      ctx.current.acceptAll();
    });
    const stored = JSON.parse(localStorage.getItem('cookie_consent_v1'));
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
    expect(stored.decided).toBe(true);
    expect(stored.essential).toBe(true);
  });

  it('hydrates from localStorage, forcing essential=true even if stored false', () => {
    localStorage.setItem(
      'cookie_consent_v1',
      JSON.stringify({ essential: false, analytics: true, decided: true }),
    );
    renderWithCtx();
    expect(screen.getByTestId('analytics').textContent).toBe('true');
    expect(screen.getByTestId('decided').textContent).toBe('true');
  });

  it('falls back to defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('cookie_consent_v1', '{{{ not json');
    renderWithCtx();
    expect(screen.getByTestId('analytics').textContent).toBe('false');
    expect(screen.getByTestId('decided').textContent).toBe('false');
  });

  it('rejectAll sets analytics/marketing false and decided true', async () => {
    const ctx = renderWithCtx();
    await act(async () => { ctx.current.rejectAll(); });
    expect(screen.getByTestId('analytics').textContent).toBe('false');
    expect(screen.getByTestId('marketing').textContent).toBe('false');
    expect(screen.getByTestId('decided').textContent).toBe('true');
  });

  it('savePreferences coerces values to booleans', async () => {
    const ctx = renderWithCtx();
    await act(async () => {
      ctx.current.savePreferences({ analytics: 1, marketing: 0 });
    });
    const stored = JSON.parse(localStorage.getItem('cookie_consent_v1'));
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(false);
  });

  it('reopen flips decided back to false without erasing choices', async () => {
    const ctx = renderWithCtx();
    await act(async () => { ctx.current.acceptAll(); });
    await act(async () => { ctx.current.reopen(); });
    expect(screen.getByTestId('decided').textContent).toBe('false');
    expect(screen.getByTestId('analytics').textContent).toBe('true');
  });

  it('throws when useCookieConsent is used outside the provider', () => {
    const err = console.error;
    console.error = jest.fn();
    function Dangling() { useCookieConsent(); return null; }
    expect(() => render(<Dangling />)).toThrow(/CookieConsentProvider/);
    console.error = err;
  });
});
