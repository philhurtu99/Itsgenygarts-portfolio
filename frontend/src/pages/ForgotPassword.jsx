import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'

export default function ForgotPassword() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--color-bg-alt)' }}>
      <SeoHead title={t('forgot.title')} url="/forgot-password" noindex />
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 0 }}>
        <div style={{ padding: '2rem 2rem 1.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem' }}>{t('forgot.title')}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: 0 }}>
            {t('forgot.subtitle')}
          </p>
        </div>

        <div style={{ padding: '2rem' }}>
          {sent ? (
            <>
              <div className="alert" style={{ background: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                {t('forgot.sent')}
              </div>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', display: 'inline-block', textAlign: 'center' }}>
                {t('forgot.backToLogin')}
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">{t('login.email')}</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? t('forgot.submitting') : t('forgot.submit')}
              </button>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/login" style={{ color: 'var(--color-primary)', fontSize: '0.875rem' }}>
                  {t('forgot.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
