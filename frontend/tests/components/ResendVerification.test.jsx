import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResendVerification from '../../src/components/ResendVerification.jsx';
import { resendVerification } from '../../src/services/api.js';

jest.mock('../../src/services/api.js', () => ({ resendVerification: jest.fn() }));
jest.mock('../../src/context/LanguageContext.jsx', () => ({ useLanguage: () => ({ t: (key) => key }) }));

beforeEach(() => jest.clearAllMocks());

it('acknowledges the request and prevents repeat submission during cooldown', async () => {
  resendVerification.mockResolvedValue({ requested: true });
  const user = userEvent.setup();
  render(<ResendVerification initialEmail="alice@test.com" />);
  await user.click(screen.getByText('verification.title'));
  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'verification.resend' }));
  });
  expect(await screen.findByRole('status')).toHaveTextContent('verification.requested');
  expect(resendVerification).toHaveBeenCalledWith('alice@test.com');
  expect(screen.getByRole('button', { name: 'verification.cooldown' })).toBeDisabled();
});

it('shows a recoverable error instead of claiming delivery', async () => {
  resendVerification.mockRejectedValue(new Error('offline'));
  render(<ResendVerification initialEmail="alice@test.com" />);
  fireEvent.click(screen.getByText('verification.title'));
  fireEvent.submit(screen.getByLabelText('register.email').closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('verification.error');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
