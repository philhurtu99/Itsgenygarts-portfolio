import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

jest.mock('../../src/services/api.js', () => ({
  adminGetProducts: jest.fn(),
  adminGetOrders: jest.fn(),
  adminGetCustomOrders: jest.fn(),
  adminGetPersonalizedQuotes: jest.fn(),
  adminGetAnalyticsOverview: jest.fn(),
  adminMe: jest.fn(),
  adminLogout: jest.fn(),
}));

jest.mock('../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ logout: jest.fn() }),
}));

import Dashboard from '../../src/pages/admin/Dashboard.jsx';
import { adminGetProducts, adminGetOrders, adminGetCustomOrders, adminGetPersonalizedQuotes, adminGetAnalyticsOverview } from '../../src/services/api.js';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderDashboard() {
  return render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <Dashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  adminGetProducts.mockReset();
  adminGetOrders.mockReset();
  adminGetCustomOrders.mockReset();
  adminGetPersonalizedQuotes.mockReset();
  adminGetAnalyticsOverview.mockReset();
});

describe('Dashboard page', () => {
  it('renders loading state then shows stats', async () => {
    adminGetProducts.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    adminGetOrders.mockResolvedValue([{ id: 1, status: 'PAID' }]);
    adminGetCustomOrders.mockResolvedValue([{ id: 1, status: 'NEW' }]);
    adminGetPersonalizedQuotes.mockResolvedValue([{ id: 1, status: 'NEW' }]);
    adminGetAnalyticsOverview.mockResolvedValue(null);
    renderDashboard();
    await waitFor(() => expect(adminGetProducts).toHaveBeenCalled());
  });

  it('shows notifications for paid regular orders', async () => {
    adminGetProducts.mockResolvedValue([]);
    adminGetOrders.mockResolvedValue([
      { id: 1, customerName: 'Alice', status: 'PAID', createdAt: '2026-05-07T12:00:00.000Z' },
      { id: 2, customerName: 'Bob', status: 'PREPARING', createdAt: '2026-05-06T12:00:00.000Z' },
    ]);
    adminGetCustomOrders.mockResolvedValue([]);
    adminGetPersonalizedQuotes.mockResolvedValue([]);
    adminGetAnalyticsOverview.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('1 commande régulière payée à traiter')).toBeInTheDocument();
  });

  it('does not show paid regular order notifications for completed market sales', async () => {
    adminGetProducts.mockResolvedValue([]);
    adminGetOrders.mockResolvedValue([
      {
        id: 1,
        customerName: 'Client marché',
        status: 'PAID',
        stripePaymentId: 'market-bundle-interac-1',
        customerAddress: 'Vente en personne',
        customerCity: 'Marché',
        customerPostalCode: 'POS',
        createdAt: '2026-05-07T12:00:00.000Z',
      },
    ]);
    adminGetCustomOrders.mockResolvedValue([]);
    adminGetPersonalizedQuotes.mockResolvedValue([]);
    adminGetAnalyticsOverview.mockResolvedValue(null);

    renderDashboard();

    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument());
    expect(screen.queryByText(/commande régulière payée à traiter/)).not.toBeInTheDocument();
  });

  it('does not show paid regular order notifications for in-person Tap to Pay sales', async () => {
    adminGetProducts.mockResolvedValue([]);
    adminGetOrders.mockResolvedValue([
      {
        id: 1,
        customerName: 'Client marché',
        status: 'PAID',
        stripePaymentId: 'pi_test_123',
        stripeSessionId: null,
        customerAddress: 'Vente en personne',
        customerCity: 'Marché',
        customerPostalCode: 'POS',
        createdAt: '2026-05-07T12:00:00.000Z',
      },
    ]);
    adminGetCustomOrders.mockResolvedValue([]);
    adminGetPersonalizedQuotes.mockResolvedValue([]);
    adminGetAnalyticsOverview.mockResolvedValue(null);

    renderDashboard();

    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument());
    expect(screen.queryByText(/commande régulière payée à traiter/)).not.toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    adminGetProducts.mockRejectedValue(new Error('Server error'));
    adminGetOrders.mockRejectedValue(new Error('Server error'));
    adminGetCustomOrders.mockRejectedValue(new Error('Server error'));
    adminGetPersonalizedQuotes.mockRejectedValue(new Error('Server error'));
    adminGetAnalyticsOverview.mockRejectedValue(new Error('Server error'));
    renderDashboard();
    await waitFor(() => expect(adminGetProducts).toHaveBeenCalled());
    // Should not throw — just render without data
  });
});


it('makes each entire stats card navigate to its matching section', async () => {
  adminGetProducts.mockResolvedValue([{ id: 1 }]);
  adminGetOrders.mockResolvedValue([]);
  adminGetCustomOrders.mockResolvedValue([]);
  adminGetPersonalizedQuotes.mockResolvedValue([]);
  adminGetAnalyticsOverview.mockResolvedValue(null);
  function CurrentPath() { return <output data-testid="current-path">{useLocation().pathname}</output>; }
  const { container } = render(<MemoryRouter future={ROUTER_FUTURE}><Dashboard /><CurrentPath /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.stats-grid')).toBeInTheDocument());
  const cards = within(container.querySelector('.stats-grid'));
  for (const [label, path] of [['Produits', '/products'], ['Commandes', '/orders'], ['Commandes custom', '/custom-orders'], ['Devis', '/personalized-quotes']]) {
    const card = cards.getByRole('link', { name: new RegExp(`^${label} \\d+$`) });
    expect(card).toHaveAttribute('href', path);
    fireEvent.click(card);
    expect(screen.getByTestId('current-path')).toHaveTextContent(path);
  }
});
