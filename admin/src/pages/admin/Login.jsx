import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { adminLogin, getApiBaseUrl, setAdminAuthToken } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { msg } from '../../utils/messages.js'

export default function AdminLogin() {
  const { login, isAuthenticated, ready } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [debugStatus, setDebugStatus] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const showMobileDebug = typeof window !== 'undefined' && window.location.search.includes('mobileApp')

  if (!ready) return null
  if (isAuthenticated) return <Navigate to="/" replace />

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) {
      setError(msg('fillAllFields'))
      return
    }
    setLoading(true)
    setError(null)
    setDebugStatus(`Clic reçu. Appel ${getApiBaseUrl()}/admin/auth/login`)
    try {
      const res = await adminLogin({ username: form.username, password: form.password })
      setDebugStatus('Réponse login reçue. Ouverture du tableau de bord...')
      setAdminAuthToken(res.token)
      login(res.user || res)
      navigate('/', { replace: true })
    } catch (err) {
      setDebugStatus(`Erreur: ${err.message || 'inconnue'}`)
      setError(err.message || msg('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-alt)',
      padding: '2rem',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 0 }}>
        <div style={{ padding: '2rem 2rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ fontSize: '1.5rem', textAlign: 'center' }}>Espace Admin</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 0, marginTop: '0.25rem' }}>
            Connectez-vous pour accéder au tableau de bord
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Nom d&apos;utilisateur</label>
            <input
              type="text"
              className="form-input"
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input password-input"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {showPassword ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.4 5.2A9.8 9.8 0 0 1 12 4.9c5 0 8.2 4.5 9.1 6a2 2 0 0 1 0 2.2 14.8 14.8 0 0 1-2 2.5" />
                    <path d="M6.1 6.6A14.7 14.7 0 0 0 2.9 10.9a2 2 0 0 0 0 2.2c.9 1.5 4.1 6 9.1 6a9.9 9.9 0 0 0 4.2-.9" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M2.9 10.9a2 2 0 0 0 0 2.2c.9 1.5 4.1 6 9.1 6s8.2-4.5 9.1-6a2 2 0 0 0 0-2.2c-.9-1.5-4.1-6-9.1-6s-8.2 4.5-9.1 6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          {showMobileDebug && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-text-muted)',
              fontSize: '0.75rem',
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}>
              Debug app mobile: {debugStatus || `Prêt. API: ${getApiBaseUrl()}`}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
