import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getProduct, getProducts } from '../services/api.js'
import { useCart } from '../context/CartContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import JsonLd from '../components/JsonLd.jsx'
import FavoriteButton from '../components/FavoriteButton.jsx'
import Loader from '../components/Loader.jsx'
import { productSchema, breadcrumbSchema } from '../utils/structuredData.js'
import { canAddUniqueProductToCart, isProductUnavailable } from '../utils/productAvailability.js'
import { getDisplayVariants, getDefaultVariant, getDisplayImages, hasSelectableVariants, variantForImage, variantSwatchColor } from '../utils/productVariants.js'
import { localizedDescription, localizedName } from '../utils/localizedFields.js'
import { sortProductsByAvailability } from '../utils/productAvailability.js'
import ProductCard from '../components/ProductCard.jsx'
import ProductImageLightbox from '../components/ProductImageLightbox.jsx'
import { localizedProductDetail } from '../utils/productDetails.js'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart, items } = useCart()
  const { formatPrice } = useCurrency()
  const { t, lang } = useLanguage()
  const [product, setProduct] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [imageExpanded, setImageExpanded] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [added, setAdded] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 768px)').matches ?? false)
  const addedTimerRef = useRef(null)
  const photoTouchRef = useRef(null)
  const photoSwipedRef = useRef(false)

  useEffect(() => {
    let ignore = false
    setActiveImg(0)
    setImageExpanded(false)
    getProduct(id)
      .then((data) => {
        if (!ignore) {
          const nextProduct = data.product || data
          setProduct(nextProduct)
          setSelectedVariant(getDefaultVariant(nextProduct))
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id])

  useEffect(() => {
    let ignore = false
    getProducts()
      .then((data) => {
        if (ignore) return
        const products = Array.isArray(data) ? data : data.products || []
        setCatalog(products)
      })
      .catch(() => {})

    return () => { ignore = true }
  }, [])

  useEffect(() => {
    return () => clearTimeout(addedTimerRef.current)
  }, [])

  useEffect(() => {
    const viewport = window.matchMedia?.('(max-width: 768px)')
    if (!viewport) return
    const updateLayout = () => setIsMobile(viewport.matches)
    updateLayout()
    viewport.addEventListener('change', updateLayout)
    return () => viewport.removeEventListener('change', updateLayout)
  }, [])

  function handleAddToCart() {
    if (!canAdd) return
    addToCart({ ...product, name: productName }, 1, selectedVariant)
    setAdded(true)
    clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setAdded(false), 2500)
  }

  if (loading) return <Loader label={t('products.loading')} />
  if (error) return (
    <div className="page">
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-secondary" onClick={() => navigate(-1)}>{t('form.back')}</button>
    </div>
  )
  if (!product) return null

  const images = getDisplayImages(product)
  const activeImage = images[activeImg]
  const productName = localizedName(product, lang)
  const productDescription = localizedDescription(product, lang)
  const category = typeof product.category === 'object' ? localizedName(product.category, lang) : product.category

  const ogImage = images[0]?.imageUrl || undefined
  const unavailable = isProductUnavailable(product)
  const variants = getDisplayVariants(product)
  const selectableVariants = hasSelectableVariants(product)
  const productForCart = selectedVariant ? { ...product, selectedVariantId: selectedVariant.id } : product
  const canAdd = canAddUniqueProductToCart(productForCart, items)
  const otherProducts = sortProductsByAvailability(catalog.filter(
    (candidate) => String(candidate.id ?? candidate._id) !== String(id)
  ))
  const currentCategory = typeof product.category === 'object'
    ? product.category?.name
    : product.category
  const sameCategoryProducts = otherProducts.filter((candidate) => {
    if (product.categoryId != null && candidate.categoryId != null) {
      return candidate.categoryId === product.categoryId
    }
    const candidateCategory = typeof candidate.category === 'object'
      ? candidate.category?.name
      : candidate.category
    return Boolean(currentCategory && candidateCategory && currentCategory === candidateCategory)
  })
  const relatedProducts = (sameCategoryProducts.length > 0 ? sameCategoryProducts : otherProducts).slice(0, 4)
  const detailSections = [
    { key: 'sizeFit', label: t('products.sizeDetails') },
    { key: 'materials', label: t('products.materials') },
    { key: 'care', label: t('products.care') },
  ]

  function selectImage(index) {
    setActiveImg(index)
    const nextVariant = variantForImage(product, images[index])
    if (nextVariant) setSelectedVariant(nextVariant)
  }

  function startPhotoSwipe(event) {
    photoSwipedRef.current = false
    const touch = event.touches.length === 1 ? event.touches[0] : null
    photoTouchRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function endPhotoSwipe(event) {
    const start = photoTouchRef.current
    photoTouchRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch || images.length < 2) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return
    photoSwipedRef.current = true
    selectImage((activeImg + (dx < 0 ? 1 : -1) + images.length) % images.length)
  }

  function cancelPhotoSwipe() {
    photoTouchRef.current = null
    photoSwipedRef.current = false
  }

  const storyFacts = (
          <dl className="product-story-facts">
            {category && (
              <div>
                <dt>{t('products.productType')}</dt>
                <dd>{category}</dd>
              </div>
            )}
            <div>
              <dt>{t('products.madeByHand')}</dt>
              <dd>{lang === 'fr' ? 'Crochet artisanal' : 'Hand-crocheted'}</dd>
            </div>
            {selectedVariant?.label && variants.length > 1 && (
              <div>
                <dt>{t('products.variation')}</dt>
                <dd>{selectedVariant.label}</dd>
              </div>
            )}
          </dl>
  )

  const storySection = (
        <section className="product-story-section">
          <div className="product-story-heading">
            <h2>{t('products.detailsTitle')}</h2>
          </div>
          <div className="product-story-copy">
            <p>{productDescription || (lang === 'fr'
              ? 'Chaque pièce est réalisée à la main en crochet, une à la fois.'
              : 'Each piece is crocheted by hand, one at a time.')}</p>
          </div>
          {!isMobile && storyFacts}
        </section>
  )

  return (
    <div className="product-detail-page">
      <SeoHead
        title={productName}
        description={productDescription ? productDescription.slice(0, 155) : undefined}
        image={ogImage}
        url={`/products/${id}`}
        type="product"
      />
      <JsonLd data={productSchema(product, { currency: 'CAD' })} />
      <JsonLd
        data={breadcrumbSchema([
          { name: t('products.breadcrumbHome') || 'Accueil', url: '/' },
          { name: t('products.breadcrumbProducts') || 'Produits', url: '/products' },
          ...(category ? [{ name: category, url: `/products?category=${encodeURIComponent(category)}` }] : []),
          { name: productName, url: `/products/${id}` },
        ])}
      />
      <div className="product-detail">
      {/* Gallery */}
      <div className="product-gallery">
        {images.length > 0 ? (
          <>
            <div className="product-gallery-media">
            <button type="button" className="product-gallery-main-frame product-gallery-zoom-trigger"
              aria-label={`${t('products.enlargeImage')}: ${productName}`}
              style={{ touchAction: 'pan-y' }}
              onTouchStart={startPhotoSwipe}
              onTouchEnd={endPhotoSwipe}
              onTouchCancel={cancelPhotoSwipe}
              onClick={() => {
                if (photoSwipedRef.current) { photoSwipedRef.current = false; return }
                setImageExpanded(true)
              }}>
              <img
                src={activeImage.imageUrl}
                alt={productName}
                className="product-gallery-main"
                width="720"
                height="900"
                decoding="async"
                fetchpriority="high"
                draggable={false}
              />
            </button>
            <FavoriteButton product={{ ...product, selectedVariant }} compact className="product-gallery-favorite" />
            </div>
            {activeImage?.variantLabel && (
              <div style={{ marginTop: '0.5rem', textAlign: 'center', color: 'var(--color-primary)', fontWeight: 800 }}>
                {t('products.variation')} {activeImage.variantLabel}
              </div>
            )}
            {images.length > 1 && (
              <div className="product-gallery-thumbs">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img.imageUrl}
                    alt={`${productName} ${i + 1}`}
                    className={`product-gallery-thumb${i === activeImg ? ' active' : ''}`}
                    width="72"
                    height="72"
                    loading="lazy"
                    decoding="async"
                    onClick={() => selectImage(i)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="product-gallery-main-frame product-gallery-placeholder">
            {t('products.noImage')}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <Link
          to="/products"
          style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'inline-block', marginBottom: '0.75rem' }}
        >
          {t('products.backToProducts')}
        </Link>
        {category && (
          <Link to={`/products?category=${encodeURIComponent(currentCategory || category)}`}
            className="product-info-category"
            style={{ display: 'block', width: 'fit-content', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            {category}
          </Link>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ marginBottom: 0 }}>{productName}</h1>
        </div>
        <div className="product-info-price">
          {product.price != null ? formatPrice(product.price) : t('products.priceOnRequest')}
        </div>

        {unavailable ? (
          <span className="badge badge-red" style={{ marginBottom: '1rem', display: 'inline-block' }}>{t('products.soldOut')}</span>
        ) : (
          <span className="badge badge-green" style={{ marginBottom: '1rem', display: 'inline-block' }}>{t('products.inStock')}</span>
        )}

        {product.stock != null && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            {t('products.stock')} : <strong>{product.stock}</strong>
          </p>
        )}

        {selectableVariants && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('products.variation')}</div>
            <div className="product-variant-options">
              {variants.map((variant, index) => {
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={`product-swatch product-detail-swatch${selectedVariant?.id === variant.id ? ' is-selected' : ''}`}
                    style={{
                      '--swatch-color': variantSwatchColor(variant, index),
                    }}
                    aria-pressed={selectedVariant?.id === variant.id}
                    aria-label={`${t('products.variation')} ${variant.label}`}
                    title={`${t('products.variation')} ${variant.label}`}
                    onClick={() => {
                      setSelectedVariant(variant)
                      const imageIndex = images.findIndex((image) => image.variantId === variant.id)
                      if (imageIndex >= 0) setActiveImg(imageIndex)
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {added && <div className="alert alert-success">{t('products.addedToCart')}</div>}
          <button
            className="btn btn-primary btn-lg product-add-to-cart"
            onClick={handleAddToCart}
            disabled={!canAdd}
          >
            {t('products.addToCart')}
          </button>
        </div>
        {isMobile && storySection}
        <div className="product-info-sections">
          {detailSections.map(({ key, label }) => {
            const content = localizedProductDetail(product, key, lang)
            return (
              <details key={key} className="product-info-section">
                <summary>{label}<span className="product-info-section-toggle" aria-hidden="true" /></summary>
                <div className="product-info-section-content">
                  <p>{content || t('products.detailsComingSoon')}</p>
                </div>
              </details>
            )
          })}
        </div>
        {isMobile && storyFacts}
      </div>
      </div>

      <div className="product-detail-below">
        {!isMobile && storySection}

        {relatedProducts.length > 0 && (
          <section className="product-recommendations">
            <div className="product-recommendations-heading">
              <div>
                <span>{category || t('products.title')}</span>
                <h2>{t('products.youMayAlsoLike')}</h2>
              </div>
              <Link to={`/products?category=${encodeURIComponent(category || '')}`}>
                {t('home.seeAll')} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="product-grid product-recommendations-grid">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id ?? relatedProduct._id}
                  product={relatedProduct}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      {imageExpanded && activeImage?.imageUrl && (
        <ProductImageLightbox src={activeImage.imageUrl} alt={productName}
          onTouchStart={startPhotoSwipe} onTouchEnd={endPhotoSwipe} onTouchCancel={cancelPhotoSwipe}
          onClose={() => { cancelPhotoSwipe(); setImageExpanded(false) }} />
      )}
    </div>
  )
}
