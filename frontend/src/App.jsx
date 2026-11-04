import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import CookieBanner from './components/CookieBanner.jsx'
import AnalyticsTracker from './components/AnalyticsTracker.jsx'
import MobileBackToTop from './components/MobileBackToTop.jsx'
import { CookieConsentProvider } from './context/CookieConsentContext.jsx'
import Home from './pages/Home.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Yarn from './pages/Yarn.jsx'
import CustomOrder from './pages/CustomOrder.jsx'
import CustomOrderComingSoon from './pages/CustomOrderComingSoon.jsx'
import Cart from './pages/Cart.jsx'
import Favorites from './pages/Favorites.jsx'
import Checkout from './pages/Checkout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Profile from './pages/Profile.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import DeleteAccountConfirmation from './pages/DeleteAccountConfirmation.jsx'
import FAQ from './pages/FAQ.jsx'
import Terms from './pages/legal/Terms.jsx'
import Privacy from './pages/legal/Privacy.jsx'
import Cookies from './pages/legal/Cookies.jsx'
import Mentions from './pages/legal/Mentions.jsx'
import Returns from './pages/legal/Returns.jsx'
import Legal from './pages/legal/Legal.jsx'
import NotFound from './pages/NotFound.jsx'
import { customOrdersEnabled } from './config/features.js'

function ScrollToTop() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    })
  }, [pathname, search])

  return null
}

function PageWrapper({ children }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  return (
    <main className="main-content" style={isHome ? {} : { paddingTop: 90 }}>
      {children}
    </main>
  )
}

export default function App() {
  return (
    <CookieConsentProvider>
      <ScrollToTop />
      <Navbar />
      <AnalyticsTracker />
      <PageWrapper>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/yarn" element={<Yarn />} />
          <Route path="/custom-order" element={customOrdersEnabled ? <CustomOrder /> : <CustomOrderComingSoon />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/delete-account-confirmation" element={<DeleteAccountConfirmation />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/legal/mentions" element={<Mentions />} />
          <Route path="/legal/returns" element={<Returns />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageWrapper>
      <Footer />
      <MobileBackToTop />
      <CookieBanner />
    </CookieConsentProvider>
  )
}
