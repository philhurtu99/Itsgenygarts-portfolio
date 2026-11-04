import { Component } from 'react'
import { Sentry, sentryEnabled } from '../sentry.js'
import { readLocalStorage } from '../utils/browserStorage.js'

const copy = {
  fr: {
    title: 'Une erreur est survenue',
    desc: "Quelque chose s'est mal passé. Rechargez la page ou revenez à l'accueil.",
    reload: 'Recharger la page',
    home: 'Accueil',
  },
  en: {
    title: 'Something went wrong',
    desc: 'Something went wrong. Reload the page or return home.',
    reload: 'Reload page',
    home: 'Home',
  },
}

function currentCopy() {
  const lang = readLocalStorage('lang') || navigator.language?.slice(0, 2)
  return lang === 'en' ? copy.en : copy.fr
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
    if (sentryEnabled) {
      Sentry.captureException(error, { extra: { componentStack: info?.componentStack } })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const text = currentCopy()

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '4rem', margin: '0 0 0.5rem', lineHeight: 1 }}>🧶</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--color-primary)' }}>
          {text.title}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', maxWidth: 380 }}>
          {text.desc}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            {text.reload}
          </button>
          <a href="/" className="btn btn-secondary">{text.home}</a>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#dc2626',
            textAlign: 'left',
            maxWidth: 600,
            overflow: 'auto',
          }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
        )}
      </div>
    )
  }
}
