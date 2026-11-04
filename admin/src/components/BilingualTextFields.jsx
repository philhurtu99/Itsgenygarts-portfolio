import { useId, useState } from 'react'

export function bilingualInitial(source = {}) {
  source = source || {}
  return {
    nameFr: source.nameFr || source.name || '',
    nameEn: source.nameEn || '',
    descriptionFr: source.descriptionFr || source.description || '',
    descriptionEn: source.descriptionEn || '',
  }
}

export function bilingualPayload(form) {
  const nameFr = (form.nameFr || '').trim()
  const nameEn = (form.nameEn || '').trim()
  const descriptionFr = (form.descriptionFr || '').trim()
  const descriptionEn = (form.descriptionEn || '').trim()

  return {
    name: nameFr || nameEn,
    nameFr,
    nameEn,
    description: descriptionFr || descriptionEn,
    descriptionFr,
    descriptionEn,
  }
}

export function displayName(item) {
  return item?.nameFr || item?.name || item?.nameEn || '—'
}

export function displayDescription(item, fallback = '—') {
  return item?.descriptionFr || item?.description || item?.descriptionEn || fallback
}

export default function BilingualTextFields({ form, errors = {}, set, nameLabel = 'Nom', descriptionLabel = 'Description', autoFocus = false }) {
  const [lang, setLang] = useState('fr')
  const id = useId()
  const isFr = lang === 'fr'
  const nameKey = isFr ? 'nameFr' : 'nameEn'
  const descriptionKey = isFr ? 'descriptionFr' : 'descriptionEn'

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-alt)', width: 'fit-content' }}>
        {['fr', 'en'].map((code) => (
          <button
            key={code}
            type="button"
            className={`btn btn-sm ${lang === code ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLang(code)}
            style={{ minWidth: 48, borderRadius: 'var(--radius-pill)' }}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor={`${id}-name`}>{nameLabel} {isFr ? 'français' : 'anglais'} <span className="required-mark">*</span></label>
        <input
          id={`${id}-name`}
          type="text"
          className={`form-input${errors.name ? ' error' : ''}`}
          value={form[nameKey] || ''}
          onChange={(e) => set(nameKey, e.target.value)}
          autoFocus={autoFocus}
        />
        {errors.name && <p className="form-error">{errors.name}</p>}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor={`${id}-description`}>{descriptionLabel} {isFr ? 'française' : 'anglaise'}</label>
        <textarea
          id={`${id}-description`}
          className="form-textarea"
          rows={3}
          value={form[descriptionKey] || ''}
          onChange={(e) => set(descriptionKey, e.target.value)}
        />
      </div>
    </div>
  )
}
