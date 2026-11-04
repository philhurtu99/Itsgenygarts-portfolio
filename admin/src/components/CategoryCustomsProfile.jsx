import { useEffect, useState } from 'react'
import { adminGetCustomsProfiles } from '../services/api.js'
import CustomsProfilePicker, { CustomsOriginField } from './CustomsProfilePicker.jsx'

export function useCustomsProfiles(kind) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    adminGetCustomsProfiles().then((data) => {
      if (active) setProfiles((Array.isArray(data) ? data : []).filter((profile) => profile.kind === kind))
    }).catch(() => { if (active) setLoadError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [kind, attempt])
  return { profiles, loading, loadError, retry: () => setAttempt((value) => value + 1) }
}

export default function CategoryCustomsProfile({ value, onChange, originCountry = '', onOriginChange, kind = 'product', category }) {
  const [choice, setChoice] = useState({})
  const { profiles, loading, loadError, retry } = useCustomsProfiles(kind)
  const selected = profiles.find((profile) => profile.key === value)
  return <fieldset className="customs-fields">
    <legend>Douanes · hors Canada</legend>
    <div className="form-group">
      <p className="form-hint">Ces réponses seront reprises dans les articles de cette catégorie. La description et les codes douaniers se remplissent automatiquement.</p>
      <CustomsProfilePicker key={category?.nameFr || category?.name || category?.nameEn || ''} kind={kind} category={category} profiles={profiles} value={value} choice={choice} disabled={loading || loadError}
        onChange={(key, nextChoice) => { setChoice(nextChoice); onChange(key) }} />
      {value && !selected && !loading && !loadError && <p className="form-error" role="alert">Le réglage enregistré est indisponible. Choisis un type et une matière adaptés.</p>}
      {onOriginChange && <CustomsOriginField value={originCountry} onChange={onOriginChange} optional />}
      {loading && <p className="form-hint" role="status">Chargement des profils…</p>}
      {loadError && <p className="form-error" role="alert">Profils indisponibles. <button type="button" className="customs-retry" onClick={retry}>Réessayer</button></p>}
      {selected && (!selected.internationalOnly || selected.requiresConfirmation) && <p className="form-hint">{selected.scope}</p>}
      {selected && <details className="customs-advanced"><summary>Détails douaniers</summary>
        {selected.internationalOnly && <p className="form-hint">{selected.scope}</p>}
        <p className="form-hint">HS : {selected.hsCode} · <a href={selected.source} target="_blank" rel="noopener noreferrer">Référence</a></p>
      </details>}
    </div>
  </fieldset>
}
