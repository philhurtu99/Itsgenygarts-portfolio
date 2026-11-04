import { useId } from 'react'
import AddressAutocomplete from './AddressAutocomplete.jsx'
import {
  getCountryOptions,
  getSubdivisionOptions,
  isSubdivisionRequired,
  isShippingDestinationAllowed,
  normalizeCountryCode,
  normalizeSubdivisionCode,
} from '../utils/address.js'
import CustomerPrefillInput from './CustomerPrefillInput.jsx'
import { applySelectedCustomerPrefill } from '../utils/customerPrefill.js'
import { formatPhoneForCountry } from '../utils/phone.js'

export default function AddressFields({
  form,
  setForm,
  errors = {},
  setErrors,
  t,
  phoneField,
  required = true,
  customerPrefill,
  lang = 'fr',
}) {
  const countryFieldId = useId()
  const subdivisionFieldId = useId()
  const rawCountry = String(form.country || '').trim().toUpperCase()
  const country = normalizeCountryCode(rawCountry)
  const countryOptions = getCountryOptions(t, lang)
  const countrySelectValue = countryOptions.some((option) => option.code === country && option.code !== 'OTHER')
    ? country
    : (rawCountry ? 'OTHER' : '')
  const subdivisions = getSubdivisionOptions(country)
  const subdivisionRequired = required && isSubdivisionRequired(country)
  const hasAddressSearch = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

  function clearErrors(fields) {
    setErrors?.((e) => {
      const next = { ...e }
      fields.forEach((field) => { next[field] = undefined })
      return next
    })
  }

  function patchAddress(values) {
    setForm((f) => {
      const nextCountry = normalizeCountryCode(values.country || f.country)
      const next = {
        ...f,
        ...values,
        country: nextCountry,
        province: normalizeSubdivisionCode(nextCountry, values.province ?? f.province),
      }
      if (phoneField && next[phoneField]) {
        next[phoneField] = formatPhoneForCountry(next[phoneField], nextCountry)
      }
      return next
    })
    clearErrors(['address', 'city', 'province', 'postalCode', 'country'])
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    clearErrors([field])
  }

  function selectCustomerPrefill(field, value) {
    applySelectedCustomerPrefill(setForm, field, value, customerPrefill)
    clearErrors(Object.keys(customerPrefill || {}))
  }

  function handleCountryChange(value) {
    const nextCountry = normalizeCountryCode(value)
    setForm((f) => {
      const subdivisionOptions = getSubdivisionOptions(nextCountry)
      const province = subdivisionOptions.some(([code]) => code === f.province) ? f.province : ''
      const next = { ...f, country: nextCountry, province }
      if (phoneField && next[phoneField]) {
        next[phoneField] = formatPhoneForCountry(next[phoneField], nextCountry)
      }
      return next
    })
    clearErrors(['country', 'province'])
  }

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor={countryFieldId}>{t('form.country')} {required ? <span className="required-mark">*</span> : ''}</label>
          <select id={countryFieldId} autoComplete="country" className={`form-select${errors.country ? ' error' : ''}`} value={countrySelectValue} onChange={(e) => handleCountryChange(e.target.value)}>
            <option value="">{t('form.select')}</option>
            {countryOptions.map((c) => <option key={c.code} value={c.code} disabled={!isShippingDestinationAllowed(c.code)}>{c.label}</option>)}
          </select>
          {countrySelectValue === 'OTHER' && (
            <input
              type="text"
              inputMode="text"
              className={`form-input${errors.country ? ' error' : ''}`}
              value={rawCountry === 'OTHER' ? '' : rawCountry}
              onChange={(e) => setField('country', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
              placeholder={t('form.countryCode')}
              aria-label={t('form.countryCode')}
              maxLength={2}
              autoComplete="country"
              style={{ marginTop: '0.5rem' }}
            />
          )}
          {!isShippingDestinationAllowed(country) ? <p className="form-error" role="alert">{t('checkout.usShippingPaused')}</p> : errors.country && <p className="form-error">{errors.country}</p>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor={subdivisionFieldId}>{t('form.province')} {subdivisionRequired ? <span className="required-mark">*</span> : ''}</label>
          {subdivisions.length > 0 ? (
            <select id={subdivisionFieldId} autoComplete="address-level1" className={`form-select${errors.province ? ' error' : ''}`} value={form.province || ''} onChange={(e) => setField('province', e.target.value)}>
              <option value="">{t('form.select')}</option>
              {subdivisions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          ) : (
            <input
              type="text"
              id={subdivisionFieldId}
              autoComplete="address-level1"
              className={`form-input${errors.province ? ' error' : ''}`}
              value={form.province || ''}
              onChange={(e) => setField('province', e.target.value)}
            />
          )}
          {errors.province && <p className="form-error">{errors.province}</p>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('form.address')} {required ? <span className="required-mark">*</span> : ''}</label>
        {hasAddressSearch ? (
          <AddressAutocomplete
            value={form.address}
            onChange={(value) => setField('address', value)}
            placeholder={t('checkout.searchAddress')}
            className={`form-input${errors.address ? ' error' : ''}`}
            onSelect={(addr) => patchAddress(addr)}
          />
        ) : (
          <CustomerPrefillInput
            type="text"
            autoComplete="street-address"
            className={`form-input${errors.address ? ' error' : ''}`}
            value={form.address}
            suggestion={customerPrefill?.address}
            onChange={(value) => setField('address', value)}
            onSelectSuggestion={(value) => selectCustomerPrefill('address', value)}
          />
        )}
        {errors.address && <p className="form-error">{errors.address}</p>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('form.city')} {required ? <span className="required-mark">*</span> : ''}</label>
          <CustomerPrefillInput
            type="text"
            autoComplete="address-level2"
            className={`form-input${errors.city ? ' error' : ''}`}
            value={form.city}
            suggestion={customerPrefill?.city}
            onChange={(value) => setField('city', value)}
            onSelectSuggestion={(value) => selectCustomerPrefill('city', value)}
          />
          {errors.city && <p className="form-error">{errors.city}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">{t('form.postalCode')} {required ? <span className="required-mark">*</span> : ''}</label>
          <CustomerPrefillInput
            type="text"
            autoComplete="postal-code"
            className={`form-input${errors.postalCode ? ' error' : ''}`}
            value={form.postalCode}
            suggestion={customerPrefill?.postalCode}
            onChange={(value) => setField('postalCode', value)}
            onSelectSuggestion={(value) => selectCustomerPrefill('postalCode', value)}
          />
          {errors.postalCode && <p className="form-error">{errors.postalCode}</p>}
        </div>
      </div>
    </>
  )
}
