import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import {
  adminCancelTapToPayPayment,
  adminCreateMarketBundleSale,
  adminCreateMarketCartPaymentLink,
  adminCreateMarketCartPaymentQr,
  adminCreateMarketCartTapToPayIntent,
  adminCreateSessionToken,
  adminGetProducts,
  adminGetYarnProducts,
  adminSyncTapToPayPayment,
  getCategories,
  getAdminAuthToken,
  adminGetYarnCategories,
  setAdminAuthToken,
} from '../../services/api.js'
import {
  isSoldOutFromStock,
  ProductMarketGrid,
} from './Products.jsx'
import ImageLightbox from '../../components/ImageLightbox.jsx'
import { displayName } from '../../components/BilingualTextFields.jsx'
import CustomMarketPanel from './CustomMarketPanel.jsx'

const tabStyle = (active) => ({
  padding: '0.5rem 0.35rem',
  minWidth: 0,
  fontSize: '0.84rem',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  cursor: 'pointer',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
})

function getProductImageUrl(product) {
  const firstVariantImage = product.variants?.[0]?.images?.[0]?.imageUrl
  return firstVariantImage || product.mainImageUrl || product.images?.[0]?.imageUrl || ''
}

function categoryName(categories, item) {
  const category = item?.category
  if (!category) return '—'
  if (typeof category === 'object') return category.name || '—'
  const found = categories.find((c) => (c._id || c.id) === category || c.id === item.categoryId)
  return found?.name || category
}

function categoryId(category) {
  if (!category) return ''
  if (typeof category === 'object') return String(category.id || category._id || '')
  return String(category)
}

function itemCategoryId(item) {
  return String(item?.categoryId || categoryId(item?.category) || '')
}

function itemImages(item) {
  const images = Array.isArray(item?.images) ? item.images : []
  const seen = new Set()
  const normalized = images
    .map((image) => ({
      storagePathOrUrl: image.imageUrl || image.storagePathOrUrl || image.url,
      variantId: image.variantId || null,
      variantLabel: image.variantLabel || null,
    }))
    .filter((image) => image.storagePathOrUrl)
    .filter((image) => {
      if (seen.has(image.storagePathOrUrl)) return false
      seen.add(image.storagePathOrUrl)
      return true
    })

  if (!seen.has(item?.mainImageUrl) && item?.mainImageUrl) {
    normalized.push({ storagePathOrUrl: item.mainImageUrl, variantId: null, variantLabel: null })
  }

  return normalized
}

function YarnMarketCard({ yarn, categories, bundleMode, isBundleSelected, onToggleBundleYarn, onSelectYarn }) {
  const images = itemImages(yarn)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const imageUrl = images[photoIndex]?.storagePathOrUrl || getProductImageUrl(yarn)

  function handlePhotoIndex(index) {
    setPhotoIndex(index)
  }

  return (
    <article
      className="card market-card"
      style={isBundleSelected ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px rgba(221,122,143,0.18)' } : undefined}
    >
      <button
        type="button"
        onClick={() => images.length > 0 && setImagePreviewOpen(true)}
        style={{ aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', padding: 0, cursor: images.length ? 'zoom-in' : 'default' }}
        aria-label={`Voir les photos de ${yarn.name}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={yarn.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🧶</div>
        )}
      </button>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{yarn.name}</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          {categoryName(categories, yarn)}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <strong>{yarn.price != null ? `${Number(yarn.price).toFixed(2)} $` : '—'}</strong>
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Stock {yarn.stockQuantity ?? '—'}</span>
      </div>
      <button
        className={bundleMode ? (isBundleSelected ? 'btn btn-primary' : 'btn btn-secondary') : 'btn btn-primary'}
        type="button"
        onClick={() => bundleMode ? onToggleBundleYarn?.(yarn) : onSelectYarn(yarn)}
      >
        {bundleMode ? (isBundleSelected ? 'Sélectionnée' : 'Ajouter') : 'Sélectionner'}
      </button>

      {imagePreviewOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          initialIndex={photoIndex}
          onIndexChange={handlePhotoIndex}
          onClose={() => setImagePreviewOpen(false)}
        />
      )}
    </article>
  )
}

function YarnMarketGrid({
  yarnProducts,
  categories,
  onSelectYarn,
  bundleMode = false,
  selectedBundleKeys = new Set(),
  onToggleBundleYarn,
}) {
  const available = yarnProducts.filter((yarn) => !isSoldOutFromStock(yarn))

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
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Laines disponibles</h2>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)' }}>
            Ajoute les laines à la caisse, puis encaisse depuis le panneau du haut.
          </p>
        </div>
        <span className="badge badge-green">{available.length} disponibles</span>
      </div>

      {available.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Aucune laine disponible.
        </div>
      ) : (
        <div className="market-grid">
          {available.map((yarn) => {
            const bundleKey = `yarn:${yarn.id}`
            const isBundleSelected = selectedBundleKeys.has(bundleKey)
            return (
              <YarnMarketCard
                key={yarn.id}
                yarn={yarn}
                categories={categories}
                bundleMode={bundleMode}
                isBundleSelected={isBundleSelected}
                onToggleBundleYarn={onToggleBundleYarn}
                onSelectYarn={onSelectYarn}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AdminMarketMode() {
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [productCategories, setProductCategories] = useState([])
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')
  const [yarnProducts, setYarnProducts] = useState([])
  const [yarnCategories, setYarnCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bundleMode] = useState(true)
  const [checkoutTab, setCheckoutTab] = useState('sale')
  const [bundleItems, setBundleItems] = useState([])
  const [bundlePaymentMethod, setBundlePaymentMethod] = useState('CASH')
  const [bundleCustomerName, setBundleCustomerName] = useState('')
  const [bundleCustomerEmail, setBundleCustomerEmail] = useState('')
  const [bundleShippingTotal, setBundleShippingTotal] = useState('')
  const [bundlePaymentLink, setBundlePaymentLink] = useState('')
  const [bundleQrPayment, setBundleQrPayment] = useState(null)
  const [bundleTapToPay, setBundleTapToPay] = useState(null)
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleError, setBundleError] = useState(null)
  const [bundleMessage, setBundleMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const pullStartY = useRef(null)
  const isNativeApp = typeof window !== 'undefined' && !!window.ReactNativeWebView

  async function load({ showLoader = true } = {}) {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const [productData, productCategoryData, yarnData, yarnCategoryData] = await Promise.all([
        adminGetProducts(),
        getCategories(),
        adminGetYarnProducts(),
        adminGetYarnCategories(),
      ])
      setProducts(Array.isArray(productData) ? productData : [])
      setProductCategories(Array.isArray(productCategoryData) ? productCategoryData : [])
      setYarnProducts(Array.isArray(yarnData) ? yarnData : [])
      setYarnCategories(Array.isArray(yarnCategoryData) ? yarnCategoryData : [])
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    function handleTapStarted(event) {
      if (event.detail?.itemType === 'custom') return
      const paymentIntentId = event.detail?.paymentIntentId
      if (!paymentIntentId) return
      setBundleTapToPay({
        paymentIntentId,
        orderId: event.detail?.orderId,
      })
    }

    function handleTapResult(event) {
      if (event.detail?.itemType === 'custom') return
      setBundleLoading(false)
      if (event.detail?.success) {
        setBundleMessage('Paiement Tap to Pay confirmé. La caisse est encaissée.')
        setBundleItems([])
        setBundleTapToPay(null)
        load()
      } else if (event.detail?.cancelled) {
        setBundleTapToPay(null)
      } else {
        setBundleError(event.detail?.message || 'Paiement Tap to Pay échoué.')
      }
    }

    window.addEventListener('itsgenygarts:tap-to-pay-started', handleTapStarted)
    window.addEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
    return () => {
      window.removeEventListener('itsgenygarts:tap-to-pay-started', handleTapStarted)
      window.removeEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
    }
  }, [])

  function toggleBundleProduct(product, variant) {
    const productId = product.id || product._id
    const key = `product:${productId}:${variant?.id || ''}`
    const showVariantLabel = Array.isArray(product.variants) && product.variants.filter((item) => item.status !== 'SOLD').length > 1
    setBundleItems((current) => {
      if (current.some((item) => item.key === key)) {
        return current.filter((item) => item.key !== key)
      }
      const label = showVariantLabel && variant?.label ? `${product.name} (${variant.label})` : product.name
      const price = product.price != null ? Number(product.price) : 0
      return [
        ...current,
        {
          key,
          type: 'product',
          productId: Number(productId),
          productVariantId: variant?.id || null,
          name: label,
          imageUrl: variant?.images?.[0]?.imageUrl || getProductImageUrl(product),
          originalPrice: price,
          salePrice: price.toFixed(2),
        },
      ]
    })
  }

  function toggleBundleYarn(yarn) {
    const key = `yarn:${yarn.id}`
    setBundleItems((current) => {
      if (current.some((item) => item.key === key)) {
        return current.filter((item) => item.key !== key)
      }
      const price = yarn.price != null ? Number(yarn.price) : 0
      return [
        ...current,
        {
          key,
          type: 'yarn',
          yarnProductId: Number(yarn.id),
          name: `Laine - ${yarn.name}`,
          imageUrl: getProductImageUrl(yarn),
          originalPrice: price,
          salePrice: price.toFixed(2),
        },
      ]
    })
  }

  function updateBundleItemPrice(key, value) {
    setBundleItems((current) => current.map((item) => (
      item.key === key ? { ...item, salePrice: value } : item
    )))
  }

  function removeBundleItem(key) {
    setBundleItems((current) => current.filter((item) => item.key !== key))
  }

  function validateBundleItems() {
    setBundleError(null)
    setBundleMessage('')
    if (bundleItems.length < 1) {
      setBundleError('Ajoute au moins un article dans la caisse.')
      return false
    }
    const invalid = bundleItems.find((item) => {
      const amount = Number(item.salePrice)
      return item.salePrice === '' || !Number.isFinite(amount) || amount < 0
    })
    if (invalid) {
      setBundleError(`Prix invalide pour ${invalid.name}.`)
      return
    }
    return true
  }

  function bundleItemsPayload() {
    return bundleItems.map((item) => ({
      type: item.type,
      productId: item.productId,
      productVariantId: item.productVariantId,
      yarnProductId: item.yarnProductId,
      salePrice: Number(item.salePrice || 0),
    }))
  }

  async function handleBundleSale() {
    if (!validateBundleItems()) return

    const total = bundleItems.reduce((sum, item) => sum + Number(item.salePrice || 0), 0)
    if (!window.confirm(`Encaisser cette caisse de ${total.toFixed(2)} $ ?`)) return

    setBundleLoading(true)
    setBundleError(null)
    try {
      await adminCreateMarketBundleSale({
        paymentMethod: bundlePaymentMethod,
        customerName: bundleCustomerName.trim() || undefined,
        customerEmail: bundleCustomerEmail.trim() || undefined,
        items: bundleItemsPayload(),
      })
      setBundleItems([])
      setBundleCustomerName('')
      setBundleCustomerEmail('')
      setBundleMessage('Vente encaissée.')
      await load()
    } catch (err) {
      setBundleError(err.message)
    } finally {
      setBundleLoading(false)
    }
  }

  async function handleBundlePaymentLink() {
    if (!validateBundleItems()) return
    setBundleLoading(true)
    setBundleError(null)
    setBundleMessage('')
    setBundlePaymentLink('')
    setBundleQrPayment(null)
    try {
      const result = await adminCreateMarketCartPaymentLink({
        shippingTotal: bundleShippingTotal === '' ? 0 : Number(bundleShippingTotal),
        customerName: bundleCustomerName.trim() || undefined,
        customerEmail: bundleCustomerEmail.trim() || undefined,
        items: bundleItemsPayload(),
      })
      setBundlePaymentLink(result.checkoutUrl)
      setBundleMessage(result.emailQueued
        ? 'Lien généré et envoyé au client. La caisse reste disponible jusqu’au paiement confirmé.'
        : 'Lien généré. Copie-le pour l’envoyer au client. La caisse reste disponible jusqu’au paiement confirmé.')
    } catch (err) {
      setBundleError(err.message)
    } finally {
      setBundleLoading(false)
    }
  }

  async function handleBundlePaymentQr() {
    if (!validateBundleItems()) return
    setBundleLoading(true)
    setBundleError(null)
    setBundleMessage('')
    setBundlePaymentLink('')
    setBundleQrPayment(null)
    try {
      const result = await adminCreateMarketCartPaymentQr({
        customerName: bundleCustomerName.trim() || undefined,
        customerEmail: bundleCustomerEmail.trim() || undefined,
        items: bundleItemsPayload(),
      })
      const qrDataUrl = await QRCode.toDataURL(result.checkoutUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#241C1B',
          light: '#FFFFFF',
        },
      })
      setBundleQrPayment({ ...result, qrDataUrl })
      setBundleMessage(result.emailQueued
        ? 'QR Stripe généré et lien envoyé au client. La caisse reste disponible jusqu’au paiement confirmé.'
        : 'QR Stripe généré. La caisse reste disponible jusqu’au paiement confirmé.')
    } catch (err) {
      setBundleError(err.message)
    } finally {
      setBundleLoading(false)
    }
  }

  async function handleBundleTapToPayIntent() {
    if (!validateBundleItems()) return
    setBundleLoading(true)
    setBundleError(null)
    setBundleMessage('')
    setBundleTapToPay(null)
    setBundleQrPayment(null)

    if (isNativeApp) {
      let token = getAdminAuthToken()
      if (!token) {
        try {
          const session = await adminCreateSessionToken()
          token = session.token
          setAdminAuthToken(token)
        } catch {
          setBundleLoading(false)
          setBundleError('Reconnecte-toi à l’admin avant d’utiliser Tap to Pay.')
          return
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'START_TAP_TO_PAY',
        payload: {
          itemType: 'cart',
          token,
          items: bundleItemsPayload(),
          customerName: bundleCustomerName.trim() || undefined,
          customerEmail: bundleCustomerEmail.trim() || undefined,
        },
      }))
      setBundleMessage('Tap to Pay lancé sur le téléphone. Présente la carte quand l’app le demande.')
      return
    }

    try {
      const result = await adminCreateMarketCartTapToPayIntent({
        customerName: bundleCustomerName.trim() || undefined,
        customerEmail: bundleCustomerEmail.trim() || undefined,
        items: bundleItemsPayload(),
      })
      setBundleTapToPay(result)
      setBundleMessage('Transaction Tap to Pay préparée. Ouvre l’app mobile POS pour collecter le paiement.')
    } catch (err) {
      setBundleError(err.message)
    } finally {
      setBundleLoading(false)
    }
  }

  async function handleBundleTapToPaySync() {
    if (!bundleTapToPay?.paymentIntentId) return
    setBundleLoading(true)
    setBundleError(null)
    try {
      const result = await adminSyncTapToPayPayment(bundleTapToPay.paymentIntentId)
      if (result.status === 'succeeded') {
        setBundleMessage('Paiement Tap to Pay confirmé. La caisse est encaissée.')
        setBundleItems([])
        setBundleTapToPay(null)
        await load()
      } else {
        setBundleMessage(`Paiement non finalisé: ${result.status}`)
      }
    } catch (err) {
      setBundleError(err.message)
    } finally {
      setBundleLoading(false)
    }
  }

  function requestNativeTapToPayCancel(paymentIntentId) {
    if (!isNativeApp) return
    const token = getAdminAuthToken()
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'CANCEL_TAP_TO_PAY',
      payload: {
        itemType: 'cart',
        paymentIntentId: paymentIntentId || undefined,
        token: token || undefined,
      },
    }))
  }

  async function cancelPendingTapToPay({ showMessage = true } = {}) {
    const paymentIntentId = bundleTapToPay?.paymentIntentId
    requestNativeTapToPayCancel(paymentIntentId)
    setBundleLoading(true)
    setBundleError(null)

    try {
      if (paymentIntentId) {
        await adminCancelTapToPayPayment(paymentIntentId)
      }
      setBundleTapToPay(null)
      if (showMessage && !isNativeApp) {
        setBundleMessage(paymentIntentId ? 'Transaction Tap to Pay annulée.' : 'Tap to Pay réinitialisé.')
      }
      return true
    } catch (err) {
      if (showMessage) setBundleError(err.message)
      return false
    } finally {
      setBundleLoading(false)
    }
  }

  async function handleBundleTapToPayCancel() {
    const cancelled = await cancelPendingTapToPay()
    if (cancelled) await load()
  }

  function copyBundleLink() {
    if (!bundlePaymentLink) return
    navigator.clipboard?.writeText(bundlePaymentLink)
      .then(() => setBundleMessage('Lien copié.'))
      .catch(() => setBundleError('Impossible de copier automatiquement. Sélectionne le lien manuellement.'))
  }

  const getProductCategoryName = (cat) => {
    if (!cat) return '—'
    if (typeof cat === 'object') return cat.name || '—'
    const found = productCategories.find((c) => (c._id || c.id) === cat)
    return found?.name || cat
  }

  const selectedBundleKeys = new Set(bundleItems.map((item) => item.key))
  const bundleTotal = bundleItems.reduce((sum, item) => sum + (Number(item.salePrice) || 0), 0)
  const filteredProducts = productCategoryFilter === 'all'
    ? products
    : products.filter((product) => itemCategoryId(product) === productCategoryFilter)

  function handlePullStart(event) {
    if (window.scrollY > 2) return
    if (event.target?.closest?.('input, textarea, select, button')) return
    const touch = event.touches?.[0]
    pullStartY.current = touch?.clientY ?? null
  }

  function handlePullMove(event) {
    if (pullStartY.current === null || window.scrollY > 2) return
    const touch = event.touches?.[0]
    if (!touch) return
    const distance = Math.max(0, touch.clientY - pullStartY.current)
    setPullDistance(Math.min(96, Math.round(distance * 0.45)))
  }

  async function handlePullEnd() {
    const shouldRefresh = pullDistance >= 64 && !refreshing
    pullStartY.current = null
    setPullDistance(0)
    if (!shouldRefresh) return
    setRefreshing(true)
    try {
      const hadTapToPayState = checkoutTab === 'tap' && (bundleLoading || !!bundleTapToPay)
      if (hadTapToPayState) {
        await cancelPendingTapToPay({ showMessage: false })
      }
      await load({ showLoader: false })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main
        className="admin-main"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        {(pullDistance > 0 || refreshing) && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            transform: `translateY(${Math.min(pullDistance, 54)}px)`,
            transition: pullDistance ? 'none' : 'transform 0.18s ease',
            margin: '-0.5rem auto 0.75rem',
            width: 'fit-content',
            padding: '0.35rem 0.75rem',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.94)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 22px rgba(44,32,24,0.08)',
            color: 'var(--color-text-muted)',
            fontSize: '0.82rem',
          }}>
            {refreshing ? 'Actualisation...' : pullDistance >= 64 ? 'Relâche pour actualiser' : 'Tire pour actualiser'}
          </div>
        )}
        <div className="admin-header">
          <h1>Mode marché</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
          <button style={tabStyle(tab === 'products')} onClick={() => setTab('products')}>Produits</button>
          <button style={tabStyle(tab === 'yarn')} onClick={() => setTab('yarn')}>Laines</button>
          <button style={tabStyle(tab === 'custom')} onClick={() => setTab('custom')}>Customs</button>
        </div>

        {tab !== 'custom' && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Caisse</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>
                Sélectionne des produits et des laines, ajuste le prix par ligne, puis encaisse.
              </p>
            </div>
            <span className="badge badge-green">{bundleItems.length} article{bundleItems.length > 1 ? 's' : ''}</span>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {bundleError && <div className="alert alert-error">{bundleError}</div>}
            {bundleMessage && <div className="alert alert-success">{bundleMessage}</div>}

            {bundleItems.length === 0 ? (
              <div style={{ padding: '0.9rem', border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Aucun article dans la caisse.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {bundleItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0, 1fr) minmax(76px, 100px) 36px',
                      gap: '0.65rem',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)' }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '0.92rem', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{item.name}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Prix site: {Number(item.originalPrice || 0).toFixed(2)} $</span>
                    </div>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.salePrice}
                      onChange={(e) => updateBundleItemPrice(item.key, e.target.value)}
                      aria-label={`Prix de vente pour ${item.name}`}
                    />
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => removeBundleItem(item.key)} aria-label={`Retirer ${item.name}`}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.35rem' }}>
              <button type="button" style={tabStyle(checkoutTab === 'sale')} onClick={() => setCheckoutTab('sale')}>Vente</button>
              <button type="button" style={tabStyle(checkoutTab === 'tap')} onClick={() => setCheckoutTab('tap')}>Tap to Pay</button>
              <button type="button" style={tabStyle(checkoutTab === 'link')} onClick={() => setCheckoutTab('link')}>Lien</button>
              <button type="button" style={tabStyle(checkoutTab === 'qr')} onClick={() => setCheckoutTab('qr')}>QR</button>
            </div>

            <div className="form-row">
              {checkoutTab === 'sale' && (
                <div className="form-group">
                  <label className="form-label">Méthode</label>
                  <select className="form-input" value={bundlePaymentMethod} onChange={(e) => setBundlePaymentMethod(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="E_TRANSFER">Virement Interac</option>
                    <option value="STRIPE_MANUAL">Stripe manuel</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nom client (optionnel)</label>
                <input className="form-input" value={bundleCustomerName} onChange={(e) => setBundleCustomerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Courriel client (optionnel)</label>
                <input className="form-input" type="email" value={bundleCustomerEmail} onChange={(e) => setBundleCustomerEmail(e.target.value)} />
              </div>
              {checkoutTab === 'link' && (
                <div className="form-group">
                  <label className="form-label">Livraison fixe</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={bundleShippingTotal} onChange={(e) => setBundleShippingTotal(e.target.value)} placeholder="0.00" />
                </div>
              )}
            </div>

            {checkoutTab === 'qr' && (
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.86rem', lineHeight: 1.45 }}>
                Le client scanne le QR et paie dans Stripe. Les articles ne sont vendus qu’après confirmation du paiement.
              </p>
            )}

            {bundlePaymentLink && checkoutTab === 'link' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input className="form-input" readOnly value={bundlePaymentLink} onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary btn-sm" type="button" onClick={copyBundleLink}>Copier le lien</button>
              </div>
            )}

            {bundleQrPayment && checkoutTab === 'qr' && (
              <div style={{ display: 'grid', gap: '0.75rem', justifyItems: 'center', padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-alt)' }}>
                <img
                  src={bundleQrPayment.qrDataUrl}
                  alt="Code QR Stripe"
                  style={{ width: 'min(100%, 260px)', aspectRatio: '1 / 1', borderRadius: 8, background: '#fff', padding: 10 }}
                />
                <input className="form-input" readOnly value={bundleQrPayment.checkoutUrl} onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(bundleQrPayment.checkoutUrl).then(() => setBundleMessage('Lien QR copié.')).catch(() => setBundleError('Impossible de copier automatiquement.'))}>
                  Copier le lien QR
                </button>
              </div>
            )}

            {!isNativeApp && bundleTapToPay && checkoutTab === 'tap' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input className="form-input" readOnly value={`PaymentIntent: ${bundleTapToPay.paymentIntentId}`} onFocus={(e) => e.target.select()} />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" type="button" onClick={handleBundleTapToPaySync} disabled={bundleLoading}>Vérifier paiement</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={handleBundleTapToPayCancel} disabled={bundleLoading}>Annuler</button>
                </div>
              </div>
            )}

            {isNativeApp && checkoutTab === 'tap' && (bundleLoading || bundleTapToPay) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" type="button" onClick={handleBundleTapToPayCancel} disabled={refreshing}>
                  Annuler Tap to Pay
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Total: {(bundleTotal + (checkoutTab === 'link' ? Number(bundleShippingTotal || 0) : 0)).toFixed(2)} $</strong>
              {checkoutTab === 'sale' && (
                <button className="btn btn-primary" type="button" onClick={handleBundleSale} disabled={bundleLoading || bundleItems.length < 1}>
                  {bundleLoading ? 'Encaissement...' : 'Encaisser'}
                </button>
              )}
              {checkoutTab === 'tap' && (
                <button className="btn btn-primary" type="button" onClick={handleBundleTapToPayIntent} disabled={bundleLoading || bundleItems.length < 1}>
                  {bundleLoading ? (isNativeApp ? 'Paiement en cours...' : 'Préparation...') : (isNativeApp ? 'Encaisser Tap to Pay' : 'Préparer Tap to Pay')}
                </button>
              )}
              {checkoutTab === 'link' && (
                <button className="btn btn-primary" type="button" onClick={handleBundlePaymentLink} disabled={bundleLoading || bundleItems.length < 1}>
                  {bundleLoading ? 'Génération...' : (bundleCustomerEmail.trim() ? 'Générer et envoyer le lien' : 'Générer le lien')}
                </button>
              )}
              {checkoutTab === 'qr' && (
                <button className="btn btn-primary" type="button" onClick={handleBundlePaymentQr} disabled={bundleLoading || bundleItems.length < 1}>
                  {bundleLoading ? 'Génération...' : 'Générer le QR Stripe'}
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        {tab !== 'custom' && loading && <Loader label="Chargement..." />}
        {tab !== 'custom' && error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && tab === 'products' && (
          <>
            <div
              className="card"
              style={{
                padding: '0.85rem',
                marginBottom: '1rem',
                display: 'grid',
                gap: '0.5rem',
              }}
            >
              <label className="form-label" htmlFor="market-product-category-filter" style={{ margin: 0 }}>
                Catégorie
              </label>
              <select
                id="market-product-category-filter"
                className="form-input"
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
              >
                <option value="all">Toutes les catégories</option>
                {productCategories.map((category) => {
                  const id = categoryId(category)
                  if (!id) return null
                  return (
                    <option key={id} value={id}>
                      {displayName(category)}
                    </option>
                  )
                })}
              </select>
            </div>

            <ProductMarketGrid
              products={filteredProducts}
              getCategoryName={getProductCategoryName}
              getProductImageUrl={getProductImageUrl}
              onSelectProduct={() => {}}
              bundleMode={bundleMode}
              selectedBundleKeys={selectedBundleKeys}
              onToggleBundleProduct={toggleBundleProduct}
            />
          </>
        )}

        {!loading && !error && tab === 'yarn' && (
          <YarnMarketGrid
            yarnProducts={yarnProducts}
            categories={yarnCategories}
            onSelectYarn={() => {}}
            bundleMode={bundleMode}
            selectedBundleKeys={selectedBundleKeys}
            onToggleBundleYarn={toggleBundleYarn}
          />
        )}

        {tab === 'custom' && <CustomMarketPanel />}
      </main>
    </div>
  )
}
