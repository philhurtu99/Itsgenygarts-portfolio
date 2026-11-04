import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './sentry.js'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import { CartProvider } from './context/CartContext.jsx'
import { CustomerAuthProvider } from './context/CustomerAuthContext.jsx'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { FavoriteProvider } from './context/FavoriteContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
    <ErrorBoundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <CurrencyProvider>
          <CustomerAuthProvider>
            <FavoriteProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </FavoriteProvider>
          </CustomerAuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </BrowserRouter>
    </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>,
)
