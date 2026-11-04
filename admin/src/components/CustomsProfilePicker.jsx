import { useId, useState } from 'react'
import { suggestedCustomsType, UNCLASSIFIED_TYPES } from '../utils/customsSuggestions.js'

const COUNTRIES = [['CA', 'Canada'], ['US', 'États-Unis'], ['CN', 'Chine'], ['IN', 'Inde'], ['TR', 'Turquie'], ['FR', 'France'], ['GB', 'Royaume-Uni'], ['MX', 'Mexique'], ['VN', 'Vietnam'], ['IT', 'Italie'], ['DE', 'Allemagne'], ['PE', 'Pérou']]

export function CustomsOriginField({ value, onChange, optional = false, label = 'Pays de fabrication' }) {
  const id = useId()
  return <div className="form-group">
    <label className="form-label" htmlFor={id}>{label}{optional ? ' par défaut' : ''}</label>
    <select id={id} className="form-select" value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">{optional ? 'À préciser dans chaque article' : 'Pays inconnu'}</option>
      {value && !COUNTRIES.some(([code]) => code === value) && <option value={value}>{value}</option>}
      {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  </div>
}

export default function CustomsProfilePicker({ profiles, value, choice = {}, onChange, disabled, category, kind = 'product' }) {
  const id = useId()
  const [showAll, setShowAll] = useState(false)
  const selected = profiles.find((profile) => profile.key === value)
  const typeOf = (profile) => profile.articleType || profile.key
  const articleType = choice.articleType ?? (selected ? typeOf(selected) : '')
  const material = choice.material ?? selected?.material ?? ''
  const types = [...new Map([...(kind === 'product' ? UNCLASSIFIED_TYPES : []), ...profiles.map((profile) => [typeOf(profile), profile.articleLabel || profile.name])]).entries()]
  const typeProfiles = profiles.filter((profile) => typeOf(profile) === articleType)
  const simpleProfile = typeProfiles.find((profile) => profile.internationalOnly && !profile.material)
  const materials = simpleProfile ? [] : [...new Map(typeProfiles.filter((profile) => profile.material).map((profile) => [profile.material, profile.materialLabel])).entries()]
  const suggestedType = kind === 'product' ? suggestedCustomsType(category) : ''
  const suggested = profiles.find((profile) => typeOf(profile) === suggestedType && profile.internationalOnly)
    || profiles.find((profile) => typeOf(profile) === suggestedType)
    || (types.some(([type]) => type === suggestedType) ? { articleLabel: types.find(([type]) => type === suggestedType)[1] } : null)
  const showSuggestion = suggested && !showAll && (!articleType || articleType === suggestedType)
  const materialQuestion = typeProfiles.find((profile) => profile.materialQuestion)?.materialQuestion || 'Composition du produit fini'
  const needsUnknownComposition = kind === 'product' && articleType && articleType !== 'other' && !simpleProfile && materialQuestion === 'Composition du produit fini'

  function choose(type, nextMaterial) {
    const profile = profiles.find((entry) => typeOf(entry) === type && entry.internationalOnly && !entry.material)
      || profiles.find((entry) => typeOf(entry) === type && (entry.material || '') === nextMaterial)
    onChange(profile?.key || '', { articleType: type, material: profile && !profile.material ? '' : nextMaterial })
  }

  return <>
    {showSuggestion ? <div className="form-group customs-suggestion">
      <p className="form-label">{suggested.articleLabel || suggested.name}</p>
      {!articleType ? <>
        <p className="form-hint">{suggested.suggestionQuestion || 'Est-ce bien ce type d’article ?'}</p>
        <div className="customs-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => choose(suggestedType, '')}>Oui, c’est ça</button>
          <button type="button" className="customs-retry" disabled={disabled} onClick={() => setShowAll(true)}>C’est autre chose</button>
        </div>
      </> : <button type="button" className="customs-retry" onClick={() => setShowAll(true)}>Changer la réponse</button>}
    </div> : <div className="form-group">
      <label className="form-label" htmlFor={`${id}-type`}>Type d’article</label>
      <select id={`${id}-type`} className="form-select" value={articleType} disabled={disabled} onChange={(event) => choose(event.target.value, '')}>
        <option value="">Configurer plus tard</option>
        {types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        <option value="other">Autre type d’article</option>
      </select>
    </div>}
    {materials.length > 0 && !needsUnknownComposition && <div className="form-group">
      <label className="form-label" htmlFor={`${id}-material`}>{materialQuestion}</label>
      <select id={`${id}-material`} className="form-select" value={material} onChange={(event) => choose(articleType, event.target.value)}>
        <option value="">Choisir si tu le sais</option>
        {materials.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        <option value="unknown">Je ne sais pas</option>
        <option value="other">{materialQuestion === 'Composition du produit fini' ? 'Mélange ou autre composition' : 'Autre matière ou sans semelle ajoutée'}</option>
      </select>
      <p className="form-hint">{materialQuestion === 'Composition du produit fini' ? 'Composition de l’article fini, tous les fils réunis. Si le mélange est inconnu, choisis « Je ne sais pas ».' : 'La partie extérieure qui touche le sol. Le dessus doit être en textile au crochet ou tricot.'}</p>
    </div>}
    {needsUnknownComposition && !selected && <p className="form-hint" role="status">Composition inconnue. Le site ne peut pas déterminer automatiquement le code douanier de cet article. Les ventes au Canada restent disponibles.</p>}
    {(articleType === 'other' || material === 'other' || material === 'unknown') && <p className="form-hint" role="status">Classification douanière non déterminée. Les ventes au Canada restent disponibles.</p>}
  </>
}
