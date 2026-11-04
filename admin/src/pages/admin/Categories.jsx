import { useEffect, useState } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import BilingualTextFields, { bilingualInitial, bilingualPayload, displayDescription, displayName } from '../../components/BilingualTextFields.jsx'
import { msg } from '../../utils/messages.js'
import {
  adminGetCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from '../../services/api.js'

function CategoryModal({ category, onClose, onSave }) {
  const isEdit = Boolean(category?.id || category?._id)
  const [form, setForm] = useState({ ...bilingualInitial(category) })
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
      await onSave(bilingualPayload(form))
      onClose()
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifier la categorie' : 'Nouvelle categorie'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {apiError && <div className="alert alert-error">{apiError}</div>}
          <BilingualTextFields form={form} errors={errors} set={set} autoFocus />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalCat, setModalCat] = useState(undefined)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetCategories()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(payload, catId) {
    if (catId) {
      await adminUpdateCategory(catId, payload)
    } else {
      await adminCreateCategory(payload)
    }
    await load()
  }

  async function handleDelete(id) {
    try {
      await adminDeleteCategory(id)
      setConfirmDelete(null)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Categories</h1>
          <button className="btn btn-primary" onClick={() => setModalCat({})}>
            + Nouvelle categorie
          </button>
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune categorie</td></tr>
                ) : categories.map((c) => (
                  <tr key={c._id || c.id}>
                    <td data-label="Nom" style={{ fontWeight: 600 }}>{displayName(c)}</td>
                    <td data-label="Description" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{displayDescription(c)}</td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(c)}>
                          Modifier
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(c)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalCat !== undefined && (
          <CategoryModal
            category={modalCat}
            onClose={() => setModalCat(undefined)}
            onSave={(payload) => handleSave(payload, modalCat?._id || modalCat?.id)}
          />
        )}

        {confirmDelete && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <span className="modal-title">Confirmer la suppression</span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
              </div>
              <div className="modal-body">
                <p>
                  Supprimer la categorie <strong>{displayName(confirmDelete)}</strong> ?
                  Les produits associes ne seront pas supprimes.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete._id || confirmDelete.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
