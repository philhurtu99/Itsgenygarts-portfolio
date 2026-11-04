import { render, screen, act, waitFor } from '@testing-library/react';

jest.mock('../../src/services/api.js', () => ({
  getCurrencies: jest.fn(),
}));

import { CurrencyProvider, useCurrency } from '../../src/context/CurrencyContext.jsx';
import { getCurrencies } from '../../src/services/api.js';

function Harness({ onCtx }) {
  const ctx = useCurrency();
  onCtx(ctx);
  return (
    <div>
      <p data-testid="currency">{ctx.currency}</p>
      <p data-testid="rate">{ctx.rate}</p>
      <p data-testid="symbol">{ctx.symbol}</p>
      <p data-testid="formatted">{ctx.formatPrice(100)}</p>
    </div>
  );
}

function renderWithCtx() {
  const capture = { current: null };
  render(
    <CurrencyProvider>
      <Harness onCtx={(c) => (capture.current = c)} />
    </CurrencyProvider>
  );
  return capture;
}

beforeEach(() => {
  localStorage.clear();
  getCurrencies.mockReset();
});

describe('CurrencyContext', () => {
  it('defaults to CAD with rate=1 and $ symbol when no storage and fetch rejects', async () => {
    getCurrencies.mockRejectedValueOnce(new Error('boom'));
    renderWithCtx();
    await waitFor(() => expect(getCurrencies).toHaveBeenCalled());
    expect(screen.getByTestId('currency').textContent).toBe('CAD');
    expect(screen.getByTestId('rate').textContent).toBe('1');
    expect(screen.getByTestId('symbol').textContent).toBe('$');
  });

  it('hydrates currency from localStorage', async () => {
    localStorage.setItem('currency', 'EUR');
    getCurrencies.mockResolvedValueOnce([
      { code: 'EUR', rate: '0.7', symbol: '€' },
      { code: 'CAD', rate: '1', symbol: '$' },
    ]);
    renderWithCtx();
    await waitFor(() =>
      expect(screen.getByTestId('rate').textContent).toBe('0.7'),
    );
    expect(screen.getByTestId('currency').textContent).toBe('EUR');
    expect(screen.getByTestId('symbol').textContent).toBe('€');
  });

  it('formatPrice multiplies by the rate and appends the symbol', async () => {
    getCurrencies.mockResolvedValueOnce([
      { code: 'CAD', rate: '1', symbol: '$' },
      { code: 'USD', rate: '0.75', symbol: 'US$' },
    ]);
    localStorage.setItem('currency', 'USD');
    renderWithCtx();
    await waitFor(() =>
      expect(screen.getByTestId('formatted').textContent).toBe('75.00 US$'),
    );
  });

  it('setCurrency updates state and persists to localStorage', async () => {
    getCurrencies.mockResolvedValueOnce([
      { code: 'CAD', rate: '1', symbol: '$' },
      { code: 'EUR', rate: '0.7', symbol: '€' },
    ]);
    const ctx = renderWithCtx();
    await waitFor(() => expect(getCurrencies).toHaveBeenCalled());
    await act(async () => { ctx.current.setCurrency('EUR'); });
    expect(screen.getByTestId('currency').textContent).toBe('EUR');
    expect(localStorage.getItem('currency')).toBe('EUR');
  });

  it('tolerates non-array API responses by falling back to []', async () => {
    getCurrencies.mockResolvedValueOnce({ not: 'an array' });
    renderWithCtx();
    await waitFor(() => expect(getCurrencies).toHaveBeenCalled());
    expect(screen.getByTestId('rate').textContent).toBe('1');
    expect(screen.getByTestId('symbol').textContent).toBe('$');
  });
});
