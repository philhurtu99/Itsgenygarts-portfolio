import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmDeleteCustomerAccount } from '../services/api.js'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import Loader from '../components/Loader.jsx'
import SeoHead from '../components/SeoHead.jsx'

export default function DeleteAccountConfirmation() {
  const [params] = useSearchParams()
  const { logoutCustomer } = useCustomerAuth()
  const { t } = useLanguage()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const hasConfirmedRef = useRef(false)
  const token = params.get('token')

  useEffect(() => {
    if (hasConfirmedRef.current) return

    if (!token) {
      setStatus('error')
      setMessage(t('deleteAccountConfirm.missingToken'))
      return
    }

    hasConfirmedRef.current = true
    confirmDeleteCustomerAccount(token)
      .then(async (result) => {
        await logoutCustomer()
        setStatus('success')
        setMessage(result?.message || t('deleteAccountConfirm.successMessage'))
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || t('deleteAccountConfirm.errorMessage'))
      })
  }, [logoutCustomer, t, token])

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--color-bg-alt)' }}>
      <SeoHead title={t('deleteAccountConfirm.successTitle')} url="/delete-account-confirmation" noindex />
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: '2.5rem', textAlign: 'center' }}>
        {status === 'loading' && <Loader label={t('deleteAccountConfirm.loading')} />}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('deleteAccountConfirm.successTitle')}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/" className="btn btn-primary" style={{ display: 'inline-block' }}>
              {t('nav.home')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>×</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{t('deleteAccountConfirm.errorTitle')}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/profile" className="btn btn-primary" style={{ display: 'inline-block' }}>
              {t('nav.profile')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
