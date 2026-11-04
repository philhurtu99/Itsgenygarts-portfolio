const COUNTRY_LABEL_KEYS = ['CA', 'US', 'FR', 'GB', 'OTHER']

const COMMON_INTERNATIONAL_COUNTRIES = [
  'AU', 'AT', 'BE', 'BR', 'CH', 'CN', 'CZ', 'DE', 'DK', 'ES', 'FI', 'GR',
  'IE', 'IN', 'IT', 'JP', 'KR', 'LU', 'MX', 'NL', 'NO', 'NZ', 'PL', 'PT',
  'SE', 'SG',
]

export const COUNTRY_OPTIONS = COUNTRY_LABEL_KEYS.map((code) => ({ code, labelKey: `countries.${code}` }))

export const SUBDIVISIONS_BY_COUNTRY = {
  CA: [
    ['QC', 'Quebec'], ['ON', 'Ontario'], ['BC', 'British Columbia'], ['AB', 'Alberta'],
    ['MB', 'Manitoba'], ['SK', 'Saskatchewan'], ['NS', 'Nova Scotia'], ['NB', 'New Brunswick'],
    ['NL', 'Newfoundland and Labrador'], ['PE', 'Prince Edward Island'], ['NT', 'Northwest Territories'],
    ['YT', 'Yukon'], ['NU', 'Nunavut'],
  ],
  US: [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
    ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
    ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
    ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
    ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'],
    ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
    ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
    ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
    ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
    ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
    ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'],
    ['WY', 'Wyoming'],
  ],
  FR: [
    ['ARA', 'Auvergne-Rhone-Alpes'], ['BFC', 'Bourgogne-Franche-Comte'], ['BRE', 'Bretagne'],
    ['CVL', 'Centre-Val de Loire'], ['COR', 'Corse'], ['GES', 'Grand Est'], ['HDF', 'Hauts-de-France'],
    ['IDF', 'Ile-de-France'], ['NOR', 'Normandie'], ['NAQ', 'Nouvelle-Aquitaine'],
    ['OCC', 'Occitanie'], ['PDL', 'Pays de la Loire'], ['PAC', 'Provence-Alpes-Cote d Azur'],
    ['GP', 'Guadeloupe'], ['MQ', 'Martinique'], ['GF', 'Guyane'], ['RE', 'La Reunion'], ['YT', 'Mayotte'],
  ],
  GB: [
    ['ENG', 'England'], ['SCT', 'Scotland'], ['WLS', 'Wales'], ['NIR', 'Northern Ireland'],
  ],
}

const COUNTRY_ALIASES = {
  CANADA: 'CA',
  'UNITED STATES': 'US',
  USA: 'US',
  'ETATS-UNIS': 'US',
  FRANCE: 'FR',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  'ROYAUME-UNI': 'GB',
}

export function normalizeCountryCode(country) {
  const value = String(country || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!value) return ''
  if (COUNTRY_LABEL_KEYS.includes(value)) return value
  if (COUNTRY_ALIASES[value]) return COUNTRY_ALIASES[value]
  return /^[A-Z]{2}$/.test(value) ? value : 'OTHER'
}

export function getCountryOptions(t, locale = 'fr') {
  const featured = COUNTRY_OPTIONS
    .filter(({ code }) => code !== 'OTHER')
    .map(({ code, labelKey }) => ({ code, label: t(labelKey) }))
  let displayNames = null
  try {
    displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    // Older browsers can still use the ISO code as a readable fallback.
  }
  const international = COMMON_INTERNATIONAL_COUNTRIES.map((code) => ({
    code,
    label: displayNames?.of(code) || code,
  })).sort((a, b) => a.label.localeCompare(b.label, locale))
  return [
    ...featured,
    ...international,
    { code: 'OTHER', label: t('countries.OTHER') },
  ]
}

export function isValidCountryCode(country) {
  return /^[A-Z]{2}$/.test(normalizeCountryCode(country))
}

export function isShippingDestinationAllowed(country) {
  return normalizeCountryCode(country) !== 'US'
}

export function getCountryLabel(country, t, locale = 'fr') {
  const code = normalizeCountryCode(country)
  return getCountryOptions(t, locale).find((option) => option.code === code)?.label || code
}

export function getSubdivisionOptions(country) {
  return SUBDIVISIONS_BY_COUNTRY[normalizeCountryCode(country)] || []
}

export function getSubdivisionLabel(country, value) {
  const code = String(value || '').trim()
  if (!code) return ''
  return getSubdivisionOptions(country).find(([subCode]) => subCode === code)?.[1] || code
}

export function normalizeSubdivisionCode(country, value) {
  const normalizedCountry = normalizeCountryCode(country)
  const raw = String(value || '').trim()
  const upper = raw.toUpperCase()
  const prefix = `${normalizedCountry}-`
  const code = upper.startsWith(prefix) ? upper.slice(prefix.length) : upper
  return getSubdivisionOptions(normalizedCountry).some(([subCode]) => subCode === code) ? code : raw
}

export function isSubdivisionRequired(country) {
  return ['CA', 'US'].includes(normalizeCountryCode(country))
}
