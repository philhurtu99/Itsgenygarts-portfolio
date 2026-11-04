const NANP_COUNTRIES = new Set(['CA', 'CAN', 'CANADA', 'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'ETATS-UNIS'])
const FR_COUNTRIES = new Set(['FR', 'FRA', 'FRANCE'])
const GB_COUNTRIES = new Set(['GB', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN', 'ROYAUME-UNI'])

export function normalizePhoneCountry(country) {
  const value = String(country || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (NANP_COUNTRIES.has(value)) return 'NANP'
  if (FR_COUNTRIES.has(value)) return 'FR'
  if (GB_COUNTRIES.has(value)) return 'GB'
  return 'OTHER'
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatNanpPhone(value) {
  let digits = digitsOnly(value)
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  digits = digits.slice(0, 10)

  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function formatFrenchPhone(value) {
  const raw = String(value || '').trim()
  let digits = digitsOnly(raw)
  const hasCountryCode = raw.startsWith('+33') || (digits.length > 10 && digits.startsWith('33'))

  if (hasCountryCode) {
    digits = digits.replace(/^33/, '').replace(/^0/, '').slice(0, 9)
    const groups = [digits.slice(0, 1)]
    for (let i = 1; i < digits.length; i += 2) groups.push(digits.slice(i, i + 2))
    return ['+33', ...groups.filter(Boolean)].join(' ')
  }

  digits = digits.slice(0, 10)
  const groups = []
  for (let i = 0; i < digits.length; i += 2) groups.push(digits.slice(i, i + 2))
  return groups.filter(Boolean).join(' ')
}

function groupGbDigits(digits) {
  if (digits.length <= 4) return digits
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
}

function formatBritishPhone(value) {
  const raw = String(value || '').trim()
  let digits = digitsOnly(raw)
  const hasCountryCode = raw.startsWith('+44') || (digits.length > 10 && digits.startsWith('44'))

  if (hasCountryCode) {
    digits = digits.replace(/^44/, '').replace(/^0/, '').slice(0, 10)
    return `+44 ${groupGbDigits(digits)}`.trim()
  }

  return groupGbDigits(digits.slice(0, 11))
}

function formatInternationalPhone(value) {
  const raw = String(value || '').trim()
  const prefix = raw.startsWith('+') ? '+' : ''
  const digits = digitsOnly(raw).slice(0, 15)
  const groups = []
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3))
  return `${prefix}${groups.filter(Boolean).join(' ')}`.trim()
}

export function formatPhoneForCountry(value, country = 'CA') {
  if (!String(value || '').trim()) return ''

  switch (normalizePhoneCountry(country)) {
    case 'NANP':
      return formatNanpPhone(value)
    case 'FR':
      return formatFrenchPhone(value)
    case 'GB':
      return formatBritishPhone(value)
    default:
      return formatInternationalPhone(value)
  }
}
