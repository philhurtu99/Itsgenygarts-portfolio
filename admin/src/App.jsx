import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './middleware/ProtectedRoute.jsx'
import AdminLogin from './pages/admin/Login.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminProducts from './pages/admin/Products.jsx'
import AdminYarn from './pages/admin/Yarn.jsx'
import AdminMarketMode from './pages/admin/MarketMode.jsx'
import AdminCustomOrders from './pages/admin/CustomOrders.jsx'
import AdminPersonalizedQuotes from './pages/admin/PersonalizedQuotes.jsx'
import AdminQuotes from './pages/admin/Quotes.jsx'
import AdminCustomOrderCategories from './pages/admin/CustomOrderCategories.jsx'
import AdminOrders from './pages/admin/Orders.jsx'
import AdminNewsletter from './pages/admin/Newsletter.jsx'
import AdminSearch from './pages/admin/Search.jsx'

function ServerStatusBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)

  useEffect(() => {
    function handleServerStatus(event) {
      setOffline(event.detail?.status === 'offline')
    }

    function handleBrowserOnline() {
      setOffline(false)
    }

    function handleBrowserOffline() {
      setOffline(true)
    }

    window.addEventListener('itsgenygarts:server-status', handleServerStatus)
    window.addEventListener('online', handleBrowserOnline)
    window.addEventListener('offline', handleBrowserOffline)
    return () => {
      window.removeEventListener('itsgenygarts:server-status', handleServerStatus)
      window.removeEventListener('online', handleBrowserOnline)
      window.removeEventListener('offline', handleBrowserOffline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="server-offline-banner" role="status">
      Serveur offline. Les paiements Stripe et la synchronisation sont indisponibles.
    </div>
  )
}

export default function App() {
  return (
    <>
      <ServerStatusBanner />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
        <Route path="/yarn" element={<ProtectedRoute><AdminYarn /></ProtectedRoute>} />
        <Route path="/market" element={<ProtectedRoute><AdminMarketMode /></ProtectedRoute>} />
        <Route path="/categories" element={<Navigate to="/products" replace />} />
        <Route path="/custom-orders" element={<ProtectedRoute><AdminCustomOrders /></ProtectedRoute>} />
        <Route path="/personalized-quotes" element={<ProtectedRoute><AdminPersonalizedQuotes /></ProtectedRoute>} />
        <Route path="/quotes" element={<ProtectedRoute><AdminQuotes /></ProtectedRoute>} />
        <Route path="/custom-order-categories" element={<ProtectedRoute><AdminCustomOrderCategories /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
        <Route path="/newsletter" element={<ProtectedRoute><AdminNewsletter /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><AdminSearch /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
