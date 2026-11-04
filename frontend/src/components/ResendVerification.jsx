import { useEffect, useId, useState } from 'react'
import { resendVerification } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function ResendVerification({ initialEmail = '' }) {
  const { t } = useLanguage()
  const id = useId()
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setEmail(initialEmail) }, [initialEmail])

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function submit(event) {
    event.preventDefault()
    if (loading || cooldown) return
    setLoading(true)
    setError('')
    setRequested(false)
    try {
      await resendVerification(email.trim())
      setRequested(true)
      setCooldown(60)
    } catch (err) {
      if (err.status === 429) {
        setCooldown(60)
        setError(t('verification.wait'))
      } else {
        setError(t('verification.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <details className="verification-resend">
      <summary>{t('verification.title')}</summary>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor={id} className="auth-label">{t('register.email')}</label>
        <input id={id} className="auth-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {requested && <p role="status">{t('verification.requested')}</p>}
        <button className="btn btn-secondary" type="submit" disabled={loading || cooldown > 0}>
          {loading ? t('verification.sending') : cooldown ? t('verification.cooldown', { seconds: cooldown }) : t('verification.resend')}
        </button>
      </form>
    </details>
  )
}
