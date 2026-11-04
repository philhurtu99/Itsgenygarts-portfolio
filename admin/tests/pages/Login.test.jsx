import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../src/services/api.js', () => ({
  adminLogin: jest.fn(),
  adminMe: jest.fn(),
  adminLogout: jest.fn(),
  setAdminAuthToken: jest.fn(),
  clearAdminAuthToken: jest.fn(),
  getApiBaseUrl: jest.fn(() => '/api'),
  isServerOfflineError: jest.fn(() => false),
}));

import AdminLogin from '../../src/pages/admin/Login.jsx';
import { adminLogin, adminMe } from '../../src/services/api.js';
import { AuthProvider } from '../../src/context/AuthContext.jsx';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderLogin() {
  return render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <AuthProvider>
        <AdminLogin />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.setItem('lang', 'fr');
  adminLogin.mockReset();
  adminMe.mockReset();
  adminMe.mockRejectedValue(new Error('401'));
});

afterEach(() => {
  localStorage.clear();
});

describe('Admin Login page', () => {
  it('shows the login form when not authenticated', async () => {
    renderLogin();
    expect(await screen.findByText('Se connecter')).toBeInTheDocument();
  });

  it('shows validation error when form is empty', async () => {
    renderLogin();
    await screen.findByText('Se connecter');
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    expect(await screen.findByText(/Veuillez remplir/i)).toBeInTheDocument();
    expect(adminLogin).not.toHaveBeenCalled();
  });

  it('calls adminLogin on valid submit', async () => {
    adminLogin.mockResolvedValueOnce({ user: { id: 1, username: 'admin' } });
    renderLogin();
    await screen.findByText('Se connecter');
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'admin' } });
    const pwInput = document.querySelector('input[type="password"]');
    fireEvent.change(pwInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    await waitFor(() => expect(adminLogin).toHaveBeenCalledWith({ username: 'admin', password: 'secret' }));
  });

  it('shows error when adminLogin fails', async () => {
    adminLogin.mockRejectedValueOnce(new Error('Identifiants incorrects'));
    renderLogin();
    await screen.findByText('Se connecter');
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'admin' } });
    const pwInput = document.querySelector('input[type="password"]');
    fireEvent.change(pwInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    expect(await screen.findByText('Identifiants incorrects')).toBeInTheDocument();
  });
});
