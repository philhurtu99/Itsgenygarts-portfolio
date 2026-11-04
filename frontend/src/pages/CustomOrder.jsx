import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createCustomOrder,
  getModelOptions,
  getProductReferences,
  getCustomOrderCategories,
  uploadCustomOrderImages,
  createPersonalizedQuote,
  uploadPersonalizedQuoteImages,
} from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import StepIndicator from '../components/custom-order/StepIndicator.jsx'
import ColorInputs from '../components/custom-order/ColorInputs.jsx'
import AddressFields from '../components/AddressFields.jsx'
import CustomerPrefillInput from '../components/CustomerPrefillInput.jsx'
import { isSubdivisionRequired, isValidCountryCode, isShippingDestinationAllowed } from '../utils/address.js'
import { formatPhoneForCountry } from '../utils/phone.js'
import {
  getCustomOrderCustomerPrefill,
  applySelectedCustomerPrefill,
  applyCustomerPrefillToEmptyFields,
} from '../utils/customerPrefill.js'

function FormHelp({ title, text, label }) {
  const [open, setOpen] = useState(false)
  const helpRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!helpRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="form-help" ref={helpRef}>
      <button
        type="button"
        className="form-help-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && (
        <div className="form-help-popover" role="note">
          <strong>{title}</strong>
          <p>{text}</p>
        </div>
      )}
    </div>
  )
}

function customOptionTitle(option, lang) {
  if (!option) return ''
  if (lang === 'en') return option.nameEn || option.name || option.nameFr || ''
  return option.nameFr || option.name || option.nameEn || ''
}

function customOptionKey(option) {
  return option?.nameFr || option?.name || option?.nameEn || ''
}

function customChoiceLabel(choice, lang) {
  if (typeof choice === 'string') return choice
  if (lang === 'en') return choice?.value || choice?.label || ''
  return choice?.label || choice?.value || ''
}

function customChoiceValue(choice) {
  if (typeof choice === 'string') return choice
  return choice?.value || choice?.label || ''
}

function customCategoryName(category, lang) {
  if (!category) return ''
  if (lang === 'en') return category.nameEn || category.name || category.nameFr || ''
  return category.nameFr || category.name || category.nameEn || ''
}

// ─── Devis personnalisé form ──────────────────────────────────────────────────

function DevisForm({ onBack, t, customer }) {
  const [form, setForm] = useState({
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    images: [],
    imagePreviews: [],
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const imagePreviewsRef = useRef([])
  const customerPrefill = useMemo(() => getCustomOrderCustomerPrefill(customer), [customer])

  useEffect(() => {
    imagePreviewsRef.current = form.imagePreviews
  }, [form.imagePreviews])

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [])

  useEffect(() => {
    applyCustomerPrefillToEmptyFields(setForm, customerPrefill)
  }, [customerPrefill])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
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
    set('customerPhone', formatPhoneForCountry(value, form.country))
  }

  function handleImageUpload(e) {
    const remaining = 5 - form.images.length
    const files = Array.from(e.target.files).slice(0, remaining)
    if (files.length === 0) return
    const previews = files.map((f) => URL.createObjectURL(f))
    set('images', [...form.images, ...files])
    set('imagePreviews', [...form.imagePreviews, ...previews])
  }

  function removeImage(idx) {
    if (form.imagePreviews[idx]) URL.revokeObjectURL(form.imagePreviews[idx])
    set('images', form.images.filter((_, i) => i !== idx))
    set('imagePreviews', form.imagePreviews.filter((_, i) => i !== idx))
  }

  function validate() {
    const e = {}
    if (!form.description.trim()) e.description = t('errors.descriptionRequired')
    if (!form.customerName.trim()) e.customerName = t('errors.nameRequired')
    if (!form.customerEmail.trim()) e.customerEmail = t('errors.emailRequired')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) e.customerEmail = t('errors.emailInvalid')
    if (!form.address.trim()) e.address = t('errors.addressRequired')
    if (!form.city.trim()) e.city = t('errors.cityRequired')
    if (!form.postalCode.trim()) e.postalCode = t('errors.postalRequired')
    if (!isValidCountryCode(form.country)) e.country = t('errors.countryCodeInvalid')
    else if (!isShippingDestinationAllowed(form.country)) e.country = t('checkout.usShippingPaused')
    if (isSubdivisionRequired(form.country) && !form.province) e.province = t('errors.provinceRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const quote = await createPersonalizedQuote({
        description: form.description,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: formatPhoneForCountry(form.customerPhone, form.country) || undefined,
        customerAddress: form.address,
        customerCity: form.city,
        customerProvince: form.province || undefined,
        customerPostalCode: form.postalCode,
        customerCountry: form.country,
      })

      if (quote?.id && form.images.length > 0) {
        await uploadPersonalizedQuoteImages(quote.id, form.images, quote.uploadToken)
      }

      imagePreviewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
      imagePreviewsRef.current = []
      setSuccess(quote?.id || 'OK')
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="success-box">
          <div className="success-icon">✅</div>
          <h2 style={{ marginBottom: '0.5rem' }}>{t('custom.quoteSent')}</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {t('custom.quoteSentDesc')}
          </p>
          {success !== 'OK' && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
              {t('custom.refNumber')} : <strong>{success}</strong>
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: '1.5rem' }}
            onClick={onBack}
          >
            {t('form.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="form-page-heading">
        <h1>{t('custom.quoteTitle')}</h1>
        <FormHelp
          label={t('custom.quoteHelpLabel')}
          title={t('custom.quoteHelpTitle')}
          text={t('custom.quoteHelpText')}
        />
      </div>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        {t('custom.quoteSubtitle')}
      </p>

      <div className="card" style={{ maxWidth: 700, padding: '2rem' }}>
        {/* Description */}
        <div className="form-group">
          <label className="form-label">{t('custom.projectDesc')} <span className="required-mark">*</span></label>
          <textarea
            className={`form-input${errors.description ? ' error' : ''}`}
            rows={5}
            placeholder={t('custom.projectPlaceholder')}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            style={{ resize: 'vertical' }}
          />
          {errors.description && <p className="form-error">{errors.description}</p>}
        </div>

        {/* Images */}
        <div className="form-group">
          <label className="form-label">
            {t('custom.refPhotos')}{' '}
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>({t('custom.optional')}, max 5)</span>
          </label>
          {form.images.length < 5 && (
            <label className="file-upload-area" style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <div>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📎</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('custom.clickToChoose')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  JPG, PNG, WEBP — {form.images.length}/5
                </div>
              </div>
            </label>
          )}
          {form.imagePreviews.length > 0 && (
            <div className="file-preview-grid" style={{ marginTop: '0.75rem' }}>
              {form.imagePreviews.map((src, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={src} alt={`${i + 1}`} className="file-preview-img" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      background: 'rgba(0,0,0,0.6)', color: 'white',
                      border: 'none', borderRadius: '50%', width: 20, height: 20,
                      cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1,
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coordonnées */}
        <h2 style={{ fontSize: '1.1rem', margin: '1.5rem 0 1rem' }}>{t('custom.yourInfo')}</h2>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('form.fullName')} <span className="required-mark">*</span></label>
            <CustomerPrefillInput
              type="text"
              autoComplete="name"
              className={`form-input${errors.customerName ? ' error' : ''}`}
              value={form.customerName}
              suggestion={customerPrefill.customerName}
              onChange={(value) => set('customerName', value)}
              onSelectSuggestion={(value) => selectCustomerPrefill('customerName', value)}
            />
            {errors.customerName && <p className="form-error">{errors.customerName}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('form.email')} <span className="required-mark">*</span></label>
            <CustomerPrefillInput
              type="email"
              autoComplete="email"
              className={`form-input${errors.customerEmail ? ' error' : ''}`}
              value={form.customerEmail}
              suggestion={customerPrefill.customerEmail}
              onChange={(value) => set('customerEmail', value)}
              onSelectSuggestion={(value) => selectCustomerPrefill('customerEmail', value)}
            />
            {errors.customerEmail && <p className="form-error">{errors.customerEmail}</p>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('form.phone')}</label>
          <CustomerPrefillInput
            type="tel"
            autoComplete="tel"
            className="form-input"
            value={form.customerPhone}
            suggestion={customerPrefill.customerPhone}
            onChange={(value) => setPhone(value)}
            onSelectSuggestion={(value) => selectCustomerPrefill('customerPhone', value)}
          />
        </div>

        <AddressFields form={form} setForm={setForm} errors={errors} setErrors={setErrors} t={t} lang={lang} phoneField="customerPhone" customerPrefill={customerPrefill} />

        {submitError && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{submitError}</div>}

        <div className="step-nav">
          <button className="btn btn-secondary" onClick={onBack}>{t('form.back')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('custom.submitting') : t('custom.sendQuoteBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main CustomOrder component ───────────────────────────────────────────────

export default function CustomOrder() {
  const { t, lang } = useLanguage()
  const { customer } = useCustomerAuth()
  const customerPrefill = useMemo(() => getCustomOrderCustomerPrefill(customer), [customer])
  const [step, setStep] = useState(0)
  const [devisMode, setDevisMode] = useState(false)
  const [categories, setCategories] = useState([])
  const [modelOptions, setModelOptions] = useState([])
  const [productRefs, setProductRefs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  const COLOR_STYLES = [
    { value: 'same_as_ref', label: t('custom.sameAsRef') },
    { value: 'solid', label: t('custom.solid') },
    { value: 'multiple', label: t('custom.multiple') },
    { value: 'color_changing', label: t('custom.gradient') },
    { value: 'rainbow', label: t('custom.rainbow') },
  ]

  const RAINBOW_MOODS = [
    { label: t('custom.pastel'), value: 'PASTEL' },
    { label: t('custom.bright'), value: 'BRIGHT' },
    { label: t('custom.dark'), value: 'DARK' },
  ]

  const STEPS = t('custom.steps')

  const [form, setForm] = useState({
    category: '',
    selectedOptions: {},
    colorStyle: '',
    colors: ['#8B5E52'],
    colorTheme: '',
    rainbowMood: '',
    modelReference: '',
    productReference: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    referenceImages: [],
    referenceImagePreviews: [],
  })

  const [errors, setErrors] = useState({})
  const referenceImagePreviewsRef = useRef([])

  useEffect(() => {
    referenceImagePreviewsRef.current = form.referenceImagePreviews
  }, [form.referenceImagePreviews])

  useEffect(() => {
    return () => {
      referenceImagePreviewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [])

  useEffect(() => {
    applyCustomerPrefillToEmptyFields(setForm, customerPrefill)
  }, [customerPrefill])

  useEffect(() => {
    getCustomOrderCategories()
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {})
    getModelOptions()
      .then((d) => setModelOptions(Array.isArray(d) ? d : d.options || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const selectedCategory = categories.find((c) => c.code === form.category)
    if (form.category && form.category !== 'DEVIS' && selectedCategory) {
      getProductReferences(selectedCategory.name)
        .then((d) => setProductRefs(Array.isArray(d) ? d : []))
        .catch(() => setProductRefs([]))
    } else {
      setProductRefs([])
    }
  }, [form.category, categories])

  function set(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'category') {
        next.selectedOptions = {}
      }
      return next
    })
    setErrors((e) => ({ ...e, [field]: undefined }))
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
    set('customerPhone', formatPhoneForCountry(value, form.country))
  }

  function validateStep() {
    const e = {}
    if (step === 0 && !form.category) e.category = t('errors.categoryRequired')
    if (step === 3) {
      if (!form.colorStyle) e.colorStyle = t('errors.colorStyleRequired')
      if (form.colorStyle === 'color_changing' && !form.colorTheme.trim()) e.colorTheme = t('errors.colorThemeRequired')
      if (form.colorStyle === 'rainbow' && !form.rainbowMood) e.rainbowMood = t('errors.moodRequired')
    }
    if (step === 4) {
      if (!form.customerName.trim()) e.customerName = t('errors.nameRequired')
      if (!form.customerEmail.trim()) e.customerEmail = t('errors.emailRequired')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) e.customerEmail = t('errors.emailInvalid')
      if (!form.address.trim()) e.address = t('errors.addressRequired')
      if (!form.city.trim()) e.city = t('errors.cityRequired')
      if (!form.postalCode.trim()) e.postalCode = t('errors.postalRequired')
      if (!isValidCountryCode(form.country)) e.country = t('errors.countryCodeInvalid')
      else if (!isShippingDestinationAllowed(form.country)) e.country = t('checkout.usShippingPaused')
      if (isSubdivisionRequired(form.country) && !form.province) e.province = t('errors.provinceRequired')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validateStep()) return
    if (step === 0 && form.category === 'DEVIS') {
      setDevisMode(true)
    } else {
      setStep((s) => s + 1)
    }
  }
  function prev() { setStep((s) => s - 1) }

  function handleImageUpload(e) {
    const files = Array.from(e.target.files).slice(0, 3 - form.referenceImages.length)
    if (files.length === 0) return
    const previews = files.map((f) => URL.createObjectURL(f))
    set('referenceImages', [...form.referenceImages, ...files])
    set('referenceImagePreviews', [...form.referenceImagePreviews, ...previews])
  }

  function removeImage(idx) {
    if (form.referenceImagePreviews[idx]) URL.revokeObjectURL(form.referenceImagePreviews[idx])
    set('referenceImages', form.referenceImages.filter((_, i) => i !== idx))
    set('referenceImagePreviews', form.referenceImagePreviews.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        category: form.category,
        selectedOptions: Object.keys(form.selectedOptions).length > 0 ? form.selectedOptions : undefined,
        colorStyle: {
          same_as_ref: 'SAME_AS_REFERENCE',
          solid: 'SOLID_COLOR',
          multiple: 'MULTIPLE_SOLID_COLORS',
          color_changing: 'COLOR_CHANGING_YARN',
          rainbow: 'RAINBOW',
        }[form.colorStyle] || form.colorStyle,
        selectedColors: ['solid', 'multiple'].includes(form.colorStyle) ? form.colors.join(',') : undefined,
        colorChangingTheme: form.colorStyle === 'color_changing' ? form.colorTheme : undefined,
        rainbowMood: form.colorStyle === 'rainbow' ? form.rainbowMood : undefined,
        customModelOptionId: form.modelReference ? Number(form.modelReference) : undefined,
        productReferenceId: form.productReference ? Number(form.productReference) : undefined,
        description: [
          form.colorTheme,
          form.rainbowMood ? `Rainbow: ${form.rainbowMood}` : null,
        ].filter(Boolean).join(' - ') || '-',
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: formatPhoneForCountry(form.customerPhone, form.country) || undefined,
        customerAddress: form.address,
        customerCity: form.city,
        customerProvince: form.province || undefined,
        customerPostalCode: form.postalCode,
        customerCountry: form.country,
      }

      const order = await createCustomOrder(payload)
      const orderId = order?.id

      if (orderId && form.referenceImages.length > 0) {
        await uploadCustomOrderImages(orderId, form.referenceImages, order.uploadToken)
      }

      referenceImagePreviewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
      referenceImagePreviewsRef.current = []
      setSuccess(orderId || 'OK')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Devis mode ──
  if (devisMode) {
    return <DevisForm onBack={() => { setDevisMode(false); set('category', '') }} t={t} customer={customer} />
  }

  // ── Success ──
  if (success) {
    return (
      <div className="page">
        <div className="success-box">
          <div className="success-icon">✅</div>
          <h2 style={{ marginBottom: '0.5rem' }}>{t('custom.successTitle')}</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {t('custom.successDesc')}
          </p>
          {success !== 'OK' && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
              {t('custom.orderNumber')} : <strong>{success}</strong>
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: '1.5rem' }}
            onClick={() => { setSuccess(null); setStep(0); setForm({ ...form, category: '' }) }}
          >
            {t('custom.newOrder')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="form-page-heading">
        <h1>{t('custom.title')}</h1>
        <FormHelp
          label={t('custom.customHelpLabel')}
          title={t('custom.customHelpTitle')}
          text={t('custom.customHelpText')}
        />
      </div>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        {t('custom.subtitle')}
      </p>

      <StepIndicator current={step} t={t} />

      <div className="card" style={{ maxWidth: 700, padding: '2rem' }}>
        {/* Step 0: Category */}
        {step === 0 && (
          <div>
            <h2 style={{ marginBottom: '1.25rem' }}>{t('custom.chooseCategory')}</h2>
            <div className="option-cards">
              {categories.map((cat) => (
                <div
                  key={cat.code}
                  className={`option-card${form.category === cat.code ? ' selected' : ''}`}
                  onClick={() => set('category', cat.code)}
                >
                  {cat.icon && <span style={{ marginRight: '0.35rem' }}>{cat.icon}</span>}{customCategoryName(cat, lang)}
                </div>
              ))}
            </div>

            <div
              className={`option-card${form.category === 'DEVIS' ? ' selected' : ''}`}
              onClick={() => set('category', 'DEVIS')}
              style={{ marginTop: '1rem', borderStyle: 'dashed', textAlign: 'center', padding: '1rem 1.5rem' }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✉️</div>
              <div style={{ fontWeight: 600 }}>{t('custom.cantFind')}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                {t('custom.sendQuote')}
              </div>
            </div>

            {errors.category && <p className="form-error">{errors.category}</p>}
          </div>
        )}

        {/* Step 1: Options */}
        {step === 1 && (() => {
          const selectedCat = categories.find((c) => c.code === form.category)
          const opts = selectedCat?.options || []
          return (
          <div>
            <h2 style={{ marginBottom: '1.25rem' }}>{t('custom.options')}</h2>
            {opts.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>{t('custom.noOptions')}</p>
            )}
            {opts.map((opt) => {
              const optionTitle = customOptionTitle(opt, lang)
              const optionKey = customOptionKey(opt)
              const choices = (opt.choices || []).map((c) =>
                typeof c === 'string' ? { label: c, value: c } : c
              )
              return (
                <div className="form-group" key={optionKey}>
                  <label className="form-label">{optionTitle}</label>
                  <div className="option-cards">
                    {choices.map((choice) => {
                      const choiceValue = customChoiceValue(choice)
                      return (
                      <div
                        key={choiceValue}
                        className={`option-card${form.selectedOptions[optionKey] === choiceValue ? ' selected' : ''}`}
                        onClick={() => set('selectedOptions', { ...form.selectedOptions, [optionKey]: choiceValue })}
                      >
                        {customChoiceLabel(choice, lang)}
                      </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          )
        })()}

        {/* Step 3: Colors */}
        {step === 3 && (
          <div>
            <h2 style={{ marginBottom: '1.25rem' }}>{t('custom.colorStyle')}</h2>
            <div className="form-group">
              <div className="option-cards">
                {COLOR_STYLES.map((cs) => (
                  <div
                    key={cs.value}
                    className={`option-card${form.colorStyle === cs.value ? ' selected' : ''}`}
                    onClick={() => set('colorStyle', cs.value)}
                  >
                    {cs.label}
                  </div>
                ))}
              </div>
              {errors.colorStyle && <p className="form-error">{errors.colorStyle}</p>}
            </div>

            {['solid', 'multiple'].includes(form.colorStyle) && (
              <div className="form-group">
                <label className="form-label">
                  {form.colorStyle === 'solid' ? t('custom.color') : t('custom.colorsMax5')}
                </label>
                <ColorInputs
                  colors={form.colors}
                  onChange={(c) => set('colors', form.colorStyle === 'solid' ? [c[0] || '#ffffff'] : c)}
                  t={t}
                />
              </div>
            )}

            {form.colorStyle === 'color_changing' && (
              <div className="form-group">
                <label className="form-label">{t('custom.colorTheme')} <span className="required-mark">*</span></label>
                <input
                  type="text"
                  className={`form-input${errors.colorTheme ? ' error' : ''}`}
                  placeholder={t('custom.colorThemePlaceholder')}
                  value={form.colorTheme}
                  onChange={(e) => set('colorTheme', e.target.value)}
                />
                {errors.colorTheme && <p className="form-error">{errors.colorTheme}</p>}
              </div>
            )}

            {form.colorStyle === 'rainbow' && (
              <div className="form-group">
                <label className="form-label">{t('custom.mood')} <span className="required-mark">*</span></label>
                <div className="option-cards">
                  {RAINBOW_MOODS.map((m) => (
                    <div
                      key={m.value}
                      className={`option-card${form.rainbowMood === m.value ? ' selected' : ''}`}
                      onClick={() => set('rainbowMood', m.value)}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {errors.rainbowMood && <p className="form-error">{errors.rainbowMood}</p>}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Reference */}
        {step === 2 && (
          <div>
            <h2 style={{ marginBottom: '1.25rem' }}>{t('custom.modelRef')}</h2>

            {productRefs.length > 0 && (
              <div className="form-group">
                <label className="form-label">{t('custom.chooseRef')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {productRefs.map((p) => {
                    const pid = p.id
                    const isSelected = form.productReference === String(pid)
                    return (
                      <div
                        key={pid}
                        onClick={() => set('productReference', isSelected ? '' : String(pid))}
                        style={{
                          border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          boxShadow: isSelected ? '0 0 0 2px rgba(139,94,82,0.2)' : 'none',
                          background: 'white',
                        }}
                      >
                        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--color-bg-alt)', overflow: 'hidden' }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={t('custom.chooseRef')} width="180" height="180" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '2rem' }}>🧶</div>
                          )}
                        </div>
                        {isSelected && (
                          <div style={{ background: 'var(--color-primary)', color: 'white', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem' }}>
                            {t('custom.selected')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {form.productReference && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => set('productReference', '')}
                  >
                    {t('custom.removeSelection')}
                  </button>
                )}
              </div>
            )}

            {modelOptions.length > 0 && (
              <div className="form-group">
                <label className="form-label">{t('custom.modelOption')}</label>
                <select
                  className="form-select"
                  value={form.modelReference}
                  onChange={(e) => set('modelReference', e.target.value)}
                >
                  <option value="">{t('custom.choose')}</option>
                  {modelOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName || o.label || o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label className="form-label">{t('custom.refPhotos')} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>({t('custom.optional')}, max 3)</span></label>
              <label className="file-upload-area" style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <div>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📎</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('custom.clickToChoose')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                    JPG, PNG, WEBP
                  </div>
                </div>
              </label>

              {form.referenceImagePreviews.length > 0 && (
                <div className="file-preview-grid" style={{ marginTop: '0.75rem' }}>
                  {form.referenceImagePreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={src} alt={`${i + 1}`} className="file-preview-img" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        style={{
                          position: 'absolute', top: 2, right: 2,
                          background: 'rgba(0,0,0,0.6)', color: 'white',
                          border: 'none', borderRadius: '50%', width: 20, height: 20,
                          cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Customer info */}
        {step === 4 && (
          <div>
            <h2 style={{ marginBottom: '1.25rem' }}>{t('custom.yourInfo')}</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('form.fullName')} <span className="required-mark">*</span></label>
                <CustomerPrefillInput
                  type="text"
                  autoComplete="name"
                  className={`form-input${errors.customerName ? ' error' : ''}`}
                  value={form.customerName}
                  suggestion={customerPrefill.customerName}
                  onChange={(value) => set('customerName', value)}
                  onSelectSuggestion={(value) => selectCustomerPrefill('customerName', value)}
                />
                {errors.customerName && <p className="form-error">{errors.customerName}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('form.email')} <span className="required-mark">*</span></label>
                <CustomerPrefillInput
                  type="email"
                  autoComplete="email"
                  className={`form-input${errors.customerEmail ? ' error' : ''}`}
                  value={form.customerEmail}
                  suggestion={customerPrefill.customerEmail}
                  onChange={(value) => set('customerEmail', value)}
                  onSelectSuggestion={(value) => selectCustomerPrefill('customerEmail', value)}
                />
                {errors.customerEmail && <p className="form-error">{errors.customerEmail}</p>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('form.phone')}</label>
              <CustomerPrefillInput
                type="tel"
                autoComplete="tel"
                className="form-input"
                value={form.customerPhone}
                suggestion={customerPrefill.customerPhone}
                onChange={(value) => setPhone(value)}
                onSelectSuggestion={(value) => selectCustomerPrefill('customerPhone', value)}
              />
            </div>
            <AddressFields form={form} setForm={setForm} errors={errors} setErrors={setErrors} t={t} lang={lang} phoneField="customerPhone" customerPrefill={customerPrefill} />
          </div>
        )}

        {error && step === 4 && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

        {/* Navigation */}
        <div className="step-nav">
          {step > 0 ? (
            <button className="btn btn-secondary" onClick={prev}>{t('custom.previous')}</button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>
              {t('custom.next')}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t('custom.submitting') : t('custom.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
