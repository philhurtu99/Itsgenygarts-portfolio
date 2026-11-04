import { useState } from 'react'
import { msg } from '../utils/messages.js'
import BilingualTextFields, { bilingualInitial, bilingualPayload } from './BilingualTextFields.jsx'
import CategoryCustomsProfile from './CategoryCustomsProfile.jsx'

export default function CategoryModal({ category, onClose, onSave, kind = 'product' }) {
  const isEdit = Boolean(category?.id || category?._id)
  const [form, setForm] = useState({
    ...bilingualInitial(category),
    customsProfileKey: category?.customsProfileKey || '',
    customsOriginCountry: category?.customsOriginCountry || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState(null)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSave() {
    if (!form.nameFr.trim() && !form.nameEn.trim()) {
      setErrors({ name: msg('nameRequired') })
      return
    }

    setSaving(true)
    setApiError(null)
    try {
      await onSave({ ...bilingualPayload(form), customsProfileKey: form.customsProfileKey || null, customsOriginCountry: form.customsOriginCountry || null })
      onClose()
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }} role="dialog" aria-modal="true" aria-label="Catégorie">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifier la catégorie' : kind === 'yarn' ? 'Nouvelle catégorie de laine' : 'Nouvelle catégorie'}</span>
          <button className="modal-close" onClick={onClose} disabled={saving} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">
          {apiError && <div className="alert alert-error">{apiError}</div>}
          <BilingualTextFields form={form} errors={errors} set={set} autoFocus />
          <CategoryCustomsProfile category={form} value={form.customsProfileKey} onChange={(value) => set('customsProfileKey', value)}
            originCountry={form.customsOriginCountry} onOriginChange={(value) => set('customsOriginCountry', value)} kind={kind} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
