import { useEffect, useId, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { canAddUniqueProductToCart, isProductUnavailable } from '../utils/productAvailability.js'
import FavoriteButton from './FavoriteButton.jsx'
import { getDisplayVariants, getDefaultVariant, getDisplayImages, hasSelectableVariants, variantForImage } from '../utils/productVariants.js'
import { localizedDescription, localizedName } from '../utils/localizedFields.js'

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart, items } = useCart()
  const { formatPrice } = useCurrency()
  const { t, lang } = useLanguage()
  const [activeImg, setActiveImg] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState(() => getDefaultVariant(product))
  const [added, setAdded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const addedTimerRef = useRef(null)
  const panelRef = useRef(null)
  const fullscreenRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement
    const panel = fullscreen ? fullscreenRef.current : panelRef.current
    const focusables = () => Array.from(panel?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') || [])
    ;(focusables()[0] || panel)?.focus()
    function trapFocus(event) {
      if (event.key !== 'Tab') return
      const nodes = focusables()
      const first = nodes[0] || panel
      const last = nodes[nodes.length - 1] || panel
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [fullscreen])

  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [])

  const unavailable = isProductUnavailable(product)
  const variants = getDisplayVariants(product)
  const selectableVariants = hasSelectableVariants(product)
  const productForCart = selectedVariant ? { ...product, selectedVariantId: selectedVariant.id } : product
  const canAdd = canAddUniqueProductToCart(productForCart, items)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, onClose])

  useEffect(() => {
    return () => clearTimeout(addedTimerRef.current)
  }, [])

  if (!product) return null

  const images = getDisplayImages(product)
  const activeImage = images[activeImg]
  const activeImageVariant = variantForImage(product, activeImage)

  const productName = localizedName(product, lang)
  const productDescription = localizedDescription(product, lang)
  const category = typeof product.category === 'object' ? localizedName(product.category, lang) : product.category

  function handleAddToCart() {
    if (!canAdd) return
    addToCart({ ...product, name: productName }, 1, selectedVariant)
    setAdded(true)
    clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setAdded(false), 2500)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ zIndex: 1000 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={fullscreen || undefined} inert={fullscreen ? '' : undefined} tabIndex={-1} className="product-modal-panel" style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 720,
        width: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
      }}>
        <button
          type="button"
          className="product-detail-close"
          aria-label={t('common.close')}
          onClick={onClose}
        >×</button>

        <div className={`product-modal-grid${images.length > 0 ? ' has-images' : ''}`}>
          {images.length > 0 && (
            <div className="product-modal-media-column">
              <button
                type="button"
                className="product-modal-image-frame"
                aria-label={productName}
                onClick={() => setFullscreen(true)}
              >
                <img
                  src={activeImage.imageUrl}
                  alt={productName}
                  className="product-modal-main-image"
                  width="720"
                  height="900"
                  decoding="async"
                />
              </button>
              {activeImage?.variantLabel && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textAlign: 'center' }}>
                  {t('products.variation')} {activeImage.variantLabel}
                </div>
              )}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      className="product-photo-thumbnail"
                      aria-label={t('common.photo', { number: i + 1 })}
                      aria-pressed={i === activeImg}
                      onClick={() => {
                        setActiveImg(i)
                        const nextVariant = variantForImage(product, img)
                        if (nextVariant) setSelectedVariant(nextVariant)
                      }}
                      style={{
                        width: 52, height: 52, padding: 0, overflow: 'hidden',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        border: i === activeImg ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                        opacity: i === activeImg ? 1 : 0.7,
                      }}
                    >
                      <img src={img.imageUrl} alt="" width="52" height="52" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {category && (
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                {category}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h2 id={titleId} style={{ fontSize: '1.4rem', marginBottom: 0 }}>{productName}</h2>
              <FavoriteButton product={{ ...product, selectedVariant }} compact />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
              {product.price != null ? formatPrice(product.price) : t('products.priceOnRequest')}
            </div>

            {unavailable ? (
              <span className="badge badge-red" style={{ marginBottom: '0.5rem', display: 'inline-block', width: 'fit-content' }}>{t('products.soldOut')}</span>
            ) : (
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-green">{t('products.inStock')}</span>
              </div>
            )}

            {productDescription && (
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', lineHeight: 1.7, fontSize: '0.9rem' }}>
                {productDescription}
              </p>
            )}

            {selectableVariants && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('products.variation')}</div>
                <div className="product-variant-options">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className={`product-variant-button${selectedVariant?.id === variant.id ? ' is-selected' : ''}`}
                      aria-pressed={selectedVariant?.id === variant.id}
                      aria-label={`${t('products.variation')} ${variant.label}`}
                      onClick={() => {
                        setSelectedVariant(variant)
                        const imageIndex = images.findIndex((image) => image.variantId === variant.id)
                        if (imageIndex >= 0) setActiveImg(imageIndex)
                      }}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {added && <div className="alert alert-success">{t('products.addedToCart')}</div>}
              {!canAdd && !unavailable && <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>{t('cart.maxStock')}</div>}
              <button
                className="btn btn-primary product-add-to-cart"
                onClick={handleAddToCart}
                disabled={!canAdd}
              >
                {t('products.addToCart')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {fullscreen && images.length > 0 && (
        <div
          ref={fullscreenRef}
          role="dialog"
          aria-modal="true"
          aria-label={productName}
          tabIndex={-1}
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            className="product-detail-close product-detail-close--fullscreen"
            aria-label={t('common.close')}
            onClick={(event) => {
              event.stopPropagation()
              setFullscreen(false)
            }}
          >×</button>

          {images.length > 1 && (
            <button
              aria-label={t('common.previousImage')}
              onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i - 1 + images.length) % images.length) }}
              style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none',
                fontSize: '1.5rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >‹</button>
          )}

          <img
            src={activeImage.imageUrl}
            alt={productName}
            width="1200"
            height="1200"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', borderRadius: '4px',
              cursor: 'default',
            }}
          />
          {activeImageVariant?.label && (
            <div style={{ position: 'absolute', bottom: images.length > 1 ? '3rem' : '1.5rem', color: 'white', fontWeight: 800 }}>
              {t('products.variation')} {activeImageVariant.label}
            </div>
          )}

          {images.length > 1 && (
            <button
              aria-label={t('common.nextImage')}
              onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i + 1) % images.length) }}
              style={{
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none',
                fontSize: '1.5rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >›</button>
          )}

          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={t('common.photo', { number: i + 1 })}
                  aria-pressed={i === activeImg}
                  onClick={(e) => { e.stopPropagation(); setActiveImg(i) }}
                  style={{
                    width: 24, height: 24, border: 0, padding: 0, borderRadius: '50%', cursor: 'pointer',
                    background: i === activeImg ? 'white' : 'rgba(255,255,255,0.4)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
