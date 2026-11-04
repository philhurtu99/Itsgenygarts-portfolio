import { useEffect, useState, useRef } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import ObjectUrlImage from '../../components/ObjectUrlImage.jsx'
import useProductAutosave from '../../components/useProductAutosave.js'
import SortablePhotoRow from '../../components/SortablePhotoRow.jsx'
import CategoryModal from '../../components/CategoryModal.jsx'
import CustomsFields, { customsInitial, customsPayload, validateCustomsForm } from '../../components/CustomsFields.jsx'
import ProductWizard, { WizardStep, errorsForStep } from '../../components/ProductWizard.jsx'
import ProductSummary from '../../components/ProductSummary.jsx'
import ImageLightbox from '../../components/ImageLightbox.jsx'
import ImagePreviewButton from '../../components/ImagePreviewButton.jsx'
import BilingualTextFields, { bilingualInitial, bilingualPayload, displayDescription, displayName } from '../../components/BilingualTextFields.jsx'
import ProductDetailsFields, { productDetailsInitial, productDetailsPayload } from '../../components/ProductDetailsFields.jsx'
import { msg } from '../../utils/messages.js'
import {
  adminGetProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminPatchProduct,
  adminDeleteProduct,
  adminUpdateStock,
  adminCreateMarketSale,
  adminCreateProductPaymentLink,
  adminCreateTapToPayIntent,
  adminSyncTapToPayPayment,
  adminCancelTapToPayPayment,
  adminUploadImage,
  adminDeleteImage,
  adminReorderImages,
  adminGetCategories,
  adminGetExistingImages,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  getAdminAuthToken,
  setAdminAuthToken,
  adminCreateSessionToken,
} from '../../services/api.js'

const EMPTY_FORM = {
  ...customsInitial(),
  ...productDetailsInitial(),
  nameFr: '',
  nameEn: '',
  descriptionFr: '',
  descriptionEn: '',
  price: '',
  stock: 1,
  category: '',
  soldOut: false,
  showSoldVariants: false,
  isDraft: false,
  isFeatured: false,
  packageWeightGrams: '',
  packageLengthCm: '',
  packageWidthCm: '',
  packageHeightCm: '',
}

const VARIANT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function isSoldOutFromStock(item) {
  const stock = item?.stockQuantity ?? item?.stock
  if (stock !== undefined && stock !== null && stock !== '') return Number(stock) <= 0
  return Boolean(item?.soldOut)
}

function buildVariantOptions(variants, stock) {
  const persistedVariants = Array.isArray(variants) ? variants : []
  const stockCount = Number(stock)
  let count = Number.isFinite(stockCount) ? stockCount : persistedVariants.length
  count = Math.max(1, count || 1)
  count = Math.min(count, VARIANT_LABELS.length)
  return Array.from({ length: count }, (_, index) => ({
    id: persistedVariants[index]?.id || null,
    label: persistedVariants[index]?.label || VARIANT_LABELS[index],
    colorHex: persistedVariants[index]?.colorHex || '',
    index,
  }))
}

export function ProductModal({ product, categories, onClose, onSave, onAutoSave, onStockChange, onImageUpload, onImageDelete, onImagesReorder }) {
  const initialVariantCount = Math.min(
    VARIANT_LABELS.length,
    Math.max(1, Number(product?.stockQuantity ?? product?.stock ?? 1) || product?.variants?.length || 1)
  )
  const [form, setForm] = useState(product ? {
    ...customsInitial(product, categories.find((category) => category.id === (product.categoryId || product.category?.id))),
    ...bilingualInitial(product),
    ...productDetailsInitial(product),
    price: product.price ?? '',
    stock: initialVariantCount,
    category: product.categoryId || (typeof product.category === 'object' ? product.category?.id : product.category) || '',
    soldOut: isSoldOutFromStock(product),
    showSoldVariants: Boolean(product.showSoldVariants),
    isDraft: product.isDraft || false,
    isFeatured: product.isFeatured || false,
    packageWeightGrams: product.packageWeightGrams ?? '',
    packageLengthCm: product.packageLengthCm ?? '',
    packageWidthCm: product.packageWidthCm ?? '',
    packageHeightCm: product.packageHeightCm ?? '',
  } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [images, setImages] = useState(product?.images || [])
  const [variants, setVariants] = useState(product?.variants || [])
  const [persistedStock, setPersistedStock] = useState(initialVariantCount)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [syncingStock, setSyncingStock] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState(null)
  const [reorderingImages, setReorderingImages] = useState(false)
  const [showCloudinaryPicker, setShowCloudinaryPicker] = useState(false)
  const [cloudinaryImages, setCloudinaryImages] = useState([])
  const [selectedUploadVariantIndex, setSelectedUploadVariantIndex] = useState(null)
  const fileInputRef = useRef(null)
  const uploadVariantIndexRef = useRef(null)

  const productId = product?.id || product?._id
  const isEdit = !!productId
  const variantOptions = buildVariantOptions(variants, form.stock)
  const hasMultipleVariantOptions = variantOptions.length > 1
  const shouldChooseVariantForImages = variantOptions.length > 0
  const shouldRequireVariantPhotos = !form.soldOut && hasMultipleVariantOptions
  const selectedUploadVariant = shouldChooseVariantForImages && selectedUploadVariantIndex !== null
    ? variantOptions[Math.min(selectedUploadVariantIndex, variantOptions.length - 1)]
    : null
  const missingVariantPhotoLabels = shouldRequireVariantPhotos
    ? variantOptions
      .filter((variant) => {
        const hasSavedImage = images.some((image) => {
          if (variant.id && image.variantId === variant.id) return true
          return !variant.id && image.variantLabel === variant.label
        })
        const hasPendingImage = pendingFiles.some((file) => (
          file.__variantIndex === variant.index || (variant.id && file.__variantId === variant.id)
        ))
        return !hasSavedImage && !hasPendingImage
      })
      .map((variant) => variant.label)
    : []

  function buildPayload() {
    const variantCount = Math.min(VARIANT_LABELS.length, Math.max(1, Number(form.stock) || 1))
    const stockQuantity = form.soldOut ? 0 : variantCount
    return {
      ...customsPayload(form),
      ...bilingualPayload(form),
      ...productDetailsPayload(form),
      price: Number(form.price),
      stockQuantity,
      variantColors: variantOptions.map((variant) => variants[variant.index]?.colorHex || null),
      categoryId: form.category ? Number(form.category) : null,
      soldOut: form.soldOut,
      showSoldVariants: form.soldOut && form.showSoldVariants,
      isDraft: form.isDraft,
      isFeatured: form.isFeatured,
      packageWeightGrams: form.packageWeightGrams !== '' ? Number(form.packageWeightGrams) : null,
      packageLengthCm: form.packageLengthCm !== '' ? Number(form.packageLengthCm) : null,
      packageWidthCm: form.packageWidthCm !== '' ? Number(form.packageWidthCm) : null,
      packageHeightCm: form.packageHeightCm !== '' ? Number(form.packageHeightCm) : null,
    }
  }

  function autosaveValidation() {
    if (!form.nameFr.trim() && !form.nameEn.trim()) return msg('nameRequired')
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) return msg('invalidPrice')
    const measures = [form.packageWeightGrams, form.packageLengthCm, form.packageWidthCm, form.packageHeightCm]
    if ((!form.isDraft || measures.some(value => value !== '')) && !measures.every(value => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0)) {
      return 'Complète les quatre mesures emballées pour enregistrer.'
    }
    if (product?.isDraft && !form.isDraft && missingVariantPhotoLabels.length) return 'Ajoute les photos des variations avant de publier.'
    return validateCustomsForm(form)
  }

  const { name: legacyName, description: legacyDescription, ...autosaveValues } = buildPayload()
  const autosave = useProductAutosave({
    enabled: isEdit && Boolean(onAutoSave),
    values: autosaveValues,
    save: async patch => {
      const updated = await onAutoSave(productId, patch)
      if (updated?.variants) replaceVariants(updated.variants)
      if (patch.stockQuantity !== undefined) setPersistedStock(patch.stockQuantity)
    },
    paused: saving || uploadingImage || syncingStock || reorderingImages || deletingImageId != null,
    validationError: autosaveValidation(),
  })

  async function closeProduct() {
    if (await autosave.flush()) onClose()
  }

  useEffect(() => {
    if (!shouldChooseVariantForImages) {
      chooseUploadVariant(0)
      return
    }
    if (selectedUploadVariantIndex >= variantOptions.length) {
      chooseUploadVariant(0)
    }
  }, [shouldChooseVariantForImages, selectedUploadVariantIndex, variantOptions.length])

  function chooseUploadVariant(index) {
    uploadVariantIndexRef.current = index
    setSelectedUploadVariantIndex(index)
  }

  function getUploadVariant() {
    if (!shouldChooseVariantForImages || uploadVariantIndexRef.current === null) return null
    return variantOptions[Math.min(uploadVariantIndexRef.current, variantOptions.length - 1)]
  }

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
    const numeric = value === '' ? '' : Math.min(VARIANT_LABELS.length, Math.max(1, Number(value) || 1))
    setForm((f) => ({
      ...f,
      stock: numeric,
    }))
  }

  function replaceVariants(nextVariants) {
    setVariants((current) => nextVariants.map((variant, index) => {
      const previous = current.find((item) => item.id && item.id === variant.id) || current[index]
      return { ...variant, colorHex: previous?.colorHex ?? variant.colorHex ?? '' }
    }))
  }

  function setVariantColor(index, colorHex) {
    setVariants((current) => {
      const next = [...current]
      next[index] = { ...(next[index] || {}), colorHex }
      return next
    })
  }

  function setSoldOutFlag(checked) {
    const restoredStock = Math.min(VARIANT_LABELS.length, Math.max(1, Number(form.stock) || persistedStock || 1))
    setForm((f) => ({ ...f, stock: restoredStock, soldOut: checked, showSoldVariants: checked && f.showSoldVariants }))
  }

  async function syncStockQuantity(nextStock) {
    if (!isEdit || !onStockChange) return null
    const stock = Math.min(VARIANT_LABELS.length, Math.max(1, Number(nextStock) || 1))
    setSyncingStock(true)
    setApiError(null)
    try {
      await autosave.waitForCurrent()
      const updated = await onStockChange(productId, stock)
      if (updated?.images) setImages(updated.images)
      if (updated?.variants) replaceVariants(updated.variants)
      setPersistedStock(Number(updated?.stockQuantity ?? stock))
      setForm((f) => ({
        ...f,
        stock: Math.min(VARIANT_LABELS.length, Math.max(1, Number(updated?.stockQuantity ?? stock) || stock)),
        soldOut: isSoldOutFromStock(updated),
      }))
      return updated
    } catch (err) {
      setApiError(err.message)
      throw err
    } finally {
      setSyncingStock(false)
    }
  }

  async function handleAdjustStock(delta) {
    const current = Number(form.stock) || 1
    const next = Math.min(VARIANT_LABELS.length, Math.max(1, current + delta))
    setStock(next)
    if (isEdit && !form.soldOut && !onAutoSave) {
      await syncStockQuantity(next).catch(() => {})
    }
  }

  function handleStockBlur() {
    const next = Math.min(VARIANT_LABELS.length, Math.max(1, Number(form.stock) || 1))
    if (next !== form.stock) setStock(next)
    if (!isEdit || form.soldOut || onAutoSave) return
    if (next !== persistedStock) {
      syncStockQuantity(next).catch(() => {})
    }
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const uploadVariant = getUploadVariant()
    const nextFiles = files.map((file) => {
      file.__variantIndex = uploadVariant?.index ?? null
      file.__variantId = uploadVariant?.id ?? null
      return file
    })
    if (isEdit) {
      // Upload immediately for existing product
      uploadFiles(nextFiles)
    } else {
      // Queue for new product (will upload after save)
      setPendingFiles((prev) => [...prev, ...nextFiles])
    }
    e.target.value = ''
  }

  async function uploadFiles(files) {
    setApiError(null)
    setUploadingImage(true)
    try {
      let syncedProduct = null
      if (isEdit && selectedUploadVariant && !selectedUploadVariant.id) {
        syncedProduct = await syncStockQuantity(form.stock)
      }
      for (const file of files) {
        const fd = new FormData()
        fd.append('image', file)
        const syncedVariantId = syncedProduct?.variants?.[file.__variantIndex]?.id
        const variantId = file.__variantId || syncedVariantId
        if (variantId) fd.append('variantId', String(variantId))
        const updated = await onImageUpload(productId, fd)
        if (updated?.images) setImages(updated.images)
        if (updated?.variants) replaceVariants(updated.variants)
      }
    } catch (err) {
      setApiError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleDeleteImage(imageId) {
    setDeletingImageId(imageId)
    try {
      const updated = await onImageDelete(productId, imageId)
      if (updated?.images) setImages(updated.images)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setDeletingImageId(null)
    }
  }

  async function handleReorderImages(nextImages) {
    setReorderingImages(true)
    setApiError(null)
    try {
      const updated = await onImagesReorder(productId, nextImages.map(image => image.id))
      setImages(updated.images)
    } catch (err) {
      setApiError(err.message)
      throw err
    } finally {
      setReorderingImages(false)
    }
  }

  async function handleToggleCloudinaryPicker() {
    if (showCloudinaryPicker) { setShowCloudinaryPicker(false); return }
    await openCloudinaryPicker()
  }

  async function openCloudinaryPicker() {
    try {
      const data = await adminGetExistingImages()
      setCloudinaryImages(Array.isArray(data) ? data : [])
    } catch { setCloudinaryImages([]) }
    setShowCloudinaryPicker(true)
  }

  async function handleSelectCloudinaryImage(url) {
    const uploadVariant = getUploadVariant()
    if (isEdit) {
      // Upload immediately for existing product
      setUploadingImage(true)
      try {
        let variantId = uploadVariant?.id
        if (uploadVariant && !variantId) {
          const syncedProduct = await syncStockQuantity(form.stock)
          variantId = syncedProduct?.variants?.[uploadVariant.index]?.id || null
        }
        const fd = new FormData()
        fd.append('existingImageUrl', url)
        if (variantId) fd.append('variantId', String(variantId))
        const updated = await onImageUpload(productId, fd)
        if (updated?.images) setImages(updated.images)
        if (updated?.variants) replaceVariants(updated.variants)
      } catch (err) {
        setApiError(err.message)
      } finally {
        setUploadingImage(false)
      }
    } else {
      setPendingFiles((prev) => [...prev, {
        __cloudinaryUrl: url,
        __variantIndex: uploadVariant?.index ?? null,
        __variantId: uploadVariant?.id ?? null,
      }])
    }
  }

  function validate(step) {
    const e = {}
    if (!form.nameFr.trim() && !form.nameEn.trim()) e.name = msg('nameRequired')
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) e.price = msg('invalidPrice')
    const packageValues = [form.packageWeightGrams, form.packageLengthCm, form.packageWidthCm, form.packageHeightCm]
    const hasCompletePackage = packageValues.every((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0)
    if (step === undefined && !form.isDraft && !hasCompletePackage) {
      e.package = 'Le poids et les dimensions emballées sont requis pour publier le produit.'
    } else if (packageValues.some((value) => value !== '') && !hasCompletePackage) {
      e.package = 'Complète les quatre mesures emballées avec des valeurs supérieures à zéro.'
    }
    if (missingVariantPhotoLabels.length > 0) {
      e.images = `Ajoutez au moins une photo pour chaque variation: ${missingVariantPhotoLabels.join(', ')}.`
    }
    const customsError = validateCustomsForm(form)
    if (customsError) e.customs = customsError
    const filtered = errorsForStep(e, step)
    setErrors(filtered)
    return filtered
  }

  async function handleSave() {
    if (Object.keys(validate()).length) return
    if (!await autosave.flush()) return
    setSaving(true)
    setApiError(null)
    try {
      await onSave(buildPayload(), pendingFiles)
      onClose()
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function savedImagesForVariant(variant) {
    return images.filter((image) => {
      if (variant.id && image.variantId) return String(image.variantId) === String(variant.id)
      return image.variantLabel === variant.label
    })
  }

  function pendingFilesForVariant(variant) {
    return pendingFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => (
        file.__variantIndex === variant.index || (variant.id && file.__variantId === variant.id)
      ))
  }

  function generalSavedImages() {
    return images.filter((image) => !image.variantId && !image.variantLabel)
  }

  function generalPendingFiles() {
    return pendingFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.__variantIndex === null || file.__variantIndex === undefined)
  }

  function simpleProductSavedImages() {
    const primaryVariant = variantOptions[0]
    const seen = new Set()
    return [
      ...generalSavedImages(),
      ...(primaryVariant ? savedImagesForVariant(primaryVariant) : []),
    ].filter((image) => {
      const key = image.id || image.imageUrl
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)
  }

  function simpleProductPendingFiles() {
    const primaryVariant = variantOptions[0]
    const seen = new Set()
    return [
      ...generalPendingFiles(),
      ...(primaryVariant ? pendingFilesForVariant(primaryVariant) : []),
    ].filter(({ index }) => {
      if (seen.has(index)) return false
      seen.add(index)
      return true
    })
  }

  function triggerFileUploadForVariant(index) {
    chooseUploadVariant(index)
    window.requestAnimationFrame(() => fileInputRef.current?.click())
  }

  async function openCloudinaryForVariant(index) {
    if (showCloudinaryPicker && selectedUploadVariantIndex === index) {
      setShowCloudinaryPicker(false)
      return
    }
    chooseUploadVariant(index)
    await openCloudinaryPicker()
  }

  function imageThumb({ key, image, file, pendingIndex, label }) {
    return (
      <div key={key} style={{ position: 'relative', width: 72, height: 72, flex: '0 0 auto' }}>
        {image ? (
          <img
            src={image.imageUrl}
            alt=""
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', display: 'block' }}
          />
        ) : (
          <ObjectUrlImage
            file={file}
            src={file.__cloudinaryUrl}
            alt=""
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', opacity: 0.78 }}
          />
        )}
        {label && (
          <div style={{
            position: 'absolute', left: 4, bottom: 4,
            minWidth: 20, height: 20, borderRadius: 999,
            background: 'rgba(196,96,122,0.92)', color: 'white',
            fontSize: '0.72rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{label}</div>
        )}
        <button
          type="button"
          className="image-remove-btn"
          onClick={() => image ? handleDeleteImage(image.id) : setPendingFiles((f) => f.filter((_, idx) => idx !== pendingIndex))}
          disabled={reorderingImages || (image && deletingImageId === image.id)}
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 20, height: 20, borderRadius: '50%',
            background: '#ef4444', color: 'white', border: 'none',
            fontSize: '0.7rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {image && deletingImageId === image.id ? '...' : '×'}
        </button>
      </div>
    )
  }

  function renderPhotoRow({ saved, pending, emptyText, label, sortable = false }) {
    if (sortable && saved.length > 1 && pending.length === 0) {
      return <SortablePhotoRow images={saved} onReorder={handleReorderImages}
        disabled={reorderingImages || uploadingImage || syncingStock || saving || deletingImageId != null}
        renderImage={image => imageThumb({ key: `image-${image.id}`, image })} />
    }
    const hasPhotos = saved.length > 0 || pending.length > 0
    return (
      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', overflowY: 'visible', padding: hasPhotos ? '0.55rem 0.45rem 0.25rem 0.1rem' : 0 }}>
        {saved.map((img) => imageThumb({ key: `image-${img.id}`, image: img, label }))}
        {pending.map(({ file, index }) => imageThumb({ key: `pending-${index}`, file, pendingIndex: index, label }))}
        {!hasPhotos && (
          <div style={{
            minHeight: 72,
            flex: 1,
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem',
            textAlign: 'center',
          }}>
            {emptyText}
          </div>
        )}
      </div>
    )
  }

  function renderCloudinaryPicker() {
    return (
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '0.75rem',
        maxHeight: 200,
        overflowY: 'auto',
        background: 'var(--color-bg-alt)',
        marginTop: '0.5rem',
      }}>
        {hasMultipleVariantOptions && shouldChooseVariantForImages && selectedUploadVariant && (
          <p style={{ margin: '0 0 0.65rem', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
            Choisir une photo pour la variation {selectedUploadVariant.label}.
          </p>
        )}
        {cloudinaryImages.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>Aucune image disponible</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
            {cloudinaryImages.map((img, i) => (
              <div
                key={i}
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
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <ProductWizard title={product ? 'Modifier le produit' : 'Nouveau produit'} onClose={closeProduct} onSave={handleSave}
      saveStatus={isEdit && onAutoSave ? autosave : null}
      quickSave={isEdit}
      validate={validate} saving={saving} apiError={apiError} busy={saving || uploadingImage || syncingStock || reorderingImages || deletingImageId != null}>
      {(activeStep) => <>
        <WizardStep index={0} activeStep={activeStep}>
          <BilingualTextFields form={form} errors={errors} set={set} />
          <ProductDetailsFields form={form} set={set} />
          <div className="form-group">
            <label className="form-label" htmlFor="product-price">Prix ($) <span className="required-mark">*</span></label>
            <input id="product-price" type="number" min="0" step="0.01" className={`form-input${errors.price ? ' error' : ''}`} value={form.price} onChange={(e) => set('price', e.target.value)} />
            {errors.price && <p className="form-error">{errors.price}</p>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="product-category">Catégorie</label>
            <select id="product-category" className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">-- Aucune --</option>
              {categories.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{displayName(c)}</option>)}
            </select>
          </div>
        </WizardStep>
        <WizardStep index={1} activeStep={activeStep}>
          {hasMultipleVariantOptions && <section aria-label="Photos de présentation" className="product-presentation-photos" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Photos de présentation</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              Affichées en premier, sans variation associée. La première sert de photo principale.
            </p>
            {renderPhotoRow({ saved: generalSavedImages(), pending: generalPendingFiles(), emptyText: 'Aucune photo de présentation.' })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerFileUploadForVariant(null)} disabled={uploadingImage || reorderingImages}>
                + Photos de présentation
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCloudinaryForVariant(null)}>
                Choisir une photo de présentation existante
              </button>
            </div>
            {showCloudinaryPicker && selectedUploadVariantIndex === null && renderCloudinaryPicker()}
          </section>}
          <div className="form-group">
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{hasMultipleVariantOptions ? 'Variations' : 'Photos du produit'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAdjustStock(-1)}
                  disabled={syncingStock || Number(form.stock || 0) <= 1}
                  title="Retirer une variation"
                  style={{ padding: 0, minHeight: 44 }}
                >−</button>
              <div>
                <label className="form-label" style={{ marginBottom: '0.3rem' }}>Nombre de variations</label>
                <input
                  type="number"
                  min="1"
                  max={VARIANT_LABELS.length}
                  className="form-input"
                  value={form.stock}
                  onChange={(e) => setStock(e.target.value)}
                  onBlur={handleStockBlur}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleAdjustStock(1)}
                disabled={syncingStock || Number(form.stock || 0) >= VARIANT_LABELS.length}
                title="Ajouter une variation"
                style={{ padding: 0, minHeight: 44 }}
              >+</button>
            </div>
            {syncingStock && <p style={{ margin: '-0.35rem 0 0.65rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Mise à jour des variations...</p>}
            {Number(form.stock || 0) >= VARIANT_LABELS.length && <p style={{ margin: '-0.35rem 0 0.65rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Maximum Z atteint.</p>}
            {hasMultipleVariantOptions && <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {variantOptions.map((variant) => (
                <div key={`color-${variant.index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <label htmlFor={`variant-color-${variant.index}`} style={{ minWidth: 105, fontSize: '0.88rem' }}>Couleur {variant.label}</label>
                  <input
                    id={`variant-color-${variant.index}`}
                    type="color"
                    value={variant.colorHex || '#d9b9a5'}
                    onChange={(event) => setVariantColor(variant.index, event.target.value.toUpperCase())}
                    aria-label={`Choisir la couleur de la variation ${variant.label}`}
                    style={{ width: 42, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{variant.colorHex || 'Aucune couleur choisie'}</span>
                  {variant.colorHex && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVariantColor(variant.index, '')}>Effacer</button>}
                </div>
              ))}
            </div>}
            {hasMultipleVariantOptions ? (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {variantOptions.map((variant) => {
                  const saved = savedImagesForVariant(variant)
                  const pending = pendingFilesForVariant(variant)
                  return (
                    <div
                      key={variant.index}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                        padding: '0.7rem',
                        background: selectedUploadVariant?.index === variant.index ? 'rgba(221,122,143,0.06)' : 'var(--color-bg-alt)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.55rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-gray" style={{ minWidth: 30, justifyContent: 'center' }}>{variant.label}</span>
                          <strong style={{ fontSize: '0.9rem' }}>Variation {variant.label}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => triggerFileUploadForVariant(variant.index)}
                            disabled={uploadingImage || reorderingImages}
                          >
                            {uploadingImage && selectedUploadVariant?.index === variant.index ? 'Upload...' : '+ Photos'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openCloudinaryForVariant(variant.index)}
                            style={showCloudinaryPicker && selectedUploadVariant?.index === variant.index ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' } : {}}
                          >
                            Existante
                          </button>
                        </div>
                      </div>
                      {renderPhotoRow({
                        saved,
                        pending,
                        label: variant.label,
                        emptyText: 'Aucune photo pour cette variation.',
                      })}
                      {showCloudinaryPicker && selectedUploadVariant?.index === variant.index && renderCloudinaryPicker()}
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
                {renderPhotoRow({
                  sortable: isEdit && variants.length <= 1 && Boolean(onImagesReorder),
                  saved: simpleProductSavedImages(),
                  pending: simpleProductPendingFiles(),
                  emptyText: 'Aucune photo pour ce produit.',
                })}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => triggerFileUploadForVariant(0)}
                    disabled={uploadingImage || reorderingImages}
                  >
                    {uploadingImage ? 'Upload...' : '+ Ajouter des photos'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openCloudinaryForVariant(0)}
                    disabled={reorderingImages}
                    style={showCloudinaryPicker ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' } : {}}
                  >
                    Choisir une existante
                  </button>
                </div>
                {showCloudinaryPicker && selectedUploadVariantIndex !== null && renderCloudinaryPicker()}
              </>
            )}
            {missingVariantPhotoLabels.length > 0 && (
              <p className="form-error" role={errors.images ? 'alert' : undefined} style={{ marginTop: '0.35rem' }}>
                Ajoutez au moins une photo pour chaque variation: {missingVariantPhotoLabels.join(', ')}.
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />

          </div>

        </WizardStep>
        <WizardStep index={2} activeStep={activeStep}>
          <div className="form-group">
            <label className="form-label">Produit prêt à expédier {!form.isDraft && <span className="required-mark">*</span>}</label>
            <div className="form-row">
              {[
                { key: 'packageWeightGrams', label: 'Poids emballé', unit: 'g', step: '1' },
                { key: 'packageLengthCm', label: 'Longueur', unit: 'cm', step: '0.1' },
                { key: 'packageWidthCm', label: 'Largeur', unit: 'cm', step: '0.1' },
                { key: 'packageHeightCm', label: 'Hauteur', unit: 'cm', step: '0.1' },
              ].map((field) => (
                <div className="form-group" key={field.key} style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor={field.key}>{field.label}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id={field.key}
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
          <CustomsFields form={form} onChange={set} error={errors.customs}
            category={categories.find((category) => String(category.id || category._id) === String(form.category))} />
        </WizardStep>
        <WizardStep index={3} activeStep={activeStep}>
          <ProductSummary form={form} photoCount={images.length + pendingFiles.length} />
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="soldOut" checked={form.soldOut} onChange={(e) => setSoldOutFlag(e.target.checked)} />
            <label htmlFor="soldOut" className="form-label" style={{ marginBottom: 0 }}>Marquer comme vendu</label>
          </div>
          {form.soldOut && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="showSoldVariants" checked={form.showSoldVariants} onChange={(e) => set('showSoldVariants', e.target.checked)} />
              <label htmlFor="showSoldVariants" className="form-label" style={{ marginBottom: 0 }}>Afficher toutes les variations sur le produit vendu</label>
            </div>
          )}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="isDraft" checked={form.isDraft} onChange={(e) => set('isDraft', e.target.checked)} />
            <label htmlFor="isDraft" className="form-label" style={{ marginBottom: 0 }}>Brouillon non publié</label>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="isFeatured" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
            <label htmlFor="isFeatured" className="form-label" style={{ marginBottom: 0 }}>Mettre en vedette</label>
          </div>
        </WizardStep>
      </>}
    </ProductWizard>
  )
}

// ── Tab style ────────────────────────────────────────────────────────────────

const tabStyle = (active) => ({
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.15s',
})

export function MarketActionsModal({ product, onClose, onSold }) {
  const defaultSalePrice = product?.price != null ? Number(product.price).toFixed(2) : ''
  const availableVariants = Array.isArray(product?.variants) ? product.variants : []
  const [activeMarketTab, setActiveMarketTab] = useState('sale')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [marketCustomerName, setMarketCustomerName] = useState('')
  const [marketCustomerEmail, setMarketCustomerEmail] = useState('')
  const [tapCustomerName, setTapCustomerName] = useState('')
  const [tapCustomerEmail, setTapCustomerEmail] = useState('')
  const [linkCustomerName, setLinkCustomerName] = useState('')
  const [linkCustomerEmail, setLinkCustomerEmail] = useState('')
  const [marketSalePrice, setMarketSalePrice] = useState(defaultSalePrice)
  const [tapSalePrice, setTapSalePrice] = useState(defaultSalePrice)
  const [linkSalePrice, setLinkSalePrice] = useState(defaultSalePrice)
  const [selectedVariantId, setSelectedVariantId] = useState(availableVariants[0]?.id ? String(availableVariants[0].id) : '')
  const [shippingTotal, setShippingTotal] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [tapToPay, setTapToPay] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [loadingAction, setLoadingAction] = useState(null)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [marketPhotoIndex, setMarketPhotoIndex] = useState(0)
  const swipeStartRef = useRef(null)
  const suppressImageClickRef = useRef(false)
  const isNativeApp = typeof window !== 'undefined' && !!window.ReactNativeWebView
  const hasMultipleMarketVariants = availableVariants.length > 1
  const selectedVariant = selectedVariantId
    ? availableVariants.find((variant) => String(variant.id) === selectedVariantId)
    : null

  function normalizeMarketImage(image, variant = null) {
    return {
      ...image,
      variantId: image.variantId || variant?.id || null,
      variantLabel: hasMultipleMarketVariants ? (image.variantLabel || variant?.label || null) : null,
      storagePathOrUrl: image.storagePathOrUrl || image.imageUrl,
      imageUrl: image.imageUrl || image.storagePathOrUrl,
    }
  }

  const productImages = product.images || []
  const variantPhotoOptions = availableVariants.flatMap((variant) => {
    const images = variant.images?.length
      ? variant.images
      : productImages.filter((image) => image.variantId && String(image.variantId) === String(variant.id))
    return images.map((image) => normalizeMarketImage(image, variant))
  })
  const generalPhotoOptions = [
    ...productImages.filter((image) => !image.variantId).map((image) => normalizeMarketImage(image)),
    ...(product.mainImageUrl ? [normalizeMarketImage({ imageUrl: product.mainImageUrl })] : []),
  ]
  const marketImages = [...variantPhotoOptions, ...generalPhotoOptions]
    .filter((image) => image.storagePathOrUrl || image.imageUrl)
    .filter((image, index, list) => {
      const url = image.storagePathOrUrl || image.imageUrl
      return list.findIndex((candidate) => (candidate.storagePathOrUrl || candidate.imageUrl) === url) === index
    })
  const currentMarketImage = marketImages[Math.min(marketPhotoIndex, Math.max(0, marketImages.length - 1))]
  const marketImageUrl = currentMarketImage?.imageUrl || currentMarketImage?.storagePathOrUrl || ''
  const marketImageLabel = hasMultipleMarketVariants ? (currentMarketImage?.variantLabel || selectedVariant?.label || '') : ''

  useEffect(() => {
    const nextDefault = product?.price != null ? Number(product.price).toFixed(2) : ''
    setMarketSalePrice(nextDefault)
    setTapSalePrice(nextDefault)
    setLinkSalePrice(nextDefault)
  }, [product?.id, product?.price])

  useEffect(() => {
    setSelectedVariantId(availableVariants[0]?.id ? String(availableVariants[0].id) : '')
    setMarketPhotoIndex(0)
  }, [product?.id])

  function showMarketPhoto(nextIndex) {
    if (!marketImages.length) return
    const normalizedIndex = (nextIndex + marketImages.length) % marketImages.length
    const nextImage = marketImages[normalizedIndex]
    setMarketPhotoIndex(normalizedIndex)
    if (nextImage?.variantId) {
      setSelectedVariantId(String(nextImage.variantId))
    }
  }

  function handleVariantChange(variantId) {
    setSelectedVariantId(variantId)
    const variantPhotoIndex = marketImages.findIndex((image) => image.variantId && String(image.variantId) === variantId)
    if (variantPhotoIndex >= 0) setMarketPhotoIndex(variantPhotoIndex)
  }

  function handleMarketImageTouchStart(e) {
    const touch = e.touches?.[0]
    if (!touch) return
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleMarketImageTouchEnd(e) {
    if (!swipeStartRef.current) return
    const touch = e.changedTouches?.[0]
    if (!touch) return
    const dx = touch.clientX - swipeStartRef.current.x
    const dy = touch.clientY - swipeStartRef.current.y
    swipeStartRef.current = null
    if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return
    suppressImageClickRef.current = true
    showMarketPhoto(dx < 0 ? marketPhotoIndex + 1 : marketPhotoIndex - 1)
    window.setTimeout(() => {
      suppressImageClickRef.current = false
    }, 250)
  }

  function salePricePayload(value) {
    return value === '' ? undefined : Number(value)
  }

  function productVariantIdPayload() {
    return selectedVariantId ? Number(selectedVariantId) : undefined
  }

  function expirationLabel(minutes) {
    const value = Number(minutes) || 30
    return value >= 60 && value % 60 === 0 ? `${value / 60} heures` : `${value} minutes`
  }

  useEffect(() => {
    function handleTapResult(event) {
      setLoadingAction(null)
      if (event.detail?.success) {
        setTapToPay(null)
        setMessage(event.detail.orderId
          ? `Paiement Tap to Pay confirmé. Commande #${event.detail.orderId}.`
          : 'Paiement Tap to Pay confirmé.')
        setError(null)
        onSold()
      } else if (event.detail?.cancelled) {
        setTapToPay(null)
        setError(null)
      } else {
        setError(event.detail?.message || 'Paiement Tap to Pay échoué.')
      }
    }

    window.addEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
    return () => window.removeEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
  }, [onSold])

  async function handleMarketSale() {
    if (!window.confirm(`Marquer "${displayName(product)}" comme vendu au marché ?`)) return
    setLoadingAction('sale')
    setError(null)
    setMessage('')
    try {
      const order = await adminCreateMarketSale(product.id, {
        paymentMethod,
        productVariantId: productVariantIdPayload(),
        salePrice: salePricePayload(marketSalePrice),
        customerName: marketCustomerName.trim() || undefined,
        customerEmail: marketCustomerEmail.trim() || undefined,
      })
      await onSold?.({
        removeProductId: product.id,
        productVariantId: productVariantIdPayload(),
        order,
      })
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handlePaymentLink() {
    setLoadingAction('link')
    setError(null)
    setMessage('')
    setPaymentLink('')
    try {
      const result = await adminCreateProductPaymentLink(product.id, {
        shippingTotal: shippingTotal === '' ? 0 : Number(shippingTotal),
        productVariantId: productVariantIdPayload(),
        salePrice: salePricePayload(linkSalePrice),
        customerName: linkCustomerName.trim() || undefined,
        customerEmail: linkCustomerEmail.trim() || undefined,
      })
      setPaymentLink(result.checkoutUrl)
      setMessage(result.emailQueued
        ? `Lien généré instantanément. L'envoi du courriel est lancé en arrière-plan. Le produit restera disponible jusqu'au paiement confirmé. Expire dans ${expirationLabel(result.expiresInMinutes)}.`
        : `Lien généré instantanément. Copie-le pour l'envoyer au client. Le produit restera disponible jusqu'au paiement confirmé. Expire dans ${expirationLabel(result.expiresInMinutes)}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleTapToPayIntent() {
    setLoadingAction('tap')
    setError(null)
    setMessage('')
    setTapToPay(null)

    if (isNativeApp) {
      let token = getAdminAuthToken()
      if (!token) {
        try {
          const session = await adminCreateSessionToken()
          token = session.token
          setAdminAuthToken(token)
        } catch {
          setLoadingAction(null)
          setError('Reconnecte-toi à l’admin avant d’utiliser Tap to Pay.')
          return
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'START_TAP_TO_PAY',
        payload: {
          token,
          productId: product.id,
          productVariantId: productVariantIdPayload(),
          salePrice: salePricePayload(tapSalePrice),
          customerName: tapCustomerName.trim() || undefined,
          customerEmail: tapCustomerEmail.trim() || undefined,
        },
      }))
      setMessage('Tap to Pay lancé sur le téléphone. Présente la carte quand l’app le demande.')
      return
    }

    try {
      const result = await adminCreateTapToPayIntent(product.id, {
        productVariantId: productVariantIdPayload(),
        salePrice: salePricePayload(tapSalePrice),
        customerName: tapCustomerName.trim() || undefined,
        customerEmail: tapCustomerEmail.trim() || undefined,
      })
      setTapToPay(result)
      setMessage('Transaction Tap to Pay préparée. Ouvre l’app mobile POS pour collecter le paiement.')
      await onSold()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleTapToPaySync() {
    if (!tapToPay?.paymentIntentId) return
    setLoadingAction('sync')
    setError(null)
    try {
      const result = await adminSyncTapToPayPayment(tapToPay.paymentIntentId)
      if (result.status === 'succeeded') {
        setMessage('Paiement Tap to Pay confirmé. Le produit est vendu.')
        await onSold()
      } else {
        setMessage(`Paiement non finalisé: ${result.status}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleTapToPayCancel() {
    if (!tapToPay?.paymentIntentId) return
    setLoadingAction('cancelTap')
    setError(null)
    try {
      await adminCancelTapToPayPayment(tapToPay.paymentIntentId)
      setTapToPay(null)
      setMessage('Transaction Tap to Pay annulée. Le stock est libéré.')
      await onSold()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function copyLink() {
    if (!paymentLink) return
    try {
      await navigator.clipboard.writeText(paymentLink)
      setMessage('Lien copié.')
    } catch {
      setError('Impossible de copier automatiquement. Sélectionne le lien manuellement.')
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Mode marché</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            {marketImageUrl ? (
              <button
                type="button"
                onClick={() => {
                  if (suppressImageClickRef.current) return
                  setImagePreviewOpen(true)
                }}
                onTouchStart={handleMarketImageTouchStart}
                onTouchEnd={handleMarketImageTouchEnd}
                aria-label="Agrandir la photo"
                style={{
                  width: 64,
                  height: 64,
                  padding: 0,
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  background: 'transparent',
                  overflow: 'hidden',
                  cursor: 'zoom-in',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <img src={marketImageUrl} alt={displayName(product)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {marketImageLabel && (
                  <span style={{
                    position: 'absolute',
                    left: 4,
                    bottom: 4,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    background: 'rgba(196,96,122,0.92)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {marketImageLabel}
                  </span>
                )}
                {marketImages.length > 1 && (
                  <span style={{
                    position: 'absolute',
                    right: 4,
                    top: 4,
                    padding: '1px 5px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}>
                    {Math.min(marketPhotoIndex + 1, marketImages.length)}/{marketImages.length}
                  </span>
                )}
              </button>
            ) : null}
            <div>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>{displayName(product)}</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)' }}>{Number(product.price).toFixed(2)} $ · Stock {product.stockQuantity ?? product.stock ?? '—'}</p>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {hasMultipleMarketVariants && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Variation</label>
              <select className="form-input" value={selectedVariantId} onChange={(e) => handleVariantChange(e.target.value)}>
                {availableVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label || `Variation ${variant.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem', overflowX: 'auto' }}>
            <button type="button" style={tabStyle(activeMarketTab === 'sale')} onClick={() => setActiveMarketTab('sale')}>Vente</button>
            <button type="button" style={tabStyle(activeMarketTab === 'tap')} onClick={() => setActiveMarketTab('tap')}>Tap to Pay</button>
            <button type="button" style={tabStyle(activeMarketTab === 'link')} onClick={() => setActiveMarketTab('link')}>Lien</button>
          </div>

          {activeMarketTab === 'sale' && (
            <section style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Prix pour cette vente</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={marketSalePrice}
                  onChange={(e) => setMarketSalePrice(e.target.value)}
                  placeholder={product.price != null ? Number(product.price).toFixed(2) : '0.00'}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nom client (optionnel)</label>
                  <input className="form-input" value={marketCustomerName} onChange={(e) => setMarketCustomerName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Courriel client (optionnel)</label>
                  <input className="form-input" type="email" value={marketCustomerEmail} onChange={(e) => setMarketCustomerEmail(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Méthode</label>
                <select className="form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="E_TRANSFER">Virement Interac</option>
                  <option value="STRIPE_MANUAL">Stripe manuel</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <button className="btn btn-primary" type="button" onClick={handleMarketSale} disabled={!!loadingAction}>
                {loadingAction === 'sale' ? 'Enregistrement...' : 'Marquer vendu au marché'}
              </button>
            </section>
          )}

          {activeMarketTab === 'tap' && (
            <section style={{ display: 'grid', gap: '0.85rem' }}>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {isNativeApp
                  ? 'Encaisse directement sur ce téléphone avec Stripe Tap to Pay.'
                  : 'Prépare la transaction pour l’app mobile Stripe Terminal. Le paiement physique se fait dans l’app native, pas dans le navigateur.'}
              </p>
              <div className="form-group">
                <label className="form-label">Prix Tap to Pay</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tapSalePrice}
                  onChange={(e) => setTapSalePrice(e.target.value)}
                  placeholder={product.price != null ? Number(product.price).toFixed(2) : '0.00'}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nom client (optionnel)</label>
                  <input className="form-input" value={tapCustomerName} onChange={(e) => setTapCustomerName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Courriel client (optionnel)</label>
                  <input className="form-input" type="email" value={tapCustomerEmail} onChange={(e) => setTapCustomerEmail(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" type="button" onClick={handleTapToPayIntent} disabled={!!loadingAction}>
                {loadingAction === 'tap' ? (isNativeApp ? 'Paiement en cours...' : 'Préparation...') : (isNativeApp ? 'Encaisser Tap to Pay' : 'Préparer Tap to Pay')}
              </button>
              {!isNativeApp && tapToPay && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                  <input className="form-input" readOnly value={`PaymentIntent: ${tapToPay.paymentIntentId}`} onFocus={(e) => e.target.select()} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={handleTapToPaySync} disabled={!!loadingAction}>
                      {loadingAction === 'sync' ? 'Vérification...' : 'Vérifier paiement'}
                    </button>
                    <button className="btn btn-danger btn-sm" type="button" onClick={handleTapToPayCancel} disabled={!!loadingAction}>
                      {loadingAction === 'cancelTap' ? 'Annulation...' : 'Annuler Tap to Pay'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeMarketTab === 'link' && (
            <section style={{ display: 'grid', gap: '0.85rem' }}>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Le produit reste disponible tant que Stripe n’a pas confirmé le paiement.
              </p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prix du lien</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={linkSalePrice}
                    onChange={(e) => setLinkSalePrice(e.target.value)}
                    placeholder={product.price != null ? Number(product.price).toFixed(2) : '0.00'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom client (optionnel)</label>
                  <input className="form-input" value={linkCustomerName} onChange={(e) => setLinkCustomerName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Courriel client (optionnel)</label>
                  <input className="form-input" type="email" value={linkCustomerEmail} onChange={(e) => setLinkCustomerEmail(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Livraison fixe</label>
                <input className="form-input" type="number" min="0" step="0.01" value={shippingTotal} onChange={(e) => setShippingTotal(e.target.value)} placeholder="0.00" />
              </div>
              <button className="btn btn-primary" type="button" onClick={handlePaymentLink} disabled={!!loadingAction}>
                {loadingAction === 'link' ? 'Génération...' : (linkCustomerEmail.trim() ? 'Générer et envoyer le lien' : 'Générer le lien')}
              </button>
              {paymentLink && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                  <input className="form-input" readOnly value={paymentLink} onFocus={(e) => e.target.select()} />
                  <button className="btn btn-primary btn-sm" type="button" onClick={copyLink}>Copier le lien</button>
                </div>
              )}
            </section>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
      {imagePreviewOpen && marketImages.length > 0 && (
        <ImageLightbox
          images={marketImages}
          initialIndex={marketPhotoIndex}
          onIndexChange={showMarketPhoto}
          onClose={() => setImagePreviewOpen(false)}
        />
      )}
    </div>
  )
}

function normalizeMarketImage(image, variant = null) {
  const url = image?.imageUrl || image?.storagePathOrUrl || image?.url
  if (!url) return null
  return {
    storagePathOrUrl: url,
    variantId: image.variantId || variant?.id || null,
    variantLabel: image.variantLabel || variant?.label || null,
  }
}

function productMarketImages(product, variants) {
  const showVariantLabels = variants.length > 1
  const productImages = Array.isArray(product.images) ? product.images : []
  const variantImages = variants.flatMap((variant) => {
    const images = Array.isArray(variant.images) && variant.images.length
      ? variant.images
      : productImages.filter((image) => image.variantId && String(image.variantId) === String(variant.id))
    return images
      .map((image) => {
        const normalized = normalizeMarketImage(image, variant)
        return normalized ? { ...normalized, variantLabel: showVariantLabels ? normalized.variantLabel : null } : null
      })
      .filter(Boolean)
  })
  const generalImages = productImages
    .filter((image) => !image.variantId)
    .map((image) => normalizeMarketImage(image))
    .filter(Boolean)
  const fallback = product.mainImageUrl ? [{ storagePathOrUrl: product.mainImageUrl, variantId: null, variantLabel: null }] : []
  const seen = new Set()
  return [...variantImages, ...generalImages, ...fallback].filter((image) => {
    const key = image.storagePathOrUrl
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ProductMarketCard({
  product,
  getCategoryName,
  getProductImageUrl,
  onSelectProduct,
  bundleMode,
  selectedBundleKeys,
  onToggleBundleProduct,
}) {
  const productKey = product.id || product._id
  const availableVariants = Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant.status !== 'SOLD')
    : []
  const hasMultipleProductVariants = availableVariants.length > 1
  const firstVariant = availableVariants.length
    ? availableVariants.find((variant) => variant.status === 'AVAILABLE') || availableVariants[0]
    : null
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariant?.id ? String(firstVariant.id) : '')
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const selectedVariant = availableVariants.find((variant) => String(variant.id) === String(selectedVariantId)) || firstVariant
  const marketImages = productMarketImages(product, availableVariants)
  const selectedVariantImageIndex = selectedVariant?.id
    ? marketImages.findIndex((image) => image.variantId && String(image.variantId) === String(selectedVariant.id))
    : -1
  const displayImage = selectedVariantImageIndex >= 0
    ? marketImages[selectedVariantImageIndex]?.storagePathOrUrl
    : marketImages[photoIndex]?.storagePathOrUrl || getProductImageUrl(product)
  const bundleKey = `product:${productKey}:${selectedVariant?.id || ''}`
  const isBundleSelected = selectedBundleKeys.has(bundleKey)

  function handleVariantChange(variantId) {
    setSelectedVariantId(variantId)
    const nextPhotoIndex = marketImages.findIndex((image) => image.variantId && String(image.variantId) === String(variantId))
    if (nextPhotoIndex >= 0) setPhotoIndex(nextPhotoIndex)
  }

  function handlePhotoIndex(index) {
    setPhotoIndex(index)
    const nextImage = marketImages[index]
    if (nextImage?.variantId) {
      setSelectedVariantId(String(nextImage.variantId))
    }
  }

  function openImagePreview() {
    if (!marketImages.length) return
    const initialIndex = selectedVariantImageIndex >= 0 ? selectedVariantImageIndex : photoIndex
    setPhotoIndex(initialIndex)
    setImagePreviewOpen(true)
  }

  return (
    <article
      className="card market-card"
      style={isBundleSelected ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px rgba(221,122,143,0.18)' } : undefined}
    >
      <button
        type="button"
        onClick={openImagePreview}
        style={{ aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', padding: 0, cursor: marketImages.length ? 'zoom-in' : 'default' }}
        aria-label={`Voir les photos de ${displayName(product)}`}
      >
        {displayImage ? (
          <img src={displayImage} alt={displayName(product)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🧶</div>
        )}
      </button>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{displayName(product)}</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{getCategoryName(product.category)}</p>
        {product.isDraft && (
          <span className="badge badge-gray" style={{ marginTop: '0.45rem' }}>Brouillon</span>
        )}
        {bundleMode && hasMultipleProductVariants && (
          <select
            className="form-input"
            value={selectedVariant?.id || ''}
            onChange={(e) => handleVariantChange(e.target.value)}
            style={{ marginTop: '0.5rem', minHeight: 38, fontSize: '0.9rem' }}
          >
            {availableVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label || `Variation ${variant.id}`}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <strong>{product.price != null ? `${Number(product.price).toFixed(2)} $` : '—'}</strong>
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Stock {product.stockQuantity ?? product.stock ?? '—'}</span>
      </div>
      <button
        className={bundleMode ? (isBundleSelected ? 'btn btn-primary' : 'btn btn-secondary') : 'btn btn-primary'}
        type="button"
        onClick={() => bundleMode
          ? onToggleBundleProduct?.(product, selectedVariant)
          : onSelectProduct(product)}
      >
        {bundleMode ? (isBundleSelected ? 'Sélectionné' : 'Ajouter') : 'Sélectionner'}
      </button>

      {imagePreviewOpen && marketImages.length > 0 && (
        <ImageLightbox
          images={marketImages}
          initialIndex={photoIndex}
          onIndexChange={handlePhotoIndex}
          onClose={() => setImagePreviewOpen(false)}
        />
      )}
    </article>
  )
}

export function ProductMarketGrid({
  products,
  getCategoryName,
  getProductImageUrl,
  onSelectProduct,
  bundleMode = false,
  selectedBundleKeys = new Set(),
  onToggleBundleProduct,
}) {
  const availableProducts = products.filter((product) => !isSoldOutFromStock(product))

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        alignItems: 'flex-start',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Produits disponibles</h2>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)' }}>
            Ajoute les produits à la caisse, puis encaisse depuis le panneau du haut.
          </p>
        </div>
        <span className="badge badge-green">{availableProducts.length} disponibles</span>
      </div>

      {availableProducts.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Aucun produit disponible.
        </div>
      ) : (
        <div className="market-grid">
          {availableProducts.map((product) => (
            <ProductMarketCard
              key={product.id || product._id}
              product={product}
              getCategoryName={getCategoryName}
              getProductImageUrl={getProductImageUrl}
              onSelectProduct={onSelectProduct}
              bundleMode={bundleMode}
              selectedBundleKeys={selectedBundleKeys}
              onToggleBundleProduct={onToggleBundleProduct}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminProducts() {
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')
  const [productStatusFilter, setProductStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState({ inStock: true, sold: true })
  const [productVariantsFilter, setProductVariantsFilter] = useState('all')
  const [priceSort, setPriceSort] = useState('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalProduct, setModalProduct] = useState(undefined)
  const [modalCat, setModalCat] = useState(undefined)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [pData, cData] = await Promise.all([
        adminGetProducts(),
        adminGetCategories(),
      ])
      setProducts(Array.isArray(pData) ? pData : [])
      setCategories(Array.isArray(cData) ? cData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Product handlers ──

  async function handleSave(payload, pendingFiles, productId) {
    let savedProduct
    if (productId) {
      savedProduct = await adminUpdateProduct(productId, payload)
    } else {
      savedProduct = await adminCreateProduct(payload)
    }
    if (pendingFiles?.length && savedProduct?.id) {
      for (const file of pendingFiles) {
        const fd = new FormData()
        if (file.__cloudinaryUrl) {
          fd.append('existingImageUrl', file.__cloudinaryUrl)
        } else {
          fd.append('image', file)
        }
        const variantId = file.__variantId || savedProduct.variants?.[file.__variantIndex]?.id
        if (variantId) fd.append('variantId', String(variantId))
        await adminUploadImage(savedProduct.id, fd)
      }
    }
    await load()
    return savedProduct
  }

  async function handleAutoSave(productId, patch) {
    const updated = await adminPatchProduct(productId, patch)
    setProducts(current => current.map(item => item.id === productId ? updated : item))
    return updated
  }

  async function handleImageUpload(productId, formData) {
    const result = await adminUploadImage(productId, formData)
    await load()
    return result.data || result
  }

  async function handleStockChange(productId, stock) {
    const result = await adminUpdateStock(productId, stock)
    await load()
    return result.data || result
  }

  async function handleImageDelete(productId, imageId) {
    const result = await adminDeleteImage(productId, imageId)
    await load()
    return result
  }

  async function handleImagesReorder(productId, imageIds) {
    const updated = await adminReorderImages(productId, imageIds)
    await load()
    return updated
  }

  async function handleDeleteProduct(id) {
    try {
      await adminDeleteProduct(id)
      setConfirmDelete(null)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  // ── Category handlers ──

  async function handleCatSave(payload, catId) {
    if (catId) {
      await adminUpdateCategory(catId, payload)
    } else {
      await adminCreateCategory(payload)
    }
    await load()
  }

  async function handleDeleteCategory(id) {
    try {
      await adminDeleteCategory(id)
      setConfirmDelete(null)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const getCategoryName = (cat) => {
    if (!cat) return '—'
    if (typeof cat === 'object') return displayName(cat)
    const found = categories.find((c) => (c._id || c.id) === cat)
    return found ? displayName(found) : cat
  }

  const getCategoryId = (cat) => {
    if (!cat) return ''
    if (typeof cat === 'object') return String(cat.id || cat._id || '')
    return String(cat)
  }

  const getProductCategoryId = (product) => (
    String(product?.categoryId || getCategoryId(product?.category) || '')
  )

  function getProductImageUrl(product) {
    const firstVariantImage = product.variants?.[0]?.images?.[0]?.imageUrl
    return product.mainImageUrl || firstVariantImage || product.images?.[0]?.imageUrl || ''
  }

  function getProductPreviewImages(product) {
    return [
      ...(product.images || []),
      ...(product.variants || []).flatMap((variant) => variant.images || []),
      { imageUrl: product.mainImageUrl },
    ]
  }

  function renderProductBadges(product) {
    const soldOut = isSoldOutFromStock(product)
    return (
      <>
        {soldOut
          ? <span className="badge badge-red">Vendu</span>
          : <span className="badge badge-green">En stock</span>
        }
        {product.isDraft && <span className="badge badge-gray">Brouillon</span>}
        {product.isFeatured && <span className="badge badge-yellow">Vedette</span>}
      </>
    )
  }

  const filteredProducts = products.filter((product) => {
    const hasVariations = (product.variants?.length || 0) > 1
    if (productVariantsFilter === 'with' && !hasVariations) return false
    if (productVariantsFilter === 'without' && hasVariations) return false
    if (productCategoryFilter !== 'all' && getProductCategoryId(product) !== productCategoryFilter) return false
    if (productStatusFilter === 'published' && product.isDraft) return false
    if (productStatusFilter === 'draft' && !product.isDraft) return false
    if (!stockFilter[isSoldOutFromStock(product) ? 'sold' : 'inStock']) return false
    if (productStatusFilter === 'featured' && !product.isFeatured) return false
    return true
  })
  if (priceSort !== 'default') {
    filteredProducts.sort((a, b) => priceSort === 'asc'
      ? Number(a.price) - Number(b.price)
      : Number(b.price) - Number(a.price))
  }
  const hasFilters = productCategoryFilter !== 'all' || productStatusFilter !== 'all'
    || !stockFilter.inStock || !stockFilter.sold || productVariantsFilter !== 'all' || priceSort !== 'default'

  function resetFilters() {
    setProductCategoryFilter('all')
    setProductStatusFilter('all')
    setStockFilter({ inStock: true, sold: true })
    setProductVariantsFilter('all')
    setPriceSort('default')
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Produits</h1>
          {tab === 'products' ? (
            <button className="btn btn-primary" onClick={() => setModalProduct(null)}>+ Nouveau produit</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setModalCat({})}>+ Nouvelle catégorie</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
          <button style={tabStyle(tab === 'products')} onClick={() => setTab('products')}>Produits</button>
          <button style={tabStyle(tab === 'categories')} onClick={() => setTab('categories')}>Catégories</button>
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {/* ── Products tab ── */}
        {!loading && !error && tab === 'products' && (
          <>
            <details className="card admin-product-filters">
              <summary className="admin-product-filter-toggle">
                <span>Filtres{hasFilters ? ' · actifs' : ''}</span>
                <span role="status">{filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}</span>
              </summary>
              <div className="admin-product-filter-grid">
                <div>
                  <label className="form-label" htmlFor="admin-product-category-filter">Catégorie</label>
                  <select id="admin-product-category-filter" className="form-input"
                    value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}>
                    <option value="all">Toutes les catégories</option>
                    {categories.map((category) => {
                      const id = getCategoryId(category)
                      return id ? <option key={id} value={id}>{displayName(category)}</option> : null
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-product-status-filter">Statut</label>
                  <select id="admin-product-status-filter" className="form-input"
                    value={productStatusFilter} onChange={(e) => setProductStatusFilter(e.target.value)}>
                    <option value="all">Tous les statuts</option>
                    <option value="published">Publié</option>
                    <option value="draft">Brouillon</option>
                    <option value="featured">Vedette</option>
                  </select>
                </div>
                <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="form-label">Disponibilité</legend>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', minHeight: 44, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={stockFilter.inStock} onChange={e => setStockFilter(current => ({ ...current, inStock: e.target.checked }))} />
                      En stock
                    </label>
                    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={stockFilter.sold} onChange={e => setStockFilter(current => ({ ...current, sold: e.target.checked }))} />
                      Vendu
                    </label>
                  </div>
                </fieldset>
                <div>
                  <label className="form-label" htmlFor="admin-product-variants-filter">Variations</label>
                  <select id="admin-product-variants-filter" className="form-input"
                    value={productVariantsFilter} onChange={(e) => setProductVariantsFilter(e.target.value)}>
                    <option value="all">Tous les produits</option>
                    <option value="with">Avec variations</option>
                    <option value="without">Sans variations</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="admin-product-price-sort">Trier par prix</label>
                  <select id="admin-product-price-sort" className="form-input"
                    value={priceSort} onChange={(e) => setPriceSort(e.target.value)}>
                    <option value="default">Ordre habituel</option>
                    <option value="asc">Prix croissant</option>
                    <option value="desc">Prix décroissant</option>
                  </select>
                </div>
              </div>
              {hasFilters && <div className="admin-product-filter-summary">
                <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Réinitialiser</button>
              </div>}
            </details>

            <div className="table-container responsive-table-container admin-products-table">
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
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucun produit</td></tr>
                  ) : filteredProducts.map((p) => (
                    <tr key={p._id || p.id}>
                      <td data-label="Image">
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {getProductImageUrl(p) ? (
                            <>
                              <ImagePreviewButton
                                src={getProductImageUrl(p)}
                                images={getProductPreviewImages(p)}
                                alt={displayName(p)}
                                imageStyle={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                              />
                              {p.images?.length > 1 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', alignSelf: 'flex-end' }}>+{p.images.length - 1}</span>
                              )}
                            </>
                          ) : (
                            <div style={{ width: 48, height: 48, background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🧶</div>
                          )}
                        </div>
                      </td>
                      <td data-label="Nom" style={{ fontWeight: 600 }}>{displayName(p)}</td>
                      <td data-label="Catégorie">{getCategoryName(p.category)}</td>
                      <td data-label="Prix">{p.price != null ? `${Number(p.price).toFixed(2)} $` : '—'}</td>
                      <td data-label="Stock">{p.stockQuantity ?? p.stock ?? '—'}</td>
                      <td data-label="Statut">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {renderProductBadges(p)}
                        </div>
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModalProduct(p)}>Modifier</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...p, _type: 'product' })}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-products-mobile-list">
              {filteredProducts.length === 0 ? (
                <div className="admin-product-mobile-empty">Aucun produit</div>
              ) : filteredProducts.map((p) => {
                const imageUrl = getProductImageUrl(p)
                return (
                  <article className="admin-product-mobile-card" key={p._id || p.id}>
                    <div className="admin-product-mobile-image">
                      {imageUrl ? (
                        <ImagePreviewButton src={imageUrl} images={getProductPreviewImages(p)} alt={displayName(p)} />
                      ) : (
                        <span>🧶</span>
                      )}
                    </div>
                    <div className="admin-product-mobile-content">
                      <div className="admin-product-mobile-header">
                        <div>
                          <h2>{displayName(p)}</h2>
                          <p>{getCategoryName(p.category)}</p>
                        </div>
                        <strong>{p.price != null ? `${Number(p.price).toFixed(2)} $` : '—'}</strong>
                      </div>
                      <div className="admin-product-mobile-meta">
                        <span>Stock {p.stockQuantity ?? p.stock ?? '—'}</span>
                        <div>{renderProductBadges(p)}</div>
                      </div>
                      <div className="admin-product-mobile-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setModalProduct(p)}>Modifier</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...p, _type: 'product' })}>Supprimer</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* ── Categories tab ── */}
        {!loading && !error && tab === 'categories' && (
          <>
            <div className="table-container responsive-table-container admin-mobile-replaced-table">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Description</th>
                    <th>Produits</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune catégorie</td></tr>
                  ) : categories.map((c) => (
                    <tr key={c._id || c.id}>
                      <td data-label="Nom" style={{ fontWeight: 600 }}>{displayName(c)}</td>
                      <td data-label="Description" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{displayDescription(c)}</td>
                      <td data-label="Produits" style={{ fontSize: '0.875rem' }}>{products.filter((p) => {
                        const catId = typeof p.category === 'object' ? p.category?.id : p.categoryId
                        return catId === (c._id || c.id)
                      }).length}</td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(c)}>Modifier</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...c, _type: 'category' })}>Supprimer</button>
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
              ) : categories.map((c) => {
                const count = products.filter((p) => {
                  const catId = typeof p.category === 'object' ? p.category?.id : p.categoryId
                  return catId === (c._id || c.id)
                }).length
                return (
                  <article className="admin-compact-mobile-card" key={c._id || c.id}>
                    <div className="admin-compact-mobile-top">
                      <div className="admin-compact-mobile-title">
                        <h2>{displayName(c)}</h2>
                        <p>{displayDescription(c, 'Aucune description')}</p>
                      </div>
                      <div className="admin-compact-mobile-value">{count}</div>
                    </div>
                    <div className="admin-compact-mobile-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(c)}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ ...c, _type: 'category' })}>Supprimer</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* Product modal */}
        {modalProduct !== undefined && (
          <ProductModal
            product={modalProduct}
            categories={categories}
            onClose={() => setModalProduct(undefined)}
            onSave={(payload, pendingFiles) => handleSave(payload, pendingFiles, modalProduct?._id || modalProduct?.id)}
            onAutoSave={handleAutoSave}
            onStockChange={handleStockChange}
            onImageUpload={handleImageUpload}
            onImageDelete={handleImageDelete}
            onImagesReorder={handleImagesReorder}
          />
        )}

        {/* Category modal */}
        {modalCat !== undefined && (
          <CategoryModal
            category={modalCat}
            onClose={() => setModalCat(undefined)}
            onSave={(payload) => handleCatSave(payload, modalCat?._id || modalCat?.id)}
          />
        )}

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <span className="modal-title">Confirmer la suppression</span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
              </div>
              <div className="modal-body">
                <p>
                  {confirmDelete._type === 'category'
                    ? <>Supprimer la catégorie <strong>{displayName(confirmDelete)}</strong> ? Les produits associés ne seront pas supprimés.</>
                    : <>Voulez-vous vraiment supprimer <strong>{displayName(confirmDelete)}</strong> ? Cette action est irréversible.</>
                  }
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={() => {
                  if (confirmDelete._type === 'category') {
                    handleDeleteCategory(confirmDelete._id || confirmDelete.id)
                  } else {
                    handleDeleteProduct(confirmDelete._id || confirmDelete.id)
                  }
                }}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
