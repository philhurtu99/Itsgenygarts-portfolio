jest.mock('../../src/sentry.js', () => ({
  Sentry: { captureException: jest.fn() },
  sentryEnabled: false,
}));

import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../src/components/ErrorBoundary.jsx';

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let originalError;

  beforeEach(() => {
    originalError = console.error;
    console.error = jest.fn();
    localStorage.setItem('lang', 'fr');
  });

  afterEach(() => {
    console.error = originalError;
    localStorage.clear();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
    expect(screen.getByText(/Rechargez la page/i)).toBeInTheDocument();
  });

  it('shows both reload and home controls in the fallback', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /Recharger la page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Accueil/i })).toHaveAttribute('href', '/');
  });
});
