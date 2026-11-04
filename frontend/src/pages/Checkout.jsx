import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { calculateShipping, cancelPendingOrder, checkout, customerLogin, customerRegister } from '../services/api.js'
import AddressFields from '../components/AddressFields.jsx'
import CustomerPrefillInput from '../components/CustomerPrefillInput.jsx'
import SeoHead from '../components/SeoHead.jsx'
import MerchantDisclosure from '../components/MerchantDisclosure.jsx'
import {
  getCountryLabel,
  getSubdivisionLabel,
  isSubdivisionRequired,
  isValidCountryCode,
  isShippingDestinationAllowed,
  normalizeCountryCode,
} from '../utils/address.js'
import {
  applySelectedCustomerPrefill,
  applyCustomerPrefillToEmptyFields,
  getCustomerContactPrefill,
} from '../utils/customerPrefill.js'
import { formatPhoneForCountry } from '../utils/phone.js'
import { readSessionStorage, removeSessionStorage, writeSessionStorage } from '../utils/browserStorage.js'
import { localizedName } from '../utils/localizedFields.js'

// ── Step 1: Account ──────────────────────────────────────────────────────────

function StepAccount({ onNext, customer, loginCustomer, syncCartOnLogin, t }) {
  const [mode, setMode] = useState('choice')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: t('register.rules.minLength') },
    { test: (p) => /[A-Z]/.test(p), label: t('register.rules.uppercase') },
    { test: (p) => /\d/.test(p), label: t('register.rules.digit') },
    { test: (p) => /[^A-Za-z\d]/.test(p), label: t('register.rules.special') },
  ]

  if (customer) {
    return (
      <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>
          {t('checkout.loggedAs')} <strong>{customer.name}</strong> ({customer.email})
        </p>
        <button className="btn btn-primary" onClick={onNext}>{t('checkout.continue')}</button>
      </div>
    )
  }

  if (registered) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{t('register.verifyEmailTitle')}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
          {t('register.verifyEmailSent')} <strong>{form.email}</strong>.
          <br />{t('checkout.confirmEmailThenSignIn')}
          <br />{t('register.verifyEmailFrom')}
        </p>
        <button className="btn btn-secondary" onClick={() => { setRegistered(false); setMode('login') }}>
          {t('checkout.signIn')}
        </button>
      </div>
    )
  }

  if (mode === 'choice') {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', textAlign: 'center' }}>{t('checkout.howToContinue')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360, margin: '0 auto' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMode('login')}>{t('checkout.signIn')}</button>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setMode('register')}>{t('checkout.createAccount')}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('checkout.or')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onNext}>{t('checkout.continueAsGuest')}</button>
        </div>
      </div>
    )
  }

  function set(f, v) {
    setForm((p) => ({ ...p, [f]: v }))
    setErrors((e) => ({ ...e, [f]: undefined }))
    setApiError(null)
  }

  async function handleLogin(e) {
    e.preventDefault()
    const errs = {}
    if (!form.email.trim()) errs.email = t('errors.emailRequired')
    if (!form.password.trim()) errs.password = t('errors.passwordRequired')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      const res = await customerLogin({ email: form.email, password: form.password })
      loginCustomer(res.customer)
      await syncCartOnLogin()
      onNext()
    } catch (err) { setApiError(err.message) }
    finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = t('errors.nameRequired')
    if (!form.email.trim()) errs.email = t('errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('errors.emailInvalid')
    if (!PASSWORD_RULES.every((r) => r.test(form.password))) errs.password = t('errors.passwordInvalid')
    if (form.password !== form.confirm) errs.confirm = t('errors.passwordMismatch')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await customerRegister({ name: form.name, email: form.email, password: form.password })
      setRegistered(true)
    } catch (err) { setApiError(err.message) }
    finally { setLoading(false) }
  }

  if (mode === 'login') {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: 420, margin: '0 auto' }}>
        <button type="button" onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1rem' }}>{t('checkout.back')}</button>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>{t('checkout.signIn')}</h2>
        <form onSubmit={handleLogin}>
          {apiError && <div className="alert alert-error">{apiError}</div>}
          <div className="form-group">
            <label className="form-label">{t('form.email')}</label>
            <input type="email" autoComplete="email" className={`form-input${errors.email ? ' error' : ''}`} value={form.email} onChange={(e) => set('email', e.target.value)} autoFocus />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('login.password')}</label>
            <input type="password" autoComplete="current-password" className={`form-input${errors.password ? ' error' : ''}`} value={form.password} onChange={(e) => set('password', e.target.value)} />
            {errors.password && <p className="form-error">{errors.password}</p>}
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>{loading ? t('login.submitting') : t('login.submit')}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '2rem', maxWidth: 460, margin: '0 auto' }}>
      <button type="button" onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1rem' }}>{t('checkout.back')}</button>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>{t('checkout.createAccount')}</h2>
      <form onSubmit={handleRegister}>
        {apiError && <div className="alert alert-error">{apiError}</div>}
        <div className="form-group">
          <label className="form-label">{t('form.fullName')} <span className="required-mark">*</span></label>
          <input type="text" autoComplete="name" className={`form-input${errors.name ? ' error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">{t('form.email')} <span className="required-mark">*</span></label>
          <input type="email" autoComplete="email" className={`form-input${errors.email ? ' error' : ''}`} value={form.email} onChange={(e) => set('email', e.target.value)} />
          {errors.email && <p className="form-error">{errors.email}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">{t('login.password')} <span className="required-mark">*</span></label>
          <input type="password" autoComplete="new-password" className={`form-input${errors.password ? ' error' : ''}`} value={form.password} onChange={(e) => set('password', e.target.value)} />
          {errors.password && <p className="form-error">{errors.password}</p>}
          {form.password && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {PASSWORD_RULES.map((rule) => (
                <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: rule.test(form.password) ? '#2e7d32' : 'var(--color-text-muted)' }}>
                  <span>{rule.test(form.password) ? '✓' : '○'}</span> {rule.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t('register.confirmPassword')} <span className="required-mark">*</span></label>
          <input type="password" autoComplete="new-password" className={`form-input${errors.confirm ? ' error' : ''}`} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
          {errors.confirm && <p className="form-error">{errors.confirm}</p>}
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>{loading ? t('register.submitting') : t('register.submit')}</button>
      </form>
    </div>
  )
}

// ── Step 2: Address ──────────────────────────────────────────────────────────

function StepAddress({ form, setForm, errors, setErrors, onNext, onBack, t, lang, customerPrefill }) {
  const international = normalizeCountryCode(form.country) !== 'CA'

  function set(f, v) {
    setForm((p) => ({ ...p, [f]: v }))
    setErrors((e) => ({ ...e, [f]: undefined }))
  }

  function selectCustomerPrefill(field, value) {
    applySelectedCustomerPrefill(setForm, field, value, customerPrefill)
    setErrors((e) => {
      const next = { ...e }
      Object.keys(customerPrefill || {}).forEach((key) => { next[key] = undefined })
      return next
    })
  }

  function setPhone(value) {
    set('phone', formatPhoneForCountry(value, form.country))
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = t('errors.nameRequired')
    if (!form.email.trim()) e.email = t('errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('errors.emailInvalid')
    if (international && !form.phone.trim()) e.phone = t('errors.phoneRequiredInternational')
    if (!form.address.trim()) e.address = t('errors.addressRequired')
    if (!form.city.trim()) e.city = t('errors.cityRequired')
    if (!form.postalCode.trim()) e.postalCode = t('errors.postalRequired')
    if (!isValidCountryCode(form.country)) e.country = t('errors.countryCodeInvalid')
    else if (!isShippingDestinationAllowed(form.country)) e.country = t('checkout.usShippingPaused')
    if (isSubdivisionRequired(form.country) && !form.province) e.province = t('errors.provinceRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1rem' }}>{t('checkout.back')}</button>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>{t('checkout.yourInfo')}</h2>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('form.fullName')} <span className="required-mark">*</span></label>
          <CustomerPrefillInput type="text" autoComplete="name" className={`form-input${errors.name ? ' error' : ''}`} value={form.name} suggestion={customerPrefill.name} onChange={(value) => set('name', value)} onSelectSuggestion={(value) => selectCustomerPrefill('name', value)} />
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">{t('form.email')} <span className="required-mark">*</span></label>
          <CustomerPrefillInput type="email" autoComplete="email" className={`form-input${errors.email ? ' error' : ''}`} value={form.email} suggestion={customerPrefill.email} onChange={(value) => set('email', value)} onSelectSuggestion={(value) => selectCustomerPrefill('email', value)} />
          {errors.email && <p className="form-error">{errors.email}</p>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('form.phone')} {international ? <span className="required-mark">*</span> : ''}</label>
        <CustomerPrefillInput type="tel" autoComplete="tel" className={`form-input${errors.phone ? ' error' : ''}`} value={form.phone} suggestion={customerPrefill.phone} onChange={(value) => setPhone(value)} onSelectSuggestion={(value) => selectCustomerPrefill('phone', value)} />
        {errors.phone && <p className="form-error">{errors.phone}</p>}
      </div>

      <h2 style={{ fontSize: '1.1rem', margin: '1.5rem 0 1.25rem' }}>{t('checkout.shippingAddress')}</h2>

      <AddressFields form={form} setForm={setForm} errors={errors} setErrors={setErrors} t={t} lang={lang} phoneField="phone" customerPrefill={customerPrefill} />

      <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => validate() && onNext()}>
        {t('checkout.continueToSummary')}
      </button>
    </div>
  )
}

// ── Step 3: Review & Pay ─────────────────────────────────────────────────────

function StepReview({
  items, form, cartTotal, shippingTotal, shippingOptions, selectedShippingCode,
  onSelectShipping, loadingShipping, shippingError, onBack, onSubmit, submitting,
  apiError, formatPrice, t, lang,
  importFeesPolicy, importFeesAccepted, onImportFeesAccepted,
}) {
  function fmt(amount) { return formatPrice(amount) }

  const shippingQuoted = !loadingShipping && !shippingError && Boolean(selectedShippingCode) && shippingTotal != null
  const grandTotal = shippingQuoted ? cartTotal + shippingTotal : null
  const countryCode = normalizeCountryCode(form.country)
  const countryLabel = getCountryLabel(countryCode, t, lang)
  const provinceLabel = getSubdivisionLabel(form.country, form.province)

  return (
    <div>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1rem' }}>{t('checkout.editInfo')}</button>

      <div className="checkout-review-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t('checkout.contact')}</h2>
            <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div><strong>{t('form.name')}:</strong> {form.name}</div>
              <div><strong>{t('form.email')}:</strong> {form.email}</div>
              {form.phone && <div><strong>{t('form.tel')}:</strong> {formatPhoneForCountry(form.phone, form.country)}</div>}
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t('checkout.shippingAddress')}</h2>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>
              {[form.address, form.city, provinceLabel, form.postalCode, countryLabel].filter(Boolean).join(', ')}
            </p>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t('checkout.items')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item) => (
                <div key={`${item.id}:${item.productVariantId || ''}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {item.mainImageUrl ? (
                    <img src={item.mainImageUrl} alt={localizedName(item, lang)} width="48" height="48" loading="lazy" decoding="async" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧶</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{localizedName(item, lang)}</div>
                    {item.variantLabel && (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                        {t('products.variation')} {item.variantLabel}
                      </div>
                    )}
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>× {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{fmt(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card checkout-summary" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.2rem' }}>{t('cart.summary')}</h2>
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
            <legend style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {t('checkout.shippingOptions')}
            </legend>
            {loadingShipping && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('checkout.calculatingShipping')}</p>}
            {!loadingShipping && shippingError && <div className="alert alert-error">{shippingError}</div>}
            {!loadingShipping && !shippingError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {shippingOptions.map((option) => {
                  const selected = option.serviceCode === selectedShippingCode
                  return (
                    <label
                      key={option.serviceCode}
                      style={{
                        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.625rem', alignItems: 'start',
                        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        padding: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="shippingService"
                        value={option.serviceCode}
                        checked={selected}
                        onChange={() => onSelectShipping(option)}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem' }}>{option.serviceName}</span>
                        <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                          {option.trackingIncluded ? t('checkout.trackingIncluded') : t('checkout.withoutTracking')}
                          {option.estimatedDays ? ` · ${option.estimatedDays} ${t('checkout.businessDays')}` : ''}
                        </span>
                      </span>
                      <strong style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{fmt(option.amountCad)}</strong>
                    </label>
                  )
                })}
              </div>
            )}
            {countryCode !== 'CA' && (
              <div style={{ fontSize: '0.875rem', lineHeight: 1.5, marginTop: '1rem' }}>
                <p style={{ color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                  {importFeesPolicy?.notice || t('checkout.importFeesNotice')}
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={importFeesAccepted}
                    onChange={(event) => onImportFeesAccepted(event.target.checked)}
                    disabled={loadingShipping || !importFeesPolicy?.version}
                    style={{ width: 18, height: 18, flexShrink: 0, marginTop: 3 }}
                  />
                  <span>{t('checkout.importFeesAcceptance')}</span>
                </label>
              </div>
            )}
          </fieldset>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>{t('checkout.subtotal')}</span>
              <span style={{ fontWeight: 600 }}>{fmt(cartTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>{t('checkout.shippingLabel')}</span>
              <span style={{ fontWeight: 600 }}>{loadingShipping ? '...' : shippingQuoted ? fmt(shippingTotal) : t('checkout.amountPending')}</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
            <span>{t('checkout.total')}</span>
            <span>{loadingShipping ? '...' : grandTotal != null ? fmt(grandTotal) : t('checkout.amountPending')}</span>
          </div>

          {apiError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{apiError}</div>}

          <MerchantDisclosure />

          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onSubmit} disabled={submitting || loadingShipping || Boolean(shippingError) || !selectedShippingCode || (countryCode !== 'CA' && !importFeesAccepted)}>
            {submitting ? t('checkout.redirecting') : t('checkout.proceedToPayment')}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem', textAlign: 'center', marginBottom: 0 }}>
            {t('checkout.stripeNote')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Checkout ────────────────────────────────────────────────────────────

const PENDING_CHECKOUT_CANCEL_TOKEN = 'pending_checkout_cancel_token'
const PENDING_CHECKOUT_CART = 'pending_checkout_cart'

function readPendingCheckoutCart() {
  try {
    const parsed = JSON.parse(readSessionStorage(PENDING_CHECKOUT_CART, '[]') || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Checkout() {
  const { items, cartTotal, clearCart, restoreCartItems, syncCartOnLogin, refreshCartAvailability } = useCart()
  const { customer, loginCustomer } = useCustomerAuth()
  const { currency, formatPrice } = useCurrency()
  const { t, lang } = useLanguage()
  const [step, setStep] = useState(0)
  const [success, setSuccess] = useState(false)

  const STEPS = t('checkout.steps')

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', province: '',
    postalCode: '', country: 'CA',
  })
  const [errors, setErrors] = useState({})
  const customerPrefill = useMemo(() => getCustomerContactPrefill(customer), [customer])

  const [shippingTotal, setShippingTotal] = useState(null)
  const [shippingOptions, setShippingOptions] = useState([])
  const [selectedShippingCode, setSelectedShippingCode] = useState(null)
  const [shippingError, setShippingError] = useState(null)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const [importFeesPolicy, setImportFeesPolicy] = useState(null)
  const [acceptedImportFeesContext, setAcceptedImportFeesContext] = useState(null)
  const shippingQuoteCache = useRef(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [searchParams] = useSearchParams()
  const cancelled = searchParams.get('cancelled')
  const cancelToken = searchParams.get('cancel_token')

  async function cancelPendingCheckout(token) {
    if (!token) return
    const pendingCart = readPendingCheckoutCart()
    try {
      const result = await cancelPendingOrder(token)
      if (result?.cancelled !== false && pendingCart.length > 0) {
        await restoreCartItems(pendingCart)
      }
      await refreshCartAvailability?.()
    } catch {
      // Best effort: the regular pending-order cleanup still protects stock.
    } finally {
      removeSessionStorage(PENDING_CHECKOUT_CANCEL_TOKEN)
      removeSessionStorage(PENDING_CHECKOUT_CART)
    }
  }

  useEffect(() => {
    if (cancelled && cancelToken) {
      cancelPendingCheckout(cancelToken)
    }
  }, [cancelled, cancelToken])

  useEffect(() => {
    function releaseStoredPendingCheckout() {
      const token = readSessionStorage(PENDING_CHECKOUT_CANCEL_TOKEN)
      if (token) cancelPendingCheckout(token)
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') releaseStoredPendingCheckout()
    }

    window.addEventListener('pageshow', releaseStoredPendingCheckout)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    releaseStoredPendingCheckout()

    return () => {
      window.removeEventListener('pageshow', releaseStoredPendingCheckout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    applyCustomerPrefillToEmptyFields(setForm, customerPrefill)
  }, [customerPrefill])

  const shippingRequestKey = useMemo(() => JSON.stringify({
    items: items
      .map((item) => ({
        productId: Number(item.id),
        productVariantId: Number(item.productVariantId) || null,
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .sort((a, b) => a.productId - b.productId || (a.productVariantId || 0) - (b.productVariantId || 0)),
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phone: formatPhoneForCountry(form.phone, form.country) || '',
    address: form.address.trim(),
    city: form.city.trim(),
    country: normalizeCountryCode(form.country),
    province: form.province.trim().toUpperCase(),
    postalCode: form.postalCode.trim().toUpperCase().replace(/\s+/g, ''),
    customerLanguage: lang,
  }), [items, form.name, form.email, form.phone, form.address, form.city, form.country, form.province, form.postalCode, lang])

  const importFeesContext = JSON.stringify([shippingRequestKey, selectedShippingCode, importFeesPolicy?.version, lang])
  const importFeesAccepted = Boolean(importFeesPolicy?.version) && acceptedImportFeesContext === importFeesContext

  useEffect(() => {
    setAcceptedImportFeesContext(null)
  }, [shippingRequestKey, selectedShippingCode, lang, importFeesPolicy?.version])

  useEffect(() => {
    if (step !== 2 || !form.country || items.length === 0) return
    if (!isShippingDestinationAllowed(form.country)) {
      setShippingError(t('checkout.usShippingPaused'))
      setShippingOptions([])
      setShippingTotal(null)
      setSelectedShippingCode(null)
      setImportFeesPolicy(null)
      setLoadingShipping(false)
      return
    }

    function applyQuote(data) {
      const options = Array.isArray(data.options) ? data.options : []
      const preferred = options.find((option) => option.serviceCode === data.defaultServiceCode)
        || options.find((option) => option.trackingIncluded)
        || options[0]
      setShippingOptions(options)
      setImportFeesPolicy(data.importFeesPolicy || null)
      setSelectedShippingCode(preferred?.serviceCode || null)
      setShippingTotal(preferred?.amountCad ?? null)
      setShippingError(preferred ? null : t('checkout.shippingUnavailable'))
    }

    const cached = shippingQuoteCache.current.get(shippingRequestKey)
    if (cached) {
      applyQuote(cached)
      setLoadingShipping(false)
      return
    }

    let active = true
    setLoadingShipping(true)
    setShippingError(null)
    setShippingOptions([])
    setSelectedShippingCode(null)
    setShippingTotal(null)
    setImportFeesPolicy(null)
    const countryCode = normalizeCountryCode(form.country)
    calculateShipping({
      items: items.map((i) => ({ productId: i.id, productVariantId: i.productVariantId || undefined, quantity: i.quantity })),
      name: form.name,
      email: form.email,
      phone: formatPhoneForCountry(form.phone, form.country) || undefined,
      address: form.address,
      city: form.city,
      country: countryCode,
      province: form.province || undefined,
      postalCode: form.postalCode,
      customerLanguage: lang,
    }).then((data) => {
      if (shippingQuoteCache.current.size >= 10) {
        shippingQuoteCache.current.delete(shippingQuoteCache.current.keys().next().value)
      }
      shippingQuoteCache.current.set(shippingRequestKey, data)
      if (active) applyQuote(data)
    }).catch((error) => {
      if (!active) return
      setShippingTotal(null)
      setShippingError(error.message || t('checkout.shippingUnavailable'))
    })
      .finally(() => {
        if (active) setLoadingShipping(false)
      })

    return () => { active = false }
  }, [step, shippingRequestKey])

  function selectShipping(option) {
    setSelectedShippingCode(option.serviceCode)
    setShippingTotal(option.amountCad)
  }

  async function handleSubmit() {
    const countryCode = normalizeCountryCode(form.country)
    if (!isShippingDestinationAllowed(countryCode)) {
      setApiError(t('checkout.usShippingPaused'))
      return
    }
    if (countryCode !== 'CA' && !importFeesAccepted) {
      setApiError(t('checkout.importFeesRequired'))
      return
    }
    setSubmitting(true)
    setApiError(null)
    try {
      const result = await checkout({
        items: items.map((i) => ({ productId: i.id, productVariantId: i.productVariantId || undefined, quantity: i.quantity })),
        currency,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: formatPhoneForCountry(form.phone, form.country) || null,
        customerAddress: form.address,
        customerCity: form.city,
        customerProvince: form.province || null,
        customerPostalCode: form.postalCode,
        customerCountry: countryCode,
        customerLanguage: lang,
        shippingServiceCode: selectedShippingCode,
        importFeesAccepted: countryCode !== 'CA' ? importFeesAccepted : false,
        importFeesPolicyVersion: countryCode !== 'CA' ? importFeesPolicy?.version : undefined,
      })

      if (result.checkoutUrl) {
        if (result.cancelToken) {
          writeSessionStorage(PENDING_CHECKOUT_CANCEL_TOKEN, result.cancelToken)
          writeSessionStorage(PENDING_CHECKOUT_CART, JSON.stringify(items))
        }
        window.location.href = result.checkoutUrl
      } else {
        clearCart()
        setSuccess(true)
      }
    } catch (err) { setApiError(err.message) }
    finally { setSubmitting(false) }
  }

  if (items.length === 0 && !success) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <SeoHead title={t('checkout.cartEmpty')} url="/checkout" noindex />
        {cancelled ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>↩</div>
            <h2 style={{ marginBottom: '0.5rem' }}>{t('checkout.paymentCancelled')}</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
              {t('checkout.paymentCancelledDesc')}
            </p>
          </>
        ) : (
          <h2>{t('checkout.cartEmpty')}</h2>
        )}
        <Link to="/products" className="btn btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>{t('cart.viewProducts')}</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <SeoHead title={t('checkout.orderReceived')} url="/checkout" noindex />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ marginBottom: '0.5rem' }}>{t('checkout.orderReceived')}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {t('checkout.orderReceivedDesc')}
        </p>
        <Link to="/products" className="btn btn-primary">{t('checkout.backToProducts')}</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <SeoHead title={t('cart.checkout')} url="/checkout" noindex />
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/cart" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('checkout.backToCart')}</Link>
      </div>

      {/* Step indicator */}
      <div className="checkout-steps">
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700,
              background: i <= step ? 'var(--color-primary)' : 'var(--color-border)',
              color: i <= step ? 'white' : 'var(--color-text-muted)',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: i === step ? 700 : 400, color: i <= step ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{label}</span>
            {i < STEPS.length - 1 && <div style={{ width: 40, height: 2, background: i < step ? 'var(--color-primary)' : 'var(--color-border)', margin: '0 0.25rem' }} />}
          </div>
        ))}
      </div>

      {step === 0 && <StepAccount customer={customer} loginCustomer={loginCustomer} syncCartOnLogin={syncCartOnLogin} onNext={() => setStep(1)} t={t} />}
      {step === 1 && <StepAddress form={form} setForm={setForm} errors={errors} setErrors={setErrors} onNext={() => setStep(2)} onBack={() => setStep(0)} t={t} lang={lang} customerPrefill={customerPrefill} />}
      {step === 2 && (
        <StepReview
          items={items} form={form} cartTotal={cartTotal}
          shippingTotal={shippingTotal} shippingOptions={shippingOptions}
          selectedShippingCode={selectedShippingCode} onSelectShipping={selectShipping}
          loadingShipping={loadingShipping} shippingError={shippingError}
          onBack={() => setStep(1)} onSubmit={handleSubmit} submitting={submitting} apiError={apiError}
          formatPrice={formatPrice} t={t} lang={lang}
          importFeesPolicy={importFeesPolicy} importFeesAccepted={importFeesAccepted}
          onImportFeesAccepted={(accepted) => setAcceptedImportFeesContext(accepted ? importFeesContext : null)}
        />
      )}
    </div>
  )
}
