import { useEffect, useRef, useState } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import ObjectUrlImage from '../../components/ObjectUrlImage.jsx'
import ImagePreviewButton from '../../components/ImagePreviewButton.jsx'
import CategoryModal from '../../components/CategoryModal.jsx'
import CustomsFields, { customsInitial, customsPayload, validateCustomsForm } from '../../components/CustomsFields.jsx'
import ProductWizard, { WizardStep, errorsForStep } from '../../components/ProductWizard.jsx'
import ProductSummary from '../../components/ProductSummary.jsx'
import BilingualTextFields, { bilingualInitial, bilingualPayload, displayDescription, displayName } from '../../components/BilingualTextFields.jsx'
import { msg } from '../../utils/messages.js'
import {
  adminGetYarnProducts,
  adminCreateYarnProduct,
  adminUpdateYarnProduct,
  adminDeleteYarnProduct,
  adminUploadYarnImage,
  adminDeleteYarnImage,
  adminGetYarnCategories,
  adminCreateYarnCategory,
  adminUpdateYarnCategory,
  adminDeleteYarnCategory,
  adminGetExistingImages,
} from '../../services/api.js'

const EMPTY_FORM = {
  ...customsInitial(),
  nameFr: '',
  nameEn: '',
  descriptionFr: '',
  descriptionEn: '',
  price: '',
  stock: '',
  category: '',
  soldOut: false,
  packageWeightGrams: '',
  packageLengthCm: '',
  packageWidthCm: '',
  packageHeightCm: '',
}

function isSoldOutFromStock(item) {
  const stock = item?.stockQuantity
  if (stock !== undefined && stock !== null && stock !== '') return Number(stock) <= 0
  return Boolean(item?.soldOut)
}

const tabStyle = (active) => ({
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  cursor: 'pointer',
})

export function YarnModal({ yarn, categories, onClose, onSave, onImageUpload, onImageDelete }) {
  const [form, setForm] = useState(yarn ? {
    ...customsInitial(yarn),
    ...bilingualInitial(yarn),
    price: yarn.price ?? '',
    stock: yarn.stockQuantity ?? '',
    category: yarn.categoryId || yarn.category?.id || '',
    soldOut: isSoldOutFromStock(yarn),
    packageWeightGrams: yarn.packageWeightGrams ?? '',
    packageLengthCm: yarn.packageLengthCm ?? '',
    packageWidthCm: yarn.packageWidthCm ?? '',
    packageHeightCm: yarn.packageHeightCm ?? '',
  } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [images, setImages] = useState(yarn?.images || [])
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState(null)
  const [showCloudinaryPicker, setShowCloudinaryPicker] = useState(false)
  const [cloudinaryImages, setCloudinaryImages] = useState([])
  const fileInputRef = useRef(null)
  const isEdit = !!yarn?.id

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({
      ...e,
      [field]: undefined,
      ...(field.startsWith('name') ? { name: undefined } : {}),
      ...(field.startsWith('package') ? { package: undefined } : {}),
      ...(field.startsWith('customs') ? { customs: undefined } : {}),
    }))
  }

  function setStock(value) {
    setForm((f) => ({
      ...f,
      stock: value,
      soldOut: value === '' ? true : Number(value) <= 0,
    }))
  }

  function validate(step) {
    const e = {}
    if (!form.nameFr.trim() && !form.nameEn.trim()) e.name = msg('nameRequired')
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) e.price = msg('invalidPrice')
    if (form.stock !== '' && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0)) e.stock = 'Le stock doit être un nombre entier positif ou zéro.'
    const packageValues = [form.packageWeightGrams, form.packageLengthCm, form.packageWidthCm, form.packageHeightCm]
    const hasCompletePackage = packageValues.every((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0)
    if (!hasCompletePackage) e.package = 'Le poids et les dimensions emballées sont requis pour la laine.'
    const customsError = validateCustomsForm(form)
    if (customsError) e.customs = customsError
    const filtered = errorsForStep(e, step)
    setErrors(filtered)
    return filtered
  }

  async function uploadFiles(files) {
    setUploadingImage(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('image', file)
        const updated = await onImageUpload(yarn.id, fd)
        if (updated?.images) setImages(updated.images)
      }
    } catch (err) {
      setApiError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    if (isEdit) uploadFiles(files)
    else setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  async function handleDeleteImage(imageId) {
    setDeletingImageId(imageId)
    try {
      const updated = await onImageDelete(yarn.id, imageId)
      if (updated?.images) setImages(updated.images)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setDeletingImageId(null)
    }
  }

  async function handleToggleCloudinaryPicker() {
    if (showCloudinaryPicker) {
      setShowCloudinaryPicker(false)
      return
    }
    try {
      const data = await adminGetExistingImages()
      setCloudinaryImages(Array.isArray(data) ? data : [])
    } catch {
      setCloudinaryImages([])
    }
    setShowCloudinaryPicker(true)
  }

  async function handleSelectCloudinaryImage(url) {
    if (isEdit) {
      setUploadingImage(true)
      setApiError(null)
      try {
        const fd = new FormData()
        fd.append('existingImageUrl', url)
        const updated = await onImageUpload(yarn.id, fd)
        if (updated?.images) setImages(updated.images)
      } catch (err) {
        setApiError(err.message)
      } finally {
        setUploadingImage(false)
      }
    } else {
      setPendingFiles((prev) => [...prev, { __cloudinaryUrl: url }])
    }
  }

  async function handleSave() {
    if (Object.keys(validate()).length) return
    setSaving(true)
    setApiError(null)
    try {
      const stockQuantity = form.stock !== '' ? Number(form.stock) : 0
      await onSave({
        ...customsPayload(form),
        ...bilingualPayload(form),
        price: Number(form.price),
        stockQuantity,
        categoryId: form.category ? Number(form.category) : null,
        soldOut: stockQuantity <= 0,
        packageWeightGrams: Number(form.packageWeightGrams),
        packageLengthCm: Number(form.packageLengthCm),
        packageWidthCm: Number(form.packageWidthCm),
        packageHeightCm: Number(form.packageHeightCm),
      }, pendingFiles)
      onClose()
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProductWizard title={yarn ? 'Modifier la laine' : 'Nouvelle laine'} onClose={onClose} onSave={handleSave}
      validate={validate} saving={saving} apiError={apiError} busy={saving || uploadingImage || deletingImageId != null}>
      {(activeStep) => <>
        <WizardStep index={0} activeStep={activeStep}>
          <BilingualTextFields form={form} errors={errors} set={set} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="yarn-price">Prix ($) <span className="required-mark">*</span></label>
              <input id="yarn-price" type="number" min="0" step="0.01" className={`form-input${errors.price ? ' error' : ''}`} value={form.price} onChange={(e) => set('price', e.target.value)} />
              {errors.price && <p className="form-error">{errors.price}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="yarn-stock">Stock</label>
              <input id="yarn-stock" type="number" min="0" step="1" className="form-input" value={form.stock} onChange={(e) => setStock(e.target.value)} />
              {errors.stock && <p className="form-error">{errors.stock}</p>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="yarn-category">Catégorie de laine</label>
            <select id="yarn-category" className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">-- Aucune --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{displayName(c)}</option>)}
            </select>
          </div>
        </WizardStep>
        <WizardStep index={1} activeStep={activeStep}>
          <div className="form-group">
            <label className="form-label">Photos de la laine</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {images.map((img) => (
                <div key={img.id} style={{ position: 'relative', width: 80, height: 80 }}>
                  <img src={img.imageUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                  <button type="button" className="image-remove-btn" onClick={() => handleDeleteImage(img.id)} disabled={deletingImageId === img.id} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>
                    {deletingImageId === img.id ? '...' : '×'}
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div key={`pending-${i}`} style={{ position: 'relative', width: 80, height: 80 }}>
                  <ObjectUrlImage file={file} src={file.__cloudinaryUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', opacity: 0.7 }} />
                  <button type="button" className="image-remove-btn" onClick={() => setPendingFiles((f) => f.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                {uploadingImage ? 'Upload...' : '+ Ajouter des photos'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleToggleCloudinaryPicker}
                disabled={uploadingImage}
                style={showCloudinaryPicker ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' } : {}}
              >
                Choisir une existante
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif" multiple style={{ display: 'none' }} onChange={handleFilesSelected} />

            {showCloudinaryPicker && (
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                maxHeight: 200,
                overflowY: 'auto',
                background: 'var(--color-bg-alt)',
                marginTop: '0.5rem',
              }}>
                {cloudinaryImages.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Aucune image disponible</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
                    {cloudinaryImages.map((img, i) => (
                      <div
                        key={`${img.url || img.label || 'image'}-${i}`}
                        onClick={() => handleSelectCloudinaryImage(img.url)}
                        title={img.label}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          aspectRatio: '1',
                          border: '2px solid transparent',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                      >
                        <img src={img.url} alt={img.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </WizardStep>
        <WizardStep index={2} activeStep={activeStep}>
          <div className="form-group">
            <label className="form-label">Laine prête à expédier <span className="required-mark">*</span></label>
            <div className="form-row">
              {[
                { key: 'packageWeightGrams', label: 'Poids emballé', unit: 'g', step: '1' },
                { key: 'packageLengthCm', label: 'Longueur', unit: 'cm', step: '0.1' },
                { key: 'packageWidthCm', label: 'Largeur', unit: 'cm', step: '0.1' },
                { key: 'packageHeightCm', label: 'Hauteur', unit: 'cm', step: '0.1' },
              ].map((field) => (
                <div className="form-group" key={field.key} style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={`yarn-${field.key}`}>{field.label}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id={`yarn-${field.key}`}
                      type="number"
                      min="0.1"
                      step={field.step}
                      inputMode="decimal"
                      className={`form-input${errors.package ? ' error' : ''}`}
                      value={form[field.key]}
                      onChange={(e) => set(field.key, e.target.value)}
                    />
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', minWidth: 22 }}>{field.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            {errors.package && <p className="form-error">{errors.package}</p>}
          </div>
          <CustomsFields form={form} onChange={set} kind="yarn" error={errors.customs}
            category={categories.find((category) => String(category.id) === String(form.category))} />
        </WizardStep>
        <WizardStep index={3} activeStep={activeStep}>
          <ProductSummary form={form} photoCount={images.length + pendingFiles.length} kind="yarn" />
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="yarnSoldOut" checked={form.soldOut} onChange={(e) => set('soldOut', e.target.checked)} disabled={form.stock !== '' && Number(form.stock) > 0} />
            <label htmlFor="yarnSoldOut" className="form-label" style={{ marginBottom: 0 }}>Marquer comme vendu</label>
          </div>
        </WizardStep>
      </>}
    </ProductWizard>
  )
}

export default function AdminYarn() {
  const [tab, setTab] = useState('yarn')
  const [yarn, setYarn] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [priceSort, setPriceSort] = useState('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalYarn, setModalYarn] = useState(undefined)
  const [modalCat, setModalCat] = useState(undefined)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [yData, cData] = await Promise.all([adminGetYarnProducts(), adminGetYarnCategories()])
      setYarn(Array.isArray(yData) ? yData : [])
      setCategories(Array.isArray(cData) ? cData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(payload, pendingFiles, yarnId) {
    const saved = yarnId ? await adminUpdateYarnProduct(yarnId, payload) : await adminCreateYarnProduct(payload)
    if (pendingFiles?.length && saved?.id) {
      for (const file of pendingFiles) {
        const fd = new FormData()
        if (file.__cloudinaryUrl) fd.append('existingImageUrl', file.__cloudinaryUrl)
        else fd.append('image', file)
        await adminUploadYarnImage(saved.id, fd)
      }
    }
    await load()
    return saved
  }

  async function handleCategorySave(payload, categoryId) {
    if (categoryId) await adminUpdateYarnCategory(categoryId, payload)
    else await adminCreateYarnCategory(payload)
    await load()
  }

  const getCategoryName = (item) => item.category ? displayName(item.category) : displayName(categories.find((c) => c.id === item.categoryId))
  const getYarnImageUrl = (item) => item.mainImageUrl || item.images?.[0]?.imageUrl || ''
  const renderYarnStatus = (item) => isSoldOutFromStock(item)
    ? <span className="badge badge-red">Vendu</span>
    : <span className="badge badge-green">En stock</span>

  const filteredYarn = yarn.filter((item) => {
    if (categoryFilter !== 'all' && String(item.categoryId || item.category?.id || '') !== categoryFilter) return false
    if (statusFilter === 'in-stock' && isSoldOutFromStock(item)) return false
    if (statusFilter === 'sold' && !isSoldOutFromStock(item)) return false
    const price = Number(item.price)
    if (priceMin !== '' && price < Number(priceMin)) return false
    if (priceMax !== '' && price > Number(priceMax)) return false
    return true
  })
  if (priceSort !== 'default') {
    filteredYarn.sort((a, b) => priceSort === 'asc'
      ? Number(a.price) - Number(b.price)
      : Number(b.price) - Number(a.price))
  }
  const hasFilters = categoryFilter !== 'all' || statusFilter !== 'all'
    || priceMin !== '' || priceMax !== '' || priceSort !== 'default'

  function resetFilters() {
    setCategoryFilter('all')
    setStatusFilter('all')
    setPriceMin('')
    setPriceMax('')
    setPriceSort('default')
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Laines</h1>
          {tab === 'yarn'
            ? <button className="btn btn-primary" onClick={() => setModalYarn(null)}>+ Nouvelle laine</button>
            : <button className="btn btn-primary" onClick={() => setModalCat({})}>+ Nouvelle catégorie</button>
          }
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
          <button style={tabStyle(tab === 'yarn')} onClick={() => setTab('yarn')}>Laines</button>
          <button style={tabStyle(tab === 'categories')} onClick={() => setTab('categories')}>Catégories</button>
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && tab === 'yarn' && (
          <>
            <div className="card admin-product-filters">
              <div className="admin-product-filter-grid">
                <div>
                  <label className="form-label" htmlFor="admin-yarn-category-filter">Catégorie</label>
                  <select id="admin-yarn-category-filter" className="form-input"
                    value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="all">Toutes les catégories</option>
                    {categories.map((category) => {
                      const id = String(category.id || '')
                      return id ? <option key={id} value={id}>{displayName(category)}</option> : null
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-yarn-status-filter">Statut</label>
                  <select id="admin-yarn-status-filter" className="form-input"
                    value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Tous les statuts</option>
                    <option value="in-stock">En stock</option>
                    <option value="sold">Vendu</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-yarn-price-min">Prix minimum ($)</label>
                  <input id="admin-yarn-price-min" className="form-input" type="number" min="0" step="0.01"
                    placeholder="Sans minimum" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-yarn-price-max">Prix maximum ($)</label>
                  <input id="admin-yarn-price-max" className="form-input" type="number" min="0" step="0.01"
                    placeholder="Sans maximum" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-yarn-price-sort">Trier par prix</label>
                  <select id="admin-yarn-price-sort" className="form-input"
                    value={priceSort} onChange={(e) => setPriceSort(e.target.value)}>
                    <option value="default">Ordre habituel</option>
                    <option value="asc">Prix croissant</option>
                    <option value="desc">Prix décroissant</option>
                  </select>
                </div>
              </div>
              <div className="admin-product-filter-summary">
                <span role="status">{filteredYarn.length} laine{filteredYarn.length > 1 ? 's' : ''}</span>
                {hasFilters && <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Réinitialiser</button>}
              </div>
            </div>

            <div className="table-container responsive-table-container admin-mobile-replaced-table">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Nom</th>
                    <th>Catégorie</th>
                    <th>Prix</th>
                    <th>Stock</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredYarn.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune laine</td></tr>
                  ) : filteredYarn.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Image">
                        {getYarnImageUrl(item)
                          ? <ImagePreviewButton src={getYarnImageUrl(item)} images={item.images} alt={displayName(item)} imageStyle={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                          : <div style={{ width: 48, height: 48, background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🧶</div>
                        }
                      </td>
                      <td data-label="Nom" style={{ fontWeight: 600 }}>{displayName(item)}</td>
                      <td data-label="Catégorie">{getCategoryName(item)}</td>
                      <td data-label="Prix">{item.price != null ? `${Number(item.price).toFixed(2)} $` : '—'}</td>
                      <td data-label="Stock">{item.stockQuantity ?? '—'}</td>
                      <td data-label="Statut">{renderYarnStatus(item)}</td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModalYarn(item)}>Modifier</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...item, _type: 'yarn' })}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-products-mobile-list">
              {filteredYarn.length === 0 ? (
                <div className="admin-product-mobile-empty">Aucune laine</div>
              ) : filteredYarn.map((item) => {
                const imageUrl = getYarnImageUrl(item)
                return (
                  <article className="admin-product-mobile-card" key={item.id}>
                    <div className="admin-product-mobile-image">
                      {imageUrl ? <ImagePreviewButton src={imageUrl} images={item.images} alt={displayName(item)} /> : <span>🧶</span>}
                    </div>
                    <div className="admin-product-mobile-content">
                      <div className="admin-product-mobile-header">
                        <div>
                          <h2>{displayName(item)}</h2>
                          <p>{getCategoryName(item)}</p>
                        </div>
                        <strong>{item.price != null ? `${Number(item.price).toFixed(2)} $` : '—'}</strong>
                      </div>
                      <div className="admin-product-mobile-meta">
                        <span>Stock {item.stockQuantity ?? '—'}</span>
                        <div>{renderYarnStatus(item)}</div>
                      </div>
                      <div className="admin-product-mobile-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setModalYarn(item)}>Modifier</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...item, _type: 'yarn' })}>Supprimer</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {!loading && !error && tab === 'categories' && (
          <>
            <div className="table-container responsive-table-container admin-mobile-replaced-table">
              <table className="responsive-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Description</th>
                  <th>Laines</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune catégorie</td></tr>
                ) : categories.map((category) => (
                  <tr key={category.id}>
                    <td data-label="Nom" style={{ fontWeight: 600 }}>{displayName(category)}</td>
                    <td data-label="Description" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{displayDescription(category)}</td>
                    <td data-label="Laines">{yarn.filter((item) => item.categoryId === category.id || item.category?.id === category.id).length}</td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(category)}>Modifier</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...category, _type: 'category' })}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <div className="admin-compact-mobile-list">
              {categories.length === 0 ? (
                <div className="admin-compact-mobile-empty">Aucune catégorie</div>
              ) : categories.map((category) => {
                const count = yarn.filter((item) => item.categoryId === category.id || item.category?.id === category.id).length
                return (
                  <article className="admin-compact-mobile-card" key={category.id}>
                    <div className="admin-compact-mobile-top">
                      <div className="admin-compact-mobile-title">
                        <h2>{displayName(category)}</h2>
                        <p>{displayDescription(category, 'Aucune description')}</p>
                      </div>
                      <div className="admin-compact-mobile-value">{count}</div>
                    </div>
                    <div className="admin-compact-mobile-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(category)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...category, _type: 'category' })}>Supprimer</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {modalYarn !== undefined && (
          <YarnModal
            yarn={modalYarn}
            categories={categories}
            onClose={() => setModalYarn(undefined)}
            onSave={(payload, pendingFiles) => handleSave(payload, pendingFiles, modalYarn?.id)}
            onImageUpload={async (id, fd) => { const result = await adminUploadYarnImage(id, fd); await load(); return result }}
            onImageDelete={async (id, imageId) => { const result = await adminDeleteYarnImage(id, imageId); await load(); return result }}
          />
        )}

        {modalCat !== undefined && (
          <CategoryModal
            kind="yarn"
            category={modalCat}
            onClose={() => setModalCat(undefined)}
            onSave={(payload) => handleCategorySave(payload, modalCat?.id)}
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
                <p>{confirmDelete._type === 'category'
                  ? <>Supprimer la catégorie <strong>{displayName(confirmDelete)}</strong> ? Les laines associées ne seront pas supprimées.</>
                  : <>Voulez-vous vraiment supprimer <strong>{displayName(confirmDelete)}</strong> ?</>
                }</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={async () => {
                  if (confirmDelete._type === 'category') await adminDeleteYarnCategory(confirmDelete.id)
                  else await adminDeleteYarnProduct(confirmDelete.id)
                  setConfirmDelete(null)
                  await load()
                }}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
