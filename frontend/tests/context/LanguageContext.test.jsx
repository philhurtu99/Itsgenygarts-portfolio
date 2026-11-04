import { render, screen, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../../src/context/LanguageContext.jsx';

function Harness({ onCtx, translationKey = 'nav.home', vars }) {
  const ctx = useLanguage();
  onCtx?.(ctx);
  return (
    <div>
      <p data-testid="lang">{ctx.lang}</p>
      <p data-testid="t">{ctx.t(translationKey, vars)}</p>
    </div>
  );
}

function renderWith({ onCtx, translationKey, vars } = {}) {
  const capture = { current: null };
  render(
    <LanguageProvider>
      <Harness
        onCtx={(c) => {
          capture.current = c;
          onCtx?.(c);
        }}
        translationKey={translationKey}
        vars={vars}
      />
    </LanguageProvider>
  );
  return capture;
}

const ORIGINAL_LANG = Object.getOwnPropertyDescriptor(navigator, 'language');

function mockNavigatorLanguage(value) {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  localStorage.clear();
  mockNavigatorLanguage('fr-CA');
});

afterAll(() => {
  if (ORIGINAL_LANG) Object.defineProperty(navigator, 'language', ORIGINAL_LANG);
});

describe('LanguageContext', () => {
  it('hydrates language from localStorage when present', () => {
    localStorage.setItem('lang', 'en');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('t').textContent).toBe('Home');
  });

  it('falls back to fr when navigator.language is not "en"', () => {
    mockNavigatorLanguage('fr-CA');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('fr');
    expect(screen.getByTestId('t').textContent).toBe('Accueil');
  });

  it('chooses en when the browser language starts with "en"', () => {
    mockNavigatorLanguage('en-US');
    renderWith();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('t').textContent).toBe('Home');
  });

  it('setLang persists to localStorage and re-renders translations', async () => {
    const ctx = renderWith();
    expect(screen.getByTestId('t').textContent).toBe('Accueil');
    await act(async () => { ctx.current.setLang('en'); });
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('t').textContent).toBe('Home');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('returns the raw key when the translation is missing in both languages', () => {
    renderWith({ translationKey: 'totally.missing.key' });
    expect(screen.getByTestId('t').textContent).toBe('totally.missing.key');
  });

  it('substitutes {var} placeholders with the provided values when the translation contains them', () => {
    renderWith({
      translationKey: 'products.onlyLeft',
      vars: { n: 3 },
    });
    const raw = screen.getByTestId('t').textContent;
    expect(raw).not.toContain('{n}');
    expect(raw).toContain('3');
  });

  it('keeps {var} as-is when no matching value is provided', () => {
    renderWith({
      translationKey: 'products.onlyLeft',
      vars: { other: 'ignored' },
    });
    const raw = screen.getByTestId('t').textContent;
    expect(raw).toContain('{n}');
  });
});
