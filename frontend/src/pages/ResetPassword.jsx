import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!PASSWORD_REGEX.test(password)) {
      setError(t('errors.passwordInvalid'))
      return
    }
    if (password !== confirm) {
      setError(t('errors.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <SeoHead title={t('reset.invalidLink')} url="/reset-password" noindex />
        <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: 420 }}>
          <h2 style={{ marginBottom: '0.5rem' }}>{t('reset.invalidLink')}</h2>
          <Link to="/forgot-password" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            {t('reset.requestNew')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--color-bg-alt)' }}>
      <SeoHead title={t('reset.title')} url="/reset-password" noindex />
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 0 }}>
        <div style={{ padding: '2rem 2rem 1.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem' }}>{t('reset.title')}</h1>
        </div>

        <div style={{ padding: '2rem' }}>
          {success ? (
            <div className="alert" style={{ background: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              {t('reset.success')}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">{t('reset.newPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  {t('register.rules.minLength')} · {t('register.rules.uppercase')} · {t('register.rules.digit')} · {t('register.rules.special')}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('register.confirmPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? t('reset.submitting') : t('reset.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
