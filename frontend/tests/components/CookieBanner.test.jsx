import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CookieBanner from '../../src/components/CookieBanner.jsx';
import { CookieConsentProvider } from '../../src/context/CookieConsentContext.jsx';

jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    t: (key) => ({
      'cookies.title': 'Cookies',
      'cookies.description': 'Description cookies',
      'cookies.acceptAll': 'Tout accepter',
      'cookies.customize': 'Personnaliser',
      'cookies.preferences': 'Préférences',
      'cookies.essential': 'Essentiels',
      'cookies.essentialDesc': 'Nécessaires au site',
      'cookies.analytics': 'Statistiques',
      'cookies.analyticsDesc': 'Mesure audience',
      'cookies.marketing': 'Marketing',
      'cookies.marketingDesc': 'Publicité',
      'cookies.back': 'Retour',
      'cookies.rejectAll': 'Tout refuser',
      'cookies.save': 'Enregistrer',
      'legal.privacy': 'Confidentialité',
    }[key] || key),
  }),
}));

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderBanner() {
  return render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <CookieConsentProvider>
        <CookieBanner />
      </CookieConsentProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

describe('CookieBanner', () => {
  it('does not show again after consent has already been decided', () => {
    localStorage.setItem('cookie_consent_v1', JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      decided: true,
      updatedAt: '2026-05-13T00:00:00.000Z',
    }));

    renderBanner();
    act(() => { jest.advanceTimersByTime(3000); });

    expect(screen.queryByRole('dialog', { name: 'Cookies' })).not.toBeInTheDocument();
  });

  it('persists acceptance so the banner stays hidden after a refresh', () => {
    const { unmount } = renderBanner();
    act(() => { jest.advanceTimersByTime(3000); });

    fireEvent.click(screen.getByRole('button', { name: 'Tout accepter' }));
    expect(JSON.parse(localStorage.getItem('cookie_consent_v1')).decided).toBe(true);

    unmount();
    renderBanner();
    act(() => { jest.advanceTimersByTime(3000); });

    expect(screen.queryByRole('dialog', { name: 'Cookies' })).not.toBeInTheDocument();
  });
});
