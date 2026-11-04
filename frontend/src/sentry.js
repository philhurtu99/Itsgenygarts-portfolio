import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

export const sentryEnabled = Boolean(dsn)
export { Sentry }
