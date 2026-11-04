import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

jest.mock('../../src/services/api.js', () => ({
  adminMe: jest.fn(),
  adminLogout: jest.fn(),
  clearAdminAuthToken: jest.fn(),
  isServerOfflineError: jest.fn(() => false),
}));

import ProtectedRoute from '../../src/middleware/ProtectedRoute.jsx';
import { AuthProvider, useAuth } from '../../src/context/AuthContext.jsx';
import { adminMe } from '../../src/services/api.js';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function LoginPage() {
  return <div data-testid="login">login page</div>;
}
function DashPage() {
  return <div data-testid="dash">dash page</div>;
}

function Shell() {
  return (
    <MemoryRouter initialEntries={['/admin']} future={ROUTER_FUTURE}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <DashPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  adminMe.mockReset();
});

describe('ProtectedRoute', () => {
  it('renders nothing until auth is ready', () => {
    adminMe.mockReturnValue(new Promise(() => {})); // never resolves
    render(<Shell />);
    expect(screen.queryByTestId('login')).toBeNull();
    expect(screen.queryByTestId('dash')).toBeNull();
  });

  it('redirects to /login when unauthenticated after auth resolves', async () => {
    adminMe.mockRejectedValueOnce(new Error('401'));
    render(<Shell />);
    expect(await screen.findByTestId('login')).toBeInTheDocument();
    expect(screen.queryByTestId('dash')).toBeNull();
  });

  it('renders children when authenticated', async () => {
    adminMe.mockResolvedValueOnce({ email: 'admin@x.co' });
    render(<Shell />);
    expect(await screen.findByTestId('dash')).toBeInTheDocument();
    expect(screen.queryByTestId('login')).toBeNull();
  });
});
