import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { customerLogin } from '../services/api.js'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import ResendVerification from '../components/ResendVerification.jsx'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginCustomer } = useCustomerAuth()
  const { syncCartOnLogin } = useCart()
  const { t } = useLanguage()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(false)

  const from = location.state?.from || '/'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setApiError(null)
  }

  function validate() {
    const e = {}
    if (!form.email.trim()) e.email = t('errors.emailRequired')
    if (!form.password.trim()) e.password = t('errors.passwordRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setApiError(null)
    try {
      const res = await customerLogin({ email: form.email, password: form.password })
      loginCustomer(res.customer)
      await syncCartOnLogin()
      navigate(from, { replace: true })
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <SeoHead title={t('login.title')} url="/login" noindex />
      <div className="auth-card auth-card-login">
        <div className="auth-card-header">
          <h1 className="auth-title">{t('login.title')}</h1>
          <p className="auth-subtitle">
            {t('login.noAccount')}{' '}
            <Link to="/register">{t('login.register')}</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {apiError && <div className="alert alert-error">{apiError}</div>}

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">{t('login.email')}</label>
            <input
              id="login-email"
              type="email"
              className={`auth-input${errors.email ? ' error' : ''}`}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="email@exemple.com"
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">{t('login.password')}</label>
            <input
              id="login-password"
              type="password"
              className={`auth-input${errors.password ? ' error' : ''}`}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {errors.password && <p className="form-error">{errors.password}</p>}
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit')}
            <span aria-hidden="true">→</span>
          </button>

          <div className="auth-footer-link">
            <Link to="/forgot-password">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </form>
        <ResendVerification initialEmail={form.email} />
      </div>
    </div>
  )
}
