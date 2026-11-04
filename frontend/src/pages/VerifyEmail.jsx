import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmail } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import Loader from '../components/Loader.jsx'
import SeoHead from '../components/SeoHead.jsx'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const hasVerifiedRef = useRef(false)
  const { t } = useLanguage()
  const token = params.get('token')

  useEffect(() => {
    if (hasVerifiedRef.current) return

    if (!token) {
      setStatus('error')
      setMessage(t('verify.missingToken'))
      return
    }

    hasVerifiedRef.current = true
    verifyEmail(token)
      .then(() => {
        setStatus('success')
        setMessage(t('verify.successMessage'))
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || t('verify.invalidToken'))
      })
  }, [token, t])

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--color-bg-alt)' }}>
      <SeoHead title={t('verify.successTitle')} url="/verify-email" noindex />
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: '2.5rem', textAlign: 'center' }}>
        {status === 'loading' && (
          <Loader label={t('verify.loading')} />
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('verify.successTitle')}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              {t('login.submit')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('verify.errorTitle')}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/register" className="btn btn-primary" style={{ display: 'inline-block' }}>
              {t('verify.retryRegister')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
