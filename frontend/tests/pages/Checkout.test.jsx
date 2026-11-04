import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import en from '../../src/i18n/en.js';
import fr from '../../src/i18n/fr.js';

let mockLang = 'en';
const mockCart = {
  items: [{ id: 1, name: 'Hat', nameEn: 'Hat', quantity: 1, price: 25 }],
  cartTotal: 25, clearCart: jest.fn(), restoreCartItems: jest.fn(),
  syncCartOnLogin: jest.fn(), refreshCartAvailability: jest.fn(),
};

jest.mock('../../src/context/CartContext.jsx', () => ({ useCart: () => mockCart }));
jest.mock('../../src/context/CustomerAuthContext.jsx', () => ({
  useCustomerAuth: () => ({ customer: null, loginCustomer: jest.fn() }),
}));
jest.mock('../../src/context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ currency: 'CAD', formatPrice: (amount) => `${amount} CAD` }),
}));
jest.mock('../../src/context/LanguageContext.jsx', () => {
  const english = require('../../src/i18n/en.js').default;
  const french = require('../../src/i18n/fr.js').default;
  return {
    useLanguage: () => ({
      lang: mockLang,
      t: (key) => key.split('.').reduce((value, part) => value?.[part], mockLang === 'fr' ? french : english) || key,
    }),
  };
});
jest.mock('../../src/services/api.js', () => ({
  calculateShipping: jest.fn(), checkout: jest.fn(), cancelPendingOrder: jest.fn(),
  customerLogin: jest.fn(), customerRegister: jest.fn(),
}));
jest.mock('../../src/components/SeoHead.jsx', () => () => null);
jest.mock('../../src/components/AddressFields.jsx', () => ({ form, setForm }) => (
  <div>
    {['address', 'city', 'province', 'postalCode', 'country'].map((field) => (
      <input key={field} aria-label={field} value={form[field]} onChange={(event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))} />
    ))}
  </div>
));

import Checkout from '../../src/pages/Checkout.jsx';
import { calculateShipping, checkout } from '../../src/services/api.js';
import { siteConfig } from '../../src/config/site.js';

function tree() {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Checkout /></MemoryRouter>;
}

async function review(country = 'FR', quoteText = 'UPS Standard') {
  const view = render(tree());
  fireEvent.click(screen.getByRole('button', { name: en.checkout.continueAsGuest }));
  for (const [selector, value] of [['name', 'Alice'], ['email', 'alice@example.com'], ['tel', '2125555555']]) {
    fireEvent.change(document.querySelector(`input[autocomplete="${selector}"]`), { target: { value } });
  }
  for (const [field, value] of Object.entries({ address: '123 Broadway', city: 'New York', province: 'NY', postalCode: '10001', country })) {
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: en.checkout.continueToSummary }));
  await screen.findByText(quoteText);
  return view;
}

beforeEach(() => {
  mockLang = 'en';
  localStorage.clear();
  sessionStorage.clear();
  checkout.mockReset();
  calculateShipping.mockReset();
  checkout.mockRejectedValue(new Error('Stopped before payment'));
  calculateShipping.mockImplementation(async ({ country, customerLanguage }) => ({
    options: [
      { serviceCode: 'STANDARD', serviceName: 'UPS Standard', amountCad: 12, trackingIncluded: true },
      { serviceCode: 'EXPRESS', serviceName: 'UPS Express', amountCad: 20, trackingIncluded: true },
    ],
    importFeesPolicy: country === 'CA' ? null : {
      version: '2026-10-06-v1', language: customerLanguage,
      notice: (customerLanguage === 'fr' ? fr : en).checkout.importFeesNotice,
    },
  }));
});

describe('checkout import fees consent', () => {
  it('blocks a US address before the summary, shipping calculation or payment', async () => {
    render(tree());
    fireEvent.click(screen.getByRole('button', { name: en.checkout.continueAsGuest }));
    for (const [selector, value] of [['name', 'Alice'], ['email', 'alice@example.com'], ['tel', '2125555555']]) {
      fireEvent.change(document.querySelector(`input[autocomplete="${selector}"]`), { target: { value } });
    }
    for (const [field, value] of Object.entries({ address: '11 W 53rd St', city: 'New York', province: 'NY', postalCode: '10019', country: 'US' })) {
      fireEvent.change(screen.getByLabelText(field), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: en.checkout.continueToSummary }));
    expect(screen.getByRole('button', { name: en.checkout.continueToSummary })).toBeVisible();
    expect(screen.queryByRole('button', { name: en.checkout.proceedToPayment })).not.toBeInTheDocument();
    expect(calculateShipping).not.toHaveBeenCalled();
    expect(checkout).not.toHaveBeenCalled();
  });
  it('never presents a failed shipping quote as free shipping or a confirmed total', async () => {
    calculateShipping.mockRejectedValue(new Error('Shipping unavailable'));
    await review('FR', 'Shipping unavailable');
    expect(screen.queryByText(en.checkout.free)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.checkout.amountPending)).toHaveLength(2);
    expect(screen.getAllByText('25 CAD')).toHaveLength(2);
    expect(screen.getByRole('button', { name: en.checkout.proceedToPayment })).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(checkout).not.toHaveBeenCalled();
  });

  it('keeps a successful zero-cost quote valid and includes it in the confirmed total', async () => {
    calculateShipping.mockResolvedValue({ options: [{ serviceCode: 'STANDARD', serviceName: 'UPS Standard', amountCad: 0 }] });
    await review('CA');
    expect(screen.queryByText(en.checkout.amountPending)).not.toBeInTheDocument();
    expect(screen.getAllByText('25 CAD')).toHaveLength(3);
    expect(screen.getByRole('button', { name: en.checkout.proceedToPayment })).toBeEnabled();
  });
  it('places collapsed merchant details before payment and preserves them when switching language', async () => {
    const view = await review('CA');
    const summary = screen.getByText(en.checkout.merchantContact);
    const disclosure = summary.closest('details');
    const pay = screen.getByRole('button', { name: en.checkout.proceedToPayment });
    expect(disclosure).not.toHaveAttribute('open');
    expect(disclosure.compareDocumentPosition(pay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const address = disclosure.querySelector('address');
    expect(address).toHaveTextContent(siteConfig.businessAddress);
    expect(address).not.toBeVisible();
    fireEvent.click(summary);
    expect(address).toBeVisible();
    expect(screen.getByRole('link', { name: /555.*0100/ })).toHaveAttribute('href', 'tel:+15145550100');
    expect(checkout).not.toHaveBeenCalled();
    mockLang = 'fr';
    view.rerender(tree());
    expect(screen.getByText(fr.checkout.merchantContact)).toBeVisible();
    expect(address).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: fr.checkout.proceedToPayment })).toBeEnabled());
  });

  it('starts unchecked, blocks payment, and sends consent and version only after acceptance', async () => {
    await review();
    const checkbox = screen.getByRole('checkbox', { name: en.checkout.importFeesAcceptance });
    const pay = screen.getByRole('button', { name: en.checkout.proceedToPayment });
    expect(checkbox).not.toBeChecked();
    expect(pay).toBeDisabled();
    fireEvent.click(pay);
    expect(checkout).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    await waitFor(() => expect(checkout).toHaveBeenCalledWith(expect.objectContaining({
      importFeesAccepted: true, importFeesPolicyVersion: '2026-10-06-v1', customerLanguage: 'en',
    })));
  });

  it('does not require a customs checkbox for Canada', async () => {
    await review('CA');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const pay = screen.getByRole('button', { name: en.checkout.proceedToPayment });
    expect(pay).toBeEnabled();
    fireEvent.click(pay);
    await waitFor(() => expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ importFeesAccepted: false })));
  });

  it('clears consent when the service changes, including switching back', async () => {
    await review();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('radio', { name: /UPS Express/ }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /UPS Standard/ }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('clears consent and displays the new language without an extra shipping request on rerender', async () => {
    const view = await review();
    fireEvent.click(screen.getByRole('checkbox'));
    mockLang = 'fr';
    view.rerender(tree());
    await screen.findByText(fr.checkout.importFeesNotice);
    expect(screen.getByRole('checkbox', { name: fr.checkout.importFeesAcceptance })).not.toBeChecked();
    expect(screen.getByRole('button', { name: fr.checkout.proceedToPayment })).toBeDisabled();
    const callCount = calculateShipping.mock.calls.length;
    view.rerender(tree());
    expect(calculateShipping).toHaveBeenCalledTimes(callCount);
  });

  it('clears consent after editing the address', async () => {
    await review();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: en.checkout.editInfo }));
    fireEvent.change(screen.getByLabelText('address'), { target: { value: '456 Broadway' } });
    fireEvent.click(screen.getByRole('button', { name: en.checkout.continueToSummary }));
    await screen.findByText('UPS Standard');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('does not enable consent if the server has not supplied a policy version', async () => {
    calculateShipping.mockResolvedValue({ options: [{ serviceCode: 'STANDARD', serviceName: 'UPS Standard', amountCad: 12 }] });
    await review();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: en.checkout.proceedToPayment })).toBeDisabled();
  });
});
