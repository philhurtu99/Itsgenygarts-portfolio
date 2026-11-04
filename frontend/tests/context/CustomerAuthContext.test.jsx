import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

jest.mock('../../src/services/api.js', () => ({
  getCustomerProfile: jest.fn(),
  customerLogout: jest.fn(),
}));

import { CustomerAuthProvider, useCustomerAuth } from '../../src/context/CustomerAuthContext.jsx';
import { getCustomerProfile, customerLogout } from '../../src/services/api.js';

function Harness() {
  const { customer, isLoggedIn, ready, loginCustomer, logoutCustomer } = useCustomerAuth();
  return (
    <div>
      <p data-testid="customer">{customer ? customer.email : 'null'}</p>
      <p data-testid="logged">{String(isLoggedIn)}</p>
      <p data-testid="ready">{String(ready)}</p>
      <button onClick={() => loginCustomer({ email: 'new@x.co', id: 2 })}>login</button>
      <button onClick={() => logoutCustomer()}>logout</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <CustomerAuthProvider>
      <Harness />
    </CustomerAuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  getCustomerProfile.mockReset();
  customerLogout.mockReset();
});

describe('CustomerAuthContext', () => {
  it('does not trust cached customer before the server confirms the session', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ email: 'cached@x.co' }));
    getCustomerProfile.mockResolvedValueOnce({ email: 'fresh@x.co' });
    renderHarness();
    expect(screen.getByTestId('customer').textContent).toBe('null');
    await waitFor(() => expect(screen.getByTestId('customer').textContent).toBe('fresh@x.co'));
    expect(JSON.parse(localStorage.getItem('customer_info'))).toEqual({ email: 'fresh@x.co' });
    expect(screen.getByTestId('ready').textContent).toBe('true');
  });

  it('clears cache and customer when the profile fetch rejects', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ email: 'stale@x.co' }));
    getCustomerProfile.mockRejectedValueOnce(new Error('401'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('customer').textContent).toBe('null');
    expect(localStorage.getItem('customer_info')).toBeNull();
  });

  it('loginCustomer stores customer in state and localStorage', async () => {
    getCustomerProfile.mockRejectedValueOnce(new Error('401'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    act(() => { fireEvent.click(screen.getByText('login')); });
    expect(screen.getByTestId('customer').textContent).toBe('new@x.co');
    expect(screen.getByTestId('logged').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('customer_info'))).toEqual({ email: 'new@x.co', id: 2 });
  });

  it('logoutCustomer calls customerLogout and clears state + cache', async () => {
    getCustomerProfile.mockResolvedValueOnce({ email: 'me@x.co' });
    customerLogout.mockResolvedValueOnce({ success: true });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('logged').textContent).toBe('true'));
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(customerLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('customer').textContent).toBe('null');
    expect(localStorage.getItem('customer_info')).toBeNull();
  });

  it('logoutCustomer still clears local state when the request rejects', async () => {
    getCustomerProfile.mockResolvedValueOnce({ email: 'me@x.co' });
    customerLogout.mockRejectedValueOnce(new Error('network'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('logged').textContent).toBe('true'));
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(screen.getByTestId('customer').textContent).toBe('null');
    expect(localStorage.getItem('customer_info')).toBeNull();
  });

  it('throws when useCustomerAuth is used outside the provider', () => {
    const err = console.error;
    console.error = jest.fn();
    function Dangling() { useCustomerAuth(); return null; }
    expect(() => render(<Dangling />)).toThrow(/CustomerAuthProvider/);
    console.error = err;
  });
});
