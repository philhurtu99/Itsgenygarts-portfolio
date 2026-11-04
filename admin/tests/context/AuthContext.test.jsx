import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

jest.mock('../../src/services/api.js', () => ({
  adminMe: jest.fn(),
  adminLogout: jest.fn(),
  clearAdminAuthToken: jest.fn(),
  isServerOfflineError: jest.fn(() => false),
}));

import { AuthProvider, useAuth } from '../../src/context/AuthContext.jsx';
import { adminMe, adminLogout } from '../../src/services/api.js';

function Harness() {
  const { user, isAuthenticated, ready, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="user">{user ? user.email : 'null'}</p>
      <p data-testid="authed">{String(isAuthenticated)}</p>
      <p data-testid="ready">{String(ready)}</p>
      <button onClick={() => login({ email: 'new@x.co' })}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>
  );
}

beforeEach(() => {
  adminMe.mockReset();
  adminLogout.mockReset();
});

describe('AuthContext', () => {
  it('hydrates user from adminMe on mount', async () => {
    adminMe.mockResolvedValueOnce({ email: 'admin@x.co', role: 'ADMIN' });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('admin@x.co');
    expect(screen.getByTestId('authed').textContent).toBe('true');
  });

  it('leaves user null when adminMe rejects (no session)', async () => {
    adminMe.mockRejectedValueOnce(new Error('401'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('login(userData) sets user and flips isAuthenticated', async () => {
    adminMe.mockRejectedValueOnce(new Error('401'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    act(() => { fireEvent.click(screen.getByText('login')); });
    expect(screen.getByTestId('user').textContent).toBe('new@x.co');
    expect(screen.getByTestId('authed').textContent).toBe('true');
  });

  it('logout calls adminLogout and clears user', async () => {
    adminMe.mockResolvedValueOnce({ email: 'admin@x.co' });
    adminLogout.mockResolvedValueOnce({ success: true });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(adminLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('logout still clears user when adminLogout rejects', async () => {
    adminMe.mockResolvedValueOnce({ email: 'admin@x.co' });
    adminLogout.mockRejectedValueOnce(new Error('network down'));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));
    await act(async () => { fireEvent.click(screen.getByText('logout')); });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const err = console.error;
    console.error = jest.fn();
    function Dangling() { useAuth(); return null; }
    expect(() => render(<Dangling />)).toThrow(/AuthProvider/);
    console.error = err;
  });
});
