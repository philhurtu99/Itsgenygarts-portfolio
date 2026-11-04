import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

jest.mock('../../src/services/api.js', () => ({
  customerLogin: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('../../src/context/CustomerAuthContext.jsx', () => ({
  useCustomerAuth: () => ({ loginCustomer: jest.fn() }),
}));
jest.mock('../../src/context/CartContext.jsx', () => ({
  useCart: () => ({ syncCartOnLogin: jest.fn(async () => {}) }),
}));
jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    t: (key) => key,
  }),
}));

import Login from '../../src/pages/Login.jsx';
import { customerLogin } from '../../src/services/api.js';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderLogin(locationState = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: locationState }]} future={ROUTER_FUTURE}>
      <HelmetProvider><Login /></HelmetProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { customerLogin.mockReset(); });

describe('Login page', () => {
  it('renders the form', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /login\.submit/i })).toBeInTheDocument();
  });

  it('shows validation errors when form is submitted empty', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /login\.submit/i }));
    expect(await screen.findByText('errors.emailRequired')).toBeInTheDocument();
    expect(screen.getByText('errors.passwordRequired')).toBeInTheDocument();
    expect(customerLogin).not.toHaveBeenCalled();
  });

  it('calls customerLogin with filled fields on success', async () => {
    customerLogin.mockResolvedValueOnce({ customer: { id: 1, name: 'Alice' } });
    renderLogin();
    const [emailInput, pwInput] = screen.getAllByDisplayValue('');
    fireEvent.change(emailInput, { target: { value: 'alice@test.com' } });
    fireEvent.change(pwInput, { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /login\.submit/i }));
    await waitFor(() => expect(customerLogin).toHaveBeenCalledWith({ email: 'alice@test.com', password: 'Secret1!' }));
  });

  it('shows API error when login fails', async () => {
    customerLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderLogin();
    const [emailInput, pwInput] = screen.getAllByDisplayValue('');
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } });
    fireEvent.change(pwInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login\.submit/i }));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
