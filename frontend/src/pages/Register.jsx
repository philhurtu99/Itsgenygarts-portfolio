import { useState } from 'react'
import { Link } from 'react-router-dom'
import { customerRegister } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import ResendVerification from '../components/ResendVerification.jsx'

export default function Register() {
  const { lang, t } = useLanguage()

  const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: t('register.rules.minLength') },
    { test: (p) => /[A-Z]/.test(p), label: t('register.rules.uppercase') },
    { test: (p) => /\d/.test(p), label: t('register.rules.digit') },
    { test: (p) => /[^A-Za-z\d]/.test(p), label: t('register.rules.special') },
  ]

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    newsletterConsent: false,
    preferredLanguage: lang === 'en' ? 'en' : 'fr',
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [resendSuggested, setResendSuggested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [verificationEmailSent, setVerificationEmailSent] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setApiError(null)
    setResendSuggested(false)
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = t('errors.nameRequired')
    if (!form.email.trim()) e.email = t('errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('errors.emailInvalid')
    const allRulesPass = PASSWORD_RULES.every((r) => r.test(form.password))
    if (!allRulesPass) e.password = t('errors.passwordInvalid')
    if (form.password !== form.confirm) e.confirm = t('errors.passwordMismatch')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setApiError(null)
    setResendSuggested(false)
    try {
      const result = await customerRegister({
        name: form.name,
        email: form.email,
        password: form.password,
        newsletterConsent: form.newsletterConsent,
        preferredLanguage: form.preferredLanguage,
      })
      setVerificationEmailSent(result.verificationEmailSent === true)
      setRegistered(true)
    } catch (err) {
      setApiError(err.message)
      setResendSuggested(err.code === 'EMAIL_UNVERIFIED')
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="auth-page">
        <SeoHead title={t('register.verifyEmailTitle')} url="/register" noindex />
        <div className="auth-card auth-card-success">
          <div className="auth-success-icon">✉️</div>
          <h1 className="auth-title">{t('register.verifyEmailTitle')}</h1>
          {verificationEmailSent ? (
            <p className="auth-subtitle auth-success-text" role="status">
              {t('register.verifyEmailSent')} <strong>{form.email}</strong>.
              <br />{t('register.verifyEmailInstruction')}
              <br />{t('register.verifyEmailFrom')}
            </p>
          ) : <p className="alert alert-error" role="alert">{t('verification.initialFailure')}</p>}
          <ResendVerification initialEmail={form.email} />
          <Link to="/login" className="auth-submit auth-link-button">
            {t('register.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <SeoHead title={t('register.title')} url="/register" noindex />
      <div className="auth-card auth-card-register">
        <div className="auth-card-header">
          <h1 className="auth-title">{t('register.title')}</h1>
          <p className="auth-subtitle">
            {t('register.hasAccount')}{' '}
            <Link to="/login">{t('register.signIn')}</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {apiError && <div className="alert alert-error">{apiError}</div>}

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-name">{t('register.fullName')} <span className="required-mark">*</span></label>
            <input
              id="register-name"
              type="text"
              className={`auth-input${errors.name ? ' error' : ''}`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoComplete="name"
              autoFocus
              placeholder={t('register.fullNamePlaceholder')}
            />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-email">{t('register.email')} <span className="required-mark">*</span></label>
            <input
              id="register-email"
              type="email"
              className={`auth-input${errors.email ? ' error' : ''}`}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              placeholder={t('register.emailPlaceholder')}
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-password">{t('register.password')} <span className="required-mark">*</span></label>
            <input
              id="register-password"
              type="password"
              className={`auth-input${errors.password ? ' error' : ''}`}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {errors.password && <p className="form-error">{errors.password}</p>}
            {form.password && (
              <div className="auth-password-rules">
                {PASSWORD_RULES.map((rule) => (
                  <div key={rule.label} className={`auth-password-rule${rule.test(form.password) ? ' valid' : ''}`}>
                    <span>{rule.test(form.password) ? '✓' : '○'}</span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-confirm">{t('register.confirmPassword')} <span className="required-mark">*</span></label>
            <input
              id="register-confirm"
              type="password"
              className={`auth-input${errors.confirm ? ' error' : ''}`}
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {errors.confirm && <p className="form-error">{errors.confirm}</p>}
          </div>

          <div className="auth-checkbox">
            <input
              id="newsletterConsent"
              type="checkbox"
              checked={form.newsletterConsent}
              onChange={(e) => set('newsletterConsent', e.target.checked)}
            />
            <label htmlFor="newsletterConsent">
              {t('register.newsletterConsent')}
            </label>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="preferredLanguage">
              {t('register.communicationLanguage')}
            </label>
            <select
              id="preferredLanguage"
              className="auth-input"
              value={form.preferredLanguage}
              onChange={(e) => set('preferredLanguage', e.target.value)}
            >
              <option value="fr">{t('register.languageFrench')}</option>
              <option value="en">{t('register.languageEnglish')}</option>
            </select>
            <p className="auth-help">{t('register.communicationLanguageHint')}</p>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? t('register.submitting') : t('register.submit')}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        {resendSuggested && <ResendVerification initialEmail={form.email} />}
      </div>
    </div>
  )
}
