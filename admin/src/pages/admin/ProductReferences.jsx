import { useEffect, useRef, useState } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import { msg } from '../../utils/messages.js'
import {
  adminGetProductReferences,
  adminCreateProductReference,
  adminUpdateProductReference,
  adminDeleteProductReference,
  adminGetExistingImages,
} from '../../services/api.js'

const CATEGORIES = ['Cardigan', 'Bonnet']

function RefModal({ editRef, onClose, onSave, existingImages }) {
  const [name, setName] = useState(editRef?.name || '')
  const [category, setCategory] = useState(editRef?.category || CATEGORIES[0])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(editRef?.imageUrl || null)
  const [selectedExisting, setSelectedExisting] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const previewObjectUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
    }
    const previewUrl = URL.createObjectURL(file)
    previewObjectUrlRef.current = previewUrl
    setImageFile(file)
    setImagePreview(previewUrl)
    setSelectedExisting('')
  }

  function handleSelectExisting(url) {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setSelectedExisting(url)
    setImagePreview(url)
    setImageFile(null)
  }

  async function handleSave() {
    if (!name.trim()) { setError(msg('nameRequired')); return }
    setSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('category', category)
      if (imageFile) {
        fd.append('image', imageFile)
      } else if (selectedExisting) {
        fd.append('existingImageUrl', selectedExisting)
      }
      await onSave(fd, editRef?.id)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{editRef ? 'Modifier la référence' : 'Nouvelle référence'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Image</label>

            {/* Current preview */}
            {imagePreview && (
              <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
                <img src={imagePreview} alt="preview" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => document.getElementById('ref-image-input').click()}
              >
                Uploader une image
              </button>
              <button
                type="button"
                className={`btn btn-sm${showPicker ? ' btn-primary' : ' btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setShowPicker(!showPicker)}
              >
                Choisir une existante
              </button>
              <input id="ref-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            </div>

            {/* Existing images picker */}
            {showPicker && (
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '0.75rem',
                maxHeight: 240,
                overflowY: 'auto',
                background: 'var(--color-bg-alt)',
              }}>
                {existingImages.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>Aucune image disponible</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
                    {existingImages.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectExisting(img.url)}
                        title={img.label}
                        style={{
                          cursor: 'pointer',
                          border: selectedExisting === img.url ? '2px solid var(--color-primary)' : '2px solid transparent',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          aspectRatio: '1',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Nom <span className="required-mark">*</span></label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Catégorie <span className="required-mark">*</span></label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
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

export default function AdminProductReferences() {
  const [refs, setRefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [existingImages, setExistingImages] = useState([])

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetProductReferences(filterCat || undefined)
      setRefs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadExistingImages() {
    try {
      const data = await adminGetExistingImages()
      setExistingImages(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [filterCat])

  function openModal(ref) {
    loadExistingImages()
    setModal(ref)
  }

  async function handleSave(formData, refId) {
    if (refId) {
      await adminUpdateProductReference(refId, formData)
    } else {
      await adminCreateProductReference(formData)
    }
    await load()
  }

  async function handleDelete(id) {
    try {
      await adminDeleteProductReference(id)
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
          <h1>Références produits</h1>
          <button className="btn btn-primary" onClick={() => openModal(null)}>
            + Nouvelle référence
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button className={`filter-btn${filterCat === '' ? ' active' : ''}`} onClick={() => setFilterCat('')}>Toutes</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`filter-btn${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
          ))}
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          refs.length === 0 ? (
            <div className="empty-state">Aucune référence pour cette catégorie.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {refs.map((r) => (
                <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: 'var(--color-bg-alt)', overflow: 'hidden' }}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '2.5rem' }}>🧶</div>
                    )}
                  </div>
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{r.name}</div>
                    <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{r.category}</span>
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openModal(r)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => setConfirmDelete(r)}>Supprimer</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {modal !== undefined && (
          <RefModal
            editRef={modal}
            onClose={() => setModal(undefined)}
            onSave={handleSave}
            existingImages={existingImages}
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
                <p>Supprimer la référence <strong>{confirmDelete.name}</strong> ?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
