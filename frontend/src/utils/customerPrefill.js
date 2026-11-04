import { formatPhoneForCountry } from './phone.js'

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || ''
}

export function getCustomerContactPrefill(customer) {
  if (!customer) return {}
  const latestContact = customer.latestContact || {}
  const country = firstValue(customer.country, customer.customerCountry, latestContact.country, latestContact.customerCountry, 'CA')
  return {
    name: firstValue(customer.name, customer.customerName),
    email: firstValue(customer.email, customer.customerEmail),
    phone: formatPhoneForCountry(firstValue(customer.phone, customer.customerPhone, latestContact.phone, latestContact.customerPhone), country),
    address: firstValue(customer.address, customer.customerAddress, customer.shippingAddress, latestContact.address, latestContact.customerAddress, latestContact.shippingAddress),
    city: firstValue(customer.city, customer.customerCity, latestContact.city, latestContact.customerCity),
    province: firstValue(customer.province, customer.customerProvince, latestContact.province, latestContact.customerProvince),
    postalCode: firstValue(customer.postalCode, customer.customerPostalCode, latestContact.postalCode, latestContact.customerPostalCode),
    country,
  }
}

export function getCustomOrderCustomerPrefill(customer) {
  const prefill = getCustomerContactPrefill(customer)
  if (Object.keys(prefill).length === 0) return {}
  return {
    customerName: prefill.name,
    customerEmail: prefill.email,
    customerPhone: prefill.phone,
    address: prefill.address,
    city: prefill.city,
    province: prefill.province,
    postalCode: prefill.postalCode,
    country: prefill.country,
  }
}

function normalizeMatchValue(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

export function shouldApplyCustomerPrefillFromInput(value, prefillValue) {
  const typed = normalizeMatchValue(value)
  const expected = normalizeMatchValue(prefillValue)
  if (!typed || !expected) return false
  if (expected.startsWith(typed)) return true

  const typedDigits = typed.replace(/\D/g, '')
  const expectedDigits = expected.replace(/\D/g, '')
  return typedDigits.length > 0 && expectedDigits.startsWith(typedDigits)
}

export function applySelectedCustomerPrefill(setState, field, value, prefill) {
  setState((current) => {
    const next = { ...current }
    for (const [prefillField, prefillValue] of Object.entries(prefill || {})) {
      if (prefillValue && (!next[prefillField] || prefillField === field)) {
        next[prefillField] = prefillValue
      }
    }
    next[field] = value
    return next
  })
}

export function applyCustomerPrefillToEmptyFields(setState, prefill, { defaultCountry = 'CA' } = {}) {
  if (!prefill || Object.keys(prefill).length === 0) return

  setState((current) => {
    const next = { ...current }
    let changed = false
    const addressFields = new Set(['address', 'city', 'province', 'postalCode'])
    const hasAddressInput = ['address', 'city', 'province', 'postalCode']
      .some((field) => String(current[field] || '').trim() !== '')

    for (const [field, value] of Object.entries(prefill)) {
      if (!value) continue

      if (field === 'country') {
        const canReplaceDefaultCountry = !hasAddressInput && String(current.country || '').toUpperCase() === defaultCountry
        if (!current.country || canReplaceDefaultCountry) {
          next.country = value
          changed = true
        }
        continue
      }

      if (hasAddressInput && addressFields.has(field)) continue

      if (!String(current[field] || '').trim()) {
        next[field] = value
        changed = true
      }
    }

    return changed ? next : current
  })
}
