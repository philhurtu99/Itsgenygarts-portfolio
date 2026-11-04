import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mockLogoutCustomer = jest.fn();

jest.mock('../../src/context/CartContext.jsx', () => ({
  useCart: () => ({
    items: [],
    removeFromCart: jest.fn(),
    refreshCartAvailability: jest.fn(),
    cartCount: 0,
    cartTotal: 0,
  }),
}));

jest.mock('../../src/context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ formatPrice: (n) => `${n} $` }),
}));

jest.mock('../../src/context/FavoriteContext.jsx', () => ({
  useFavorites: () => ({ favoriteCount: 0 }),
}));

jest.mock('../../src/context/CustomerAuthContext.jsx', () => ({
  useCustomerAuth: () => ({
    isLoggedIn: true,
    ready: true,
    customer: { name: 'Alice Client' },
    logoutCustomer: mockLogoutCustomer,
  }),
}));

jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    t: (key) => ({
      'nav.home': 'Accueil',
      'nav.products': 'Produits',
      'nav.yarn': 'Laines',
      'nav.custom': 'Sur mesure',
      'nav.favorites': 'Favoris',
      'nav.cart': 'Panier',
      'nav.profile': 'Profil',
      'nav.logout': 'Déconnexion',
      'cart.title': 'Panier',
      'cart.empty': 'Panier vide',
      'cart.viewProducts': 'Voir les produits',
      'cart.checkout': 'Commander',
      'cart.remove': 'Retirer',
      'cart.total': 'Total',
    }[key] || key),
  }),
}));

import Navbar from '../../src/components/Navbar.jsx';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderNavbarAt(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]} future={ROUTER_FUTURE}>
      <Navbar />
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockLogoutCustomer.mockReset();
  mockLogoutCustomer.mockResolvedValue(undefined);
});

describe('Navbar', () => {
  it.each(['/cart', '/favorites'])('redirects to home after logout from %s', async (pathname) => {
    renderNavbarAt(pathname);

    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    await waitFor(() => expect(mockLogoutCustomer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
  });

  it('keeps the current page after logout outside cart and favorites', async () => {
    renderNavbarAt('/products');

    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    await waitFor(() => expect(mockLogoutCustomer).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location').textContent).toBe('/products');
  });
});
