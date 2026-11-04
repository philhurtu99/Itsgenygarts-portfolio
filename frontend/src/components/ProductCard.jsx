import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isProductUnavailable } from '../utils/productAvailability.js'
import { getDisplayVariants, getDisplayImages, variantSwatchColor } from '../utils/productVariants.js'
import { localizedName } from '../utils/localizedFields.js'
import FavoriteButton from './FavoriteButton.jsx'

export default function ProductCard({ product }) {
  const { formatPrice } = useCurrency()
  const { t, lang } = useLanguage()
  const productName = localizedName(product, lang)
  const unavailable = isProductUnavailable(product)
  const productId = product.id ?? product._id
  const productUrl = `/products/${encodeURIComponent(productId)}`
  const variants = getDisplayVariants(product)
  const images = getDisplayImages(product).filter((image) => !product.productVariantId || image.variantId === product.productVariantId)
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.productVariantId || null
  )
  const [activeImageIndex, setActiveImageIndex] = useState(null)
  const touchStartRef = useRef(null)
  const swipedRef = useRef(false)
  const selectedVariantImage = images.find((image) => image.variantId === selectedVariantId)
  const imageUrl = images[activeImageIndex]?.imageUrl
    || product.variantImageUrl
    || selectedVariantImage?.imageUrl
    || images[0]?.imageUrl
    || null
  const category = product.category
    ? (typeof product.category === 'object' ? localizedName(product.category, lang) : product.category)
    : null
  const showVariantSwatches = variants.length > 1 && !product.productVariantId
  const swatchesRef = useRef(null)
  const [swatchLimit, setSwatchLimit] = useState(2)
  const hiddenVariantCount = Math.max(0, variants.length - swatchLimit)

  useLayoutEffect(() => {
    const row = swatchesRef.current
    if (!row) return
    const measure = row.querySelector('.product-card-more-measure')
    const update = () => {
      const style = getComputedStyle(row)
      const width = row.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0)
      if (!width) return
      const size = row.querySelector('.product-swatch')?.getBoundingClientRect().width || 19
      const gap = parseFloat(style.columnGap) || 0
      const fitsAll = variants.length * size + (variants.length - 1) * gap <= width
      const count = fitsAll ? variants.length : Math.min(variants.length - 1, Math.max(0,
        Math.floor((width - measure.getBoundingClientRect().width) / (size + gap))))
      setSwatchLimit(count)
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(row)
    observer?.observe(measure)
    return () => observer?.disconnect()
  }, [showVariantSwatches, variants.length, lang])

  function startSwipe(event) {
    swipedRef.current = false
    const touch = event.touches.length === 1 ? event.touches[0] : null
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function endSwipe(event) {
    const start = touchStartRef.current
    touchStartRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch || images.length < 2) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return
    const currentIndex = activeImageIndex ?? Math.max(0, images.findIndex((image) => image.imageUrl === imageUrl))
    const nextIndex = (currentIndex + (dx < 0 ? 1 : -1) + images.length) % images.length
    setActiveImageIndex(nextIndex)
    setSelectedVariantId(images[nextIndex].variantId)
    swipedRef.current = true
    event.preventDefault()
  }

  return (
    <article className={`product-card-shell${unavailable ? ' product-card-unavailable' : ''}`}>
      <div className="product-card">
        <div className="product-card-media-wrap">
          <Link to={productUrl} className="product-card-media" aria-label={productName}
            style={{ touchAction: 'pan-y' }} draggable={false}
            onTouchStart={startSwipe} onTouchEnd={endSwipe}
            onTouchCancel={() => { touchStartRef.current = null; swipedRef.current = false }}
            onClick={(event) => {
              if (!swipedRef.current) return
              event.preventDefault()
              swipedRef.current = false
            }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="product-card-image"
                width="360"
                height="450"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : (
              <div className="product-card-empty-image">
                {t('products.noImage')}
              </div>
            )}
            {unavailable && (
              <span className="product-card-sold-badge">{t('products.soldOut')}</span>
            )}
          </Link>
          <FavoriteButton
            product={product}
            compact
            className="product-card-favorite"
          />
        </div>

        <div className="product-card-body">
          {category && <span className="product-card-category">{category}</span>}
          <div className="product-card-meta">
            <h3 className="product-card-title">
              <Link to={productUrl}>{productName}</Link>
            </h3>
            {product.price != null && (
              <span className="product-card-price">{formatPrice(product.price)}</span>
            )}
          </div>

          {showVariantSwatches && (
            <div ref={swatchesRef} className="product-card-swatches" aria-label={t('products.variation')}>
              <span className="product-card-more-measure" aria-hidden="true">{t('products.moreVariants', { count: variants.length })}</span>
              {variants.slice(0, swatchLimit).map((variant, index) => {
                const variantColor = variantSwatchColor(variant, index)
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={`product-swatch${selectedVariantId === variant.id ? ' is-selected' : ''}`}
                    style={{
                      '--swatch-color': variantColor,
                    }}
                    aria-label={`${t('products.variation')} ${variant.label}`}
                    aria-pressed={selectedVariantId === variant.id}
                    title={`${t('products.variation')} ${variant.label}`}
                    onClick={() => { setSelectedVariantId(variant.id); setActiveImageIndex(null) }}
                  />
                )
              })}
              {hiddenVariantCount > 0 && <Link className="product-card-more-variants" to={productUrl}
                aria-label={t('products.viewMoreVariants', { count: hiddenVariantCount })}>
                {t(hiddenVariantCount === 1 ? 'products.moreVariant' : 'products.moreVariants', { count: hiddenVariantCount })}
              </Link>}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
