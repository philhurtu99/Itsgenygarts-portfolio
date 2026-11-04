import { useId, useState } from 'react'

const SECTIONS = [
  { key: 'sizeFit', label: 'Taille', placeholder: 'Dimensions, mesures et tailles disponibles pour cette pièce…' },
  { key: 'materials', label: 'Matériaux', placeholder: 'Fibres et composition de cette pièce…' },
  { key: 'care', label: 'Entretien', placeholder: 'Consignes de lavage et de séchage pour cette pièce…' },
]
const FIELDS = SECTIONS.flatMap(({ key }) => [`${key}Fr`, `${key}En`])

export function productDetailsInitial(product = {}) {
  return Object.fromEntries(FIELDS.map((key) => [key, product?.[key] || '']))
}

export function productDetailsPayload(form) {
  return Object.fromEntries(FIELDS.map((key) => [key, (form[key] || '').trim()]))
}

export default function ProductDetailsFields({ form, set }) {
  const [language, setLanguage] = useState('Fr')
  const id = useId()
  return (
    <details style={{ margin: '1rem 0', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }} open>
      <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: '0.85rem' }}>Informations sur la pièce</summary>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem' }}>
        {['Fr', 'En'].map((code) => (
          <button key={code} type="button" className={`btn btn-sm ${language === code ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={language === code} onClick={() => setLanguage(code)}>{code.toUpperCase()}</button>
        ))}
      </div>
      {SECTIONS.map(({ key, label, placeholder }) => (
        <div className="form-group" key={key}>
          <label className="form-label" htmlFor={`${id}-${key}`}>{label} — {language === 'Fr' ? 'français' : 'anglais'}</label>
          <textarea id={`${id}-${key}`} className="form-textarea" rows={3} maxLength={10000}
            value={form[`${key}${language}`] || ''} placeholder={placeholder}
            onChange={(event) => set(`${key}${language}`, event.target.value)} />
        </div>
      ))}
    </details>
  )
}
