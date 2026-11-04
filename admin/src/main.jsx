import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './sentry.js'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { Sentry, sentryEnabled } from './sentry.js'
import { msg } from './utils/messages.js'

function Fallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{msg('genericErrorTitle')}</h1>
      <p>{msg('reloadToRetry')}</p>
      <button onClick={() => window.location.reload()}>{msg('reload')}</button>
    </div>
  )
}

const routerBasename = import.meta.env.BASE_URL === '/'
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, '')

const Tree = (
  <BrowserRouter basename={routerBasename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {sentryEnabled ? (
      <Sentry.ErrorBoundary fallback={<Fallback />}>{Tree}</Sentry.ErrorBoundary>
    ) : (
      Tree
    )}
  </React.StrictMode>,
)
