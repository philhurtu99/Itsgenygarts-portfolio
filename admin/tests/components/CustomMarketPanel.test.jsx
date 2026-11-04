import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomMarketPanel from '../../src/pages/admin/CustomMarketPanel.jsx';
import { adminCreateMarketCustomOrder, adminGetCustomOrders, adminRecordCustomOrderPayment } from '../../src/services/api.js';

jest.mock('../../src/services/api.js', () => ({
  adminGetCustomOrders: jest.fn(async () => []),
  adminCreateMarketCustomOrder: jest.fn(async () => ({ id: 12, customerName: 'Alice', customerEmail: '', price: 50 })),
  adminRecordCustomOrderPayment: jest.fn(async () => ({})),
  adminCancelCustomTapToPayPayment: jest.fn(), adminCreateCustomTapToPayIntent: jest.fn(),
  adminCreateSessionToken: jest.fn(), adminSendCustomOrderPaymentLink: jest.fn(),
  adminSyncCustomTapToPayPayment: jest.fn(), adminUploadCustomOrderFinalImage: jest.fn(),
  getAdminAuthToken: jest.fn(), setAdminAuthToken: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

function fillOrder() {
  fireEvent.change(screen.getByLabelText('Nom du client'), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Bandana sur mesure' } });
  fireEvent.change(screen.getByLabelText('Prix total'), { target: { value: '50' } });
}

it('creates a custom order without email or phone', async () => {
  render(<CustomMarketPanel />);
  await waitFor(() => expect(adminGetCustomOrders).toHaveBeenCalled());
  fillOrder();
  expect(screen.getByLabelText(/Courriel/)).not.toBeRequired();
  expect(screen.getByLabelText(/Téléphone/)).not.toBeRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Aucun', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Créer la commande', exact: true }));
  await screen.findByText('Commande custom #12 enregistrée sans paiement.');
  const data = adminCreateMarketCustomOrder.mock.calls[0][0];
  expect(data.get('customerName')).toBe('Alice');
  expect(data.get('customerEmail')).toBe('');
  expect(data.get('customerPhone')).toBe('');
});

it('can collect a cash deposit without contact details and keeps email links unavailable', async () => {
  render(<CustomMarketPanel />);
  await waitFor(() => expect(adminGetCustomOrders).toHaveBeenCalled());
  fillOrder();
  expect(screen.getByRole('option', { name: 'Lien Stripe (courriel requis)' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Méthode'), { target: { value: 'CASH' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer et encaisser' }));
  await waitFor(() => expect(adminRecordCustomOrderPayment).toHaveBeenCalledWith(12, { amount: 25, kind: 'DEPOSIT', method: 'CASH' }));
  fireEvent.change(screen.getByLabelText(/Courriel/), { target: { value: 'alice@example.com' } });
  expect(screen.getByRole('option', { name: 'Lien Stripe (courriel requis)' })).not.toBeDisabled();
});
