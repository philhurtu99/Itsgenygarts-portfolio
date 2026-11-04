import { useEffect, useId, useRef } from 'react'
import { useCustomsProfiles } from './CategoryCustomsProfile.jsx'
import { displayName } from './BilingualTextFields.jsx'
import CustomsProfilePicker, { CustomsOriginField } from './CustomsProfilePicker.jsx'

const CUSTOMS_KEYS = ['customsDescription', 'customsWeightGrams', 'customsOriginCountry', 'customsHsCode']

export function customsInitial(item = {}, category) {
  const fields = Object.fromEntries(CUSTOMS_KEYS.map((key) => [key, item[key] ?? '']))
  const matchesCategory = Boolean(item.customsProfileKey && item.customsProfileKey === category?.customsProfileKey
    && item.customsOriginCountry === category?.customsOriginCountry)
  return {
    ...fields, customsProfileKey: item.customsProfileKey || '',
    customsMode: item.customsProfileKey || (fields.customsDescription || fields.customsHsCode ? 'manual' : fields.customsWeightGrams || fields.customsOriginCountry ? 'guided' : ''),
    customsProfileConfirmed: Boolean(item.customsProfileKey),
    customsFollowCategory: matchesCategory || (!item.customsProfileKey && !item.customsDescription && !item.customsHsCode && !fields.customsWeightGrams && !fields.customsOriginCountry),
  }
}

export function customsPayload(form) {
  return {
    customsProfileKey: form.customsProfileKey || null,
    customsDescription: form.customsDescription?.trim() || null,
    customsWeightGrams: form.customsWeightGrams !== '' && form.customsWeightGrams != null ? Number(form.customsWeightGrams) : null,
    customsOriginCountry: form.customsOriginCountry?.trim().toUpperCase() || null,
    customsHsCode: form.customsHsCode?.trim() || null,
  }
}

export function validateCustomsForm(form) {
  if (form.customsProfileKey && !form.customsProfileConfirmed) return 'Confirme que ce profil correspond à l’article.'
  if ((form.customsMode === 'guided' && !form.customsProfileKey) || form.customsProfileKey?.startsWith('international-')) {
    if (form.customsWeightGrams !== '' && form.customsWeightGrams != null && (!Number.isFinite(Number(form.customsWeightGrams)) || Number(form.customsWeightGrams) <= 0)) return 'Le poids net doit être supérieur à zéro.'
    if (form.customsOriginCountry && !/^[A-Z]{2}$/.test(form.customsOriginCountry.trim().toUpperCase())) return 'Vérifie le pays de fabrication.'
    if (Number(form.packageWeightGrams) > 0 && Number(form.customsWeightGrams) > Number(form.packageWeightGrams)) return 'Le poids net ne peut pas dépasser le poids emballé.'
    return null
  }
  const hasData = form.customsProfileKey || CUSTOMS_KEYS.some((key) => form[key] !== '' && form[key] != null)
  if (!hasData) return null
  const description = form.customsDescription?.trim() || ''
  if (description.length < 3 || description.length > 100 || !/^\d{6,12}$/.test(String(form.customsHsCode || '').replace(/[.\s]/g, ''))
    || !/^[A-Z]{2}$/.test(String(form.customsOriginCountry || '').trim().toUpperCase())
    || !Number.isFinite(Number(form.customsWeightGrams)) || Number(form.customsWeightGrams) <= 0) {
    return 'Complète le profil, le pays de fabrication et le poids net, ou laisse les douanes non configurées.'
  }
  if (Number(form.packageWeightGrams) > 0 && Number(form.customsWeightGrams) > Number(form.packageWeightGrams)) {
    return 'Le poids net ne peut pas dépasser le poids emballé.'
  }
  return null
}

export default function CustomsFields({ form, onChange, kind = 'product', error, category }) {
  const id = useId()
  const { profiles, loading, loadError, retry } = useCustomsProfiles(kind)
  const lastCategory = useRef()
  const inheritedOrigin = useRef('')
  const categoryId = category?.id || category?._id || ''
  const categoryKey = category?.customsProfileKey || ''
  const categoryOrigin = category?.customsOriginCountry || ''
  const categoryProfile = profiles.find((profile) => profile.key === categoryKey)
  useEffect(() => {
    if (!form.customsFollowCategory) { lastCategory.current = undefined; return }
    if (loading || loadError) return
    const signature = `${categoryId}:${categoryKey}:${categoryOrigin}`
    if (lastCategory.current === signature) return
    const previous = lastCategory.current
    lastCategory.current = signature
    if (categoryProfile || previous !== undefined || categoryKey) {
      onChange('customsMode', categoryProfile?.key || '')
      onChange('customsProfileKey', categoryProfile?.key || '')
      onChange('customsDescription', categoryProfile?.description || '')
      onChange('customsHsCode', categoryProfile?.hsCode || '')
      onChange('customsProfileConfirmed', Boolean(categoryProfile?.internationalOnly))
      onChange('customsArticleType', categoryProfile?.articleType || categoryProfile?.key || '')
      onChange('customsMaterial', categoryProfile?.material || '')
      if (!form.customsOriginCountry || form.customsOriginCountry === inheritedOrigin.current) {
        const origin = categoryProfile ? categoryOrigin : ''
        onChange('customsOriginCountry', origin)
        inheritedOrigin.current = origin
      }
    }
  }, [categoryId, categoryKey, categoryOrigin, categoryProfile, form.customsFollowCategory, loading, loadError, onChange])
  const selected = profiles.find((profile) => profile.key === form.customsProfileKey)
  const followsOrigin = Boolean(form.customsFollowCategory && categoryProfile?.internationalOnly && categoryOrigin && form.customsOriginCountry === categoryOrigin)
  const mode = form.customsMode ?? (form.customsProfileKey || 'manual')
  const hasUnknownProfile = Boolean(form.customsProfileKey && !selected)
  function chooseProfile(value, choice) {
    onChange('customsFollowCategory', false)
    const profile = profiles.find((entry) => entry.key === value)
    onChange('customsMode', value || (choice?.articleType ? 'guided' : ''))
    onChange('customsProfileKey', profile?.key || '')
    onChange('customsProfileConfirmed', Boolean(profile?.internationalOnly && !profile.requiresConfirmation))
    onChange('customsArticleType', choice?.articleType || profile?.articleType || profile?.key || '')
    onChange('customsMaterial', choice?.material || profile?.material || '')
    if (profile) {
      onChange('customsDescription', profile.description)
      onChange('customsHsCode', profile.hsCode)
      if (!form.customsOriginCountry && category?.customsOriginCountry) onChange('customsOriginCountry', category.customsOriginCountry)
    } else if (value !== 'manual') {
      onChange('customsDescription', '')
      onChange('customsHsCode', '')
      if (!choice?.articleType) CUSTOMS_KEYS.forEach((key) => onChange(key, ''))
    }
  }
  return (
    <fieldset className="customs-fields">
      <legend>Douanes · hors Canada</legend>
      <p className="form-hint">{form.customsFollowCategory && categoryProfile ? 'Indique seulement le poids de l’article. Les autres informations sont reprises de sa catégorie.' : 'Réponds aux questions utiles pour cet article. La description et le code douanier se remplissent automatiquement quand les réponses suffisent.'}</p>
      {category && <p className="customs-category-name"><strong>Catégorie :</strong> {displayName(category)}</p>}
      {form.customsFollowCategory && categoryProfile ? <div className="form-group">
        <label className="form-label">Profil de la catégorie</label>
        <p className="customs-category-profile">{categoryProfile.name}</p>
        <button type="button" className="customs-retry" onClick={() => onChange('customsFollowCategory', false)}>Personnaliser cet article</button>
      </div> : <>
      {mode === 'manual' ? <p className="form-hint">Réglages personnalisés enregistrés. <button type="button" className="customs-retry" onClick={() => chooseProfile('', { articleType: '', material: '' })}>Utiliser le choix automatique</button></p>
        : <CustomsProfilePicker key={categoryId} kind={kind} category={category} profiles={profiles} value={form.customsProfileKey}
          choice={{ articleType: form.customsArticleType, material: form.customsMaterial }} disabled={loading || loadError} onChange={chooseProfile} />}
      <div>
        {loading && <p className="form-hint" role="status">Chargement des profils…</p>}
        {loadError && <p className="form-error" role="alert">Profils indisponibles. <button type="button" className="customs-retry" onClick={retry}>Réessayer</button></p>}
        {categoryProfile && <button type="button" className="customs-retry" onClick={() => onChange('customsFollowCategory', true)}>Utiliser le profil de la catégorie</button>}
      </div>
      </>}
      {hasUnknownProfile && !loading && !loadError && <p className="form-error" role="alert">Le réglage enregistré est indisponible. Choisis un type et une matière adaptés.</p>}
      {!loading && !loadError && categoryKey && !categoryProfile && <p className="form-error" role="alert">Le profil de cette catégorie est indisponible. Configure un profil adapté avant l’expédition internationale.</p>}
      {selected && !(form.customsFollowCategory && selected.internationalOnly) && <div className="customs-profile-scope">
        <p className="customs-ready">Description et codes douaniers remplis automatiquement</p>
        {(!selected.internationalOnly || selected.requiresConfirmation) && <p>{selected.scope}</p>}
        {(!selected.internationalOnly || selected.requiresConfirmation) && <label className="customs-profile-confirm">
          <input type="checkbox" checked={form.customsProfileConfirmed} onChange={(e) => onChange('customsProfileConfirmed', e.target.checked)} />
          Ces caractéristiques correspondent à mon article
        </label>}
      </div>}
      {selected?.internationalOnly && (!form.customsWeightGrams || !form.customsOriginCountry) && <p className="form-hint" role="status">À compléter avant une livraison internationale : {[!form.customsWeightGrams ? 'poids de l’article' : '', !form.customsOriginCountry ? 'pays de fabrication' : ''].filter(Boolean).join(' et ')}. Tu peux enregistrer l’article en attendant.</p>}
      {mode === 'guided' && !form.customsProfileKey && !form.customsArticleType && <p className="form-hint" role="status">Classification douanière non déterminée. Les ventes au Canada restent disponibles.</p>}
      {mode && <>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-weight`}>Poids net sans emballage (g)</label>
            <input id={`${id}-weight`} className="form-input" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.customsWeightGrams} onChange={(e) => onChange('customsWeightGrams', e.target.value)} />
          </div>
          {followsOrigin ? <div className="form-group"><span className="form-label">Pays où l’article a été fabriqué</span><p className="customs-category-profile">{form.customsOriginCountry === 'CA' ? 'Canada' : form.customsOriginCountry}</p></div>
            : <CustomsOriginField value={form.customsOriginCountry} label={kind === 'product' ? 'Pays où l’article a été fabriqué' : 'Pays de fabrication du fil'} onChange={(value) => { inheritedOrigin.current = ''; onChange('customsOriginCountry', value) }} />}
        </div>
        {kind === 'product' && !followsOrigin && <p className="form-hint">Article entièrement crocheté au Canada à partir de fils : choisis Canada, même si les fils sont importés. Il ne s’agit pas des pays de fabrication ou de teinture des fils.</p>}
        <details className="customs-advanced" open={mode === 'manual' ? true : undefined}>
          <summary>Réglages avancés</summary>
          {selected?.internationalOnly && <p className="form-hint">{selected.scope}</p>}
          {mode !== 'manual' && <button type="button" className="customs-retry" onClick={() => chooseProfile('manual')}>Renseigner un code personnalisé</button>}
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-country-code`}>Autre pays de fabrication (code ISO)</label>
            <input id={`${id}-country-code`} className="form-input" value={form.customsOriginCountry} maxLength={2}
              onChange={(e) => onChange('customsOriginCountry', e.target.value.toUpperCase())} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-description`}>Description douanière en anglais</label>
            <input id={`${id}-description`} className="form-input" value={form.customsDescription} readOnly={Boolean(form.customsProfileKey)} onChange={(e) => onChange('customsDescription', e.target.value)} maxLength={100} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${id}-code`}>Code douanier HS</label>
            <input id={`${id}-code`} className="form-input" type="text" inputMode="numeric" value={form.customsHsCode} readOnly={Boolean(form.customsProfileKey)} onChange={(e) => onChange('customsHsCode', e.target.value)} maxLength={16} />
          </div>
          {selected && <p className="form-hint"><a href={selected.source} target="_blank" rel="noopener noreferrer">Référence du code douanier</a></p>}
        </details>
      </>}
      {!mode && <details className="customs-advanced"><summary>Réglages avancés</summary>
        <button type="button" className="customs-retry" onClick={() => chooseProfile('manual')}>Renseigner un code personnalisé</button>
      </details>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </fieldset>
  )
}
