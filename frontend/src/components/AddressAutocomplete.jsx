import { useState, useRef, useEffect } from 'react'
import { normalizeCountryCode, normalizeSubdivisionCode } from '../utils/address.js'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE',
  'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
])
const CA_PROVINCE_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function inferCountryFromQuery(q) {
  const normalized = normalizeSearchText(q)
  if (/\b(USA|US|UNITED STATES|ETATS UNIS)\b/.test(normalized)) return 'us'
  if (/\b(CANADA|CAN)\b/.test(normalized)) return 'ca'

  const segments = normalized.split(',').slice(1)
  const tokens = segments
    .flatMap((segment) => segment.split(/[^A-Z0-9]+/))
    .filter(Boolean)

  if (tokens.some((token) => US_STATE_CODES.has(token))) return 'us'
  if (tokens.some((token) => CA_PROVINCE_CODES.has(token))) return 'ca'
  return ''
}

export default function AddressAutocomplete({ value, onChange, onSelect, className, placeholder }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function handleChange(value) {
    if (onChange) onChange(value)
    else setQuery(value)
    clearTimeout(debounceRef.current)
    if (!MAPBOX_TOKEN || value.trim().length < 3) {
      abortRef.current?.abort()
      setSuggestions([])
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value.trim()), 300)
  }

  async function fetchSuggestions(q) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const countryHint = inferCountryFromQuery(q)
      const countryFilter = countryHint ? `&country=${countryHint}` : ''
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&types=address&autocomplete=true&limit=10&language=fr${countryFilter}`
      const res = await fetch(url, { signal: controller.signal })
      const data = await res.json()
      setSuggestions(data.features || [])
      setShow(true)
    } catch {
      if (!controller.signal.aborted) setSuggestions([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function handleSelect(feature) {
    setShow(false)

    // Parse the Mapbox result context
    const ctx = {}
    for (const c of (feature.context || [])) {
      const type = c.id.split('.')[0]
      ctx[type] = c
    }

    // Street address = feature.address (number) + feature.text (street name)
    const streetNumber = feature.address || ''
    const streetName = feature.text || ''
    const address = streetNumber ? `${streetNumber} ${streetName}` : streetName

    const city = ctx.place?.text || ctx.locality?.text || ''
    const postcode = ctx.postcode?.text || ''

    // Country
    const countryShort = ctx.country?.short_code?.toLowerCase() || ''
    const countryCode = normalizeCountryCode(countryShort)

    // Province/State
    let provinceCode = ''
    if (ctx.region?.short_code) {
      provinceCode = normalizeSubdivisionCode(countryCode, ctx.region.short_code)
    }

    if (!onChange) setQuery(feature.place_name || address)
    onSelect({
      address,
      city,
      province: provinceCode,
      postalCode: postcode,
      country: countryCode,
    })
  }

  if (!MAPBOX_TOKEN) {
    return null
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className={className || 'form-input'}
        placeholder={placeholder || 'Rechercher votre adresse...'}
        value={value ?? query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShow(true)}
        autoComplete="off"
      />
      {show && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelect(s)}
              style={{
                padding: '0.6rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                borderBottom: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-alt)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {s.place_name}
            </div>
          ))}
        </div>
      )}
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>...</div>
      )}
    </div>
  )
}
