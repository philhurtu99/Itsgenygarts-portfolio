import { useEffect, useMemo, useState } from 'react'
import { getProducts, createQuoteRequest } from '../services/api.js'
import Loader from '../components/Loader.jsx'
import AddressFields from '../components/AddressFields.jsx'
import CustomerPrefillInput from '../components/CustomerPrefillInput.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { isSubdivisionRequired, isValidCountryCode, isShippingDestinationAllowed } from '../utils/address.js'
import {
  applySelectedCustomerPrefill,
  applyCustomerPrefillToEmptyFields,
  getCustomerContactPrefill,
} from '../utils/customerPrefill.js'
import { formatPhoneForCountry } from '../utils/phone.js'
import { readJsonLocalStorage, removeLocalStorage } from '../utils/browserStorage.js'

export default function Quote() {
  const { t, lang } = useLanguage()
  const { customer: connectedCustomer } = useCustomerAuth()
  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const customerPrefill = useMemo(() => getCustomerContactPrefill(connectedCustomer), [connectedCustomer])

  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    notes: '',
  })

  useEffect(() => {
    applyCustomerPrefillToEmptyFields(setCustomer, customerPrefill)
  }, [customerPrefill])

  useEffect(() => {
    // Pre-fill from localStorage if coming from ProductDetail
    const stored = readJsonLocalStorage('quote_items', [])
    const initQty = {}
    stored.forEach((item) => {
      const id = item._id || item.id
      initQty[id] = item.quantity || 1
    })
    setQuantities(initQty)

    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : data.products || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function setQty(id, val) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, val) }))
  }

  function setCust(field, value) {
    setCustomer((c) => ({ ...c, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function selectCustomerPrefill(field, value) {
    applySelectedCustomerPrefill(setCustomer, field, value, customerPrefill)
    setErrors((e) => {
      const next = { ...e }
      Object.keys(customerPrefill || {}).forEach((key) => { next[key] = undefined })
      return next
    })
  }

  function setPhone(value) {
    setCust('phone', formatPhoneForCountry(value, customer.country))
  }

  const selectedItems = products.filter((p) => (quantities[p._id || p.id] || 0) > 0)
  const total = selectedItems.reduce((sum, p) => {
    const qty = quantities[p._id || p.id] || 0
    return sum + (p.price || 0) * qty
  }, 0)

  function validate() {
    const e = {}
    if (!customer.name.trim()) e.name = t('errors.nameRequired')
    if (!customer.email.trim()) e.email = t('errors.emailRequired')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) e.email = t('errors.emailInvalid')
    if (!customer.address.trim()) e.address = t('errors.addressRequired')
    if (!customer.city.trim()) e.city = t('errors.cityRequired')
    if (!customer.postalCode.trim()) e.postalCode = t('errors.postalRequired')
    if (!isValidCountryCode(customer.country)) e.country = t('errors.countryCodeInvalid')
    else if (!isShippingDestinationAllowed(customer.country)) e.country = t('checkout.usShippingPaused')
    if (isSubdivisionRequired(customer.country) && !customer.province) e.province = t('errors.provinceRequired')
    if (selectedItems.length === 0) e.items = t('errors.itemsRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setError(null)
    try {
      const items = selectedItems.map((p) => ({
        productId: p._id || p.id,
        name: p.name,
        price: p.price,
        quantity: quantities[p._id || p.id],
      }))
      await createQuoteRequest({ customer, items })
      removeLocalStorage('quote_items')
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="success-box">
          <div className="success-icon">📬</div>
          <h2 style={{ marginBottom: '0.5rem' }}>{t('quote.sentTitle')}</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {t('quote.sentDesc')}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setSuccess(false)}>
            {t('quote.newQuote')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: '0.5rem' }}>{t('quote.title')}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        {t('quote.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="quote-form-grid">
        {/* Product selection */}
        <div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>{t('quote.products')}</h2>
          {errors.items && <div className="alert alert-error">{errors.items}</div>}

          {loading ? (
            <Loader label={t('products.loading')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {products.map((p) => {
                const id = p._id || p.id
                const qty = quantities[id] || 0
                return (
                  <div
                    key={id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.875rem 1rem',
                      boxShadow: 'none',
                      transform: 'none',
                      borderColor: qty > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                    }}
                  >
                    {(p.imageUrl || p.image) && (
                      <img
                        src={p.imageUrl || p.image}
                        alt={p.name}
                        width="56"
                        height="56"
                        loading="lazy"
                        decoding="async"
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{p.name}</div>
                      {p.price != null && (
                        <div style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.875rem' }}>
                          {Number(p.price).toFixed(2)} $
                        </div>
                      )}
                    </div>
                    <div className="qty-selector">
                      <button type="button" className="qty-btn" onClick={() => setQty(id, qty - 1)}>−</button>
                      <span className="qty-value">{qty}</span>
                      <button type="button" className="qty-btn" onClick={() => setQty(id, qty + 1)}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {selectedItems.length > 0 && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                background: 'var(--color-accent)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
              }}
            >
              <span>{t('quote.estimatedTotal')}</span>
              <span>{total.toFixed(2)} $</span>
            </div>
          )}
        </div>

        {/* Customer info */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>{t('quote.yourInfo')}</h2>

          <div className="form-group">
            <label className="form-label">{t('form.fullName')} <span className="required-mark">*</span></label>
            <CustomerPrefillInput
              type="text"
              autoComplete="name"
              className={`form-input${errors.name ? ' error' : ''}`}
              value={customer.name}
              suggestion={customerPrefill.name}
              onChange={(value) => setCust('name', value)}
              onSelectSuggestion={(value) => selectCustomerPrefill('name', value)}
            />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('form.email')} <span className="required-mark">*</span></label>
            <CustomerPrefillInput
              type="email"
              autoComplete="email"
              className={`form-input${errors.email ? ' error' : ''}`}
              value={customer.email}
              suggestion={customerPrefill.email}
              onChange={(value) => setCust('email', value)}
              onSelectSuggestion={(value) => selectCustomerPrefill('email', value)}
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('form.phone')}</label>
            <CustomerPrefillInput
              type="tel"
              autoComplete="tel"
              className="form-input"
              value={customer.phone}
              suggestion={customerPrefill.phone}
              onChange={(value) => setPhone(value)}
              onSelectSuggestion={(value) => selectCustomerPrefill('phone', value)}
            />
          </div>
          <AddressFields form={customer} setForm={setCustomer} errors={errors} setErrors={setErrors} t={t} lang={lang} phoneField="phone" customerPrefill={customerPrefill} />
          <div className="form-group">
            <label className="form-label">{t('quote.notes')}</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={customer.notes}
              onChange={(e) => setCust('notes', e.target.value)}
              placeholder={t('quote.notesPlaceholder')}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? t('quote.submitting') : t('quote.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
