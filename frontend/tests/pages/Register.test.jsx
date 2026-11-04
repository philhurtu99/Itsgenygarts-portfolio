import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../src/services/api.js', () => ({
  customerRegister: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ lang: 'en', t: (key) => key }),
}));
jest.mock('../../src/components/SeoHead.jsx', () => () => null);

import Register from '../../src/pages/Register.jsx';
import { customerRegister } from '../../src/services/api.js';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderRegister() {
  return render(<MemoryRouter future={ROUTER_FUTURE}><Register /></MemoryRouter>);
}

beforeEach(() => { customerRegister.mockReset(); });

describe('Register page', () => {
  it('renders the registration form', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /register\.submit/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitted empty', async () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /register\.submit/i }));
    expect(await screen.findByText('errors.nameRequired')).toBeInTheDocument();
    expect(customerRegister).not.toHaveBeenCalled();
  });

  it('shows password mismatch error', async () => {
    renderRegister();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Alice' } });
    fireEvent.change(inputs[1], { target: { value: 'alice@test.com' } });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Secret1!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Other1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register\.submit/i }));
    expect(await screen.findByText('errors.passwordMismatch')).toBeInTheDocument();
  });

  it('shows success screen after registration', async () => {
    customerRegister.mockResolvedValueOnce({ verificationEmailSent: true });
    renderRegister();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Alice' } });
    fireEvent.change(inputs[1], { target: { value: 'alice@test.com' } });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Secret1!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register\.submit/i }));
    expect(await screen.findByText('register.verifyEmailTitle')).toBeInTheDocument();
    expect(customerRegister).toHaveBeenCalledWith(expect.objectContaining({ preferredLanguage: 'en' }));
    expect(document.body).toHaveTextContent('register.verifyEmailFrom');
  });

  it('shows API error when registration fails', async () => {
    customerRegister.mockRejectedValueOnce(new Error('Email already taken'));
    renderRegister();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Alice' } });
    fireEvent.change(inputs[1], { target: { value: 'alice@test.com' } });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Secret1!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register\.submit/i }));
    expect(await screen.findByText('Email already taken')).toBeInTheDocument();
    expect(screen.queryByText('verification.title')).not.toBeInTheDocument();
  });

  it('offers resend when the server identifies an unverified account', async () => {
    const error = Object.assign(new Error('Awaiting verification'), { code: 'EMAIL_UNVERIFIED' });
    customerRegister.mockRejectedValueOnce(error);
    renderRegister();
    fireEvent.change(screen.getByLabelText(/register.fullName/), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/register.email/), { target: { value: 'alice@test.com' } });
    fireEvent.change(screen.getByLabelText(/^register.password/), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByLabelText(/register.confirmPassword/), { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register.submit/ }));
    expect(await screen.findByText('verification.title')).toBeInTheDocument();
  });

  it('does not claim email delivery when account creation succeeded but SMTP failed', async () => {
    customerRegister.mockResolvedValueOnce({ verificationEmailSent: false });
    renderRegister();
    fireEvent.change(screen.getByLabelText(/register.fullName/), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/register.email/), { target: { value: 'alice@test.com' } });
    fireEvent.change(screen.getByLabelText(/^register.password/), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByLabelText(/register.confirmPassword/), { target: { value: 'Secret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /register.submit/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('verification.initialFailure');
    expect(screen.queryByText('register.verifyEmailSent')).not.toBeInTheDocument();
    expect(screen.getByText('verification.title')).toBeInTheDocument();
  });
});
