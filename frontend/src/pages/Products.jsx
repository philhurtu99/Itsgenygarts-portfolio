import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProducts, getCategories } from '../services/api.js'
import ProductCard from '../components/ProductCard.jsx'
import Loader from '../components/Loader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import { isProductUnavailable, sortProductsByAvailability } from '../utils/productAvailability.js'
import { localizedName } from '../utils/localizedFields.js'
import { getLocalPreviewCategories, getLocalPreviewProducts } from '../utils/localPreviewProducts.js'

const LEGACY_CATEGORY = '__legacy_creations__'

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const requestedCategory = searchParams.get('category')
  const [activeCategory, setActiveCategory] = useState(requestedCategory)
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState('featured')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { t, lang } = useLanguage()

  useEffect(() => {
    setActiveCategory(requestedCategory)
  }, [requestedCategory])

  function selectCategory(category) {
    setActiveCategory(category)
    const next = new URLSearchParams(searchParams)
    if (category) next.set('category', category)
    else next.delete('category')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(Array.isArray(data) ? data : data.categories || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getProducts()
      .then(async (data) => {
        const list = Array.isArray(data) ? data : data.products || []
        if (list.length > 0) {
          setProducts(list)
          return
        }

        const previewProducts = await getLocalPreviewProducts()
        setProducts(previewProducts)
        setCategories((current) => current.length > 0 ? current : getLocalPreviewCategories(previewProducts))
      })
      .catch(async (err) => {
        const previewProducts = await getLocalPreviewProducts()
        if (previewProducts.length > 0) {
          setProducts(previewProducts)
          setCategories((current) => current.length > 0 ? current : getLocalPreviewCategories(previewProducts))
          return
        }
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const visibleProducts = useMemo(() => {
    const getCategoryName = (product) => {
      if (!product?.category) return null
      return typeof product.category === 'object' ? localizedName(product.category, lang) : product.category
    }

    const normalizedSearch = search.trim().toLowerCase()

    const filtered = products.filter((product) => {
      const unavailable = isProductUnavailable(product)
      if (activeCategory === LEGACY_CATEGORY && !unavailable) return false
      if (activeCategory && activeCategory !== LEGACY_CATEGORY) {
        const rawCategoryName = typeof product.category === 'object' ? product.category.name : product.category
        const localizedCategoryName = getCategoryName(product)
        if (rawCategoryName !== activeCategory && localizedCategoryName !== activeCategory) return false
      }
      if (sortOption === 'sold' && !unavailable) return false
      if (normalizedSearch) {
        const haystack = [
          product.name,
          product.nameFr,
          product.nameEn,
          product.description,
          product.descriptionFr,
          product.descriptionEn,
          getCategoryName(product),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(normalizedSearch)) return false
      }
      return true
    })

    const compareNames = (a, b) => localizedName(a, lang).localeCompare(
      localizedName(b, lang),
      lang === 'en' ? 'en-CA' : 'fr-CA',
      { sensitivity: 'base', numeric: true }
    )
    const comparePrices = (a, b, direction) => {
      const aPrice = Number(a.price)
      const bPrice = Number(b.price)
      const aHasPrice = a.price !== null && a.price !== undefined && a.price !== '' && Number.isFinite(aPrice)
      const bHasPrice = b.price !== null && b.price !== undefined && b.price !== '' && Number.isFinite(bPrice)
      if (aHasPrice !== bHasPrice) return aHasPrice ? -1 : 1
      return aHasPrice ? (aPrice - bPrice) * direction : 0
    }

    return sortProductsByAvailability(filtered, (a, b) => {
      if (sortOption === 'alphabetical-asc') return compareNames(a, b)
      if (sortOption === 'alphabetical-desc') return compareNames(b, a)
      if (sortOption === 'price-asc') return comparePrices(a, b, 1)
      if (sortOption === 'price-desc') return comparePrices(a, b, -1)

      return Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured))
    })
  }, [activeCategory, lang, products, search, sortOption])

  const hasLegacyProducts = useMemo(
    () => products.some((product) => isProductUnavailable(product)),
    [products]
  )

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => localizedName(a, lang).localeCompare(localizedName(b, lang), lang === 'en' ? 'en-CA' : 'fr-CA', {
      sensitivity: 'base',
      numeric: true,
    })),
    [categories, lang]
  )

  const desc = lang === 'fr'
    ? 'Parcourez notre collection de créations crochet artisanales — cardigans, bonnets, accessoires faits main et personnalisables.'
    : 'Browse our collection of handmade crochet pieces — cardigans, beanies, accessories, all customizable.'

  return (
    <div className="page">
      <SeoHead title={t('products.title')} url="/products" description={desc} />
      <h1 style={{ marginBottom: '1.5rem' }}>{t('products.title')}</h1>

      <div className="product-search-panel">
        <input
          className="form-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === 'fr' ? 'Rechercher un produit...' : 'Search products...'}
          aria-label={lang === 'fr' ? 'Rechercher un produit' : 'Search products'}
        />
        <label className="product-sort-field">
          <span>{lang === 'fr' ? 'Catégorie' : 'Category'}</span>
          <select
            className="form-select"
            value={activeCategory || ''}
            onChange={(event) => selectCategory(event.target.value || null)}
          >
            <option value="">{t('products.all')}</option>
            {hasLegacyProducts && (
              <option value={LEGACY_CATEGORY}>{t('products.legacyCreations')}</option>
            )}
            {sortedCategories.map((cat) => (
              <option key={cat._id || cat.id} value={cat.name || cat._id}>
                {localizedName(cat, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="product-sort-field">
          <span>{lang === 'fr' ? 'Trier par' : 'Sort by'}</span>
          <select
            className="form-select"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value)}
          >
            <option value="featured">{lang === 'fr' ? 'En vedette' : 'Featured'}</option>
            <option value="alphabetical-asc">{lang === 'fr' ? 'Alphabétique, A–Z' : 'Alphabetically, A–Z'}</option>
            <option value="alphabetical-desc">{lang === 'fr' ? 'Alphabétique, Z–A' : 'Alphabetically, Z–A'}</option>
            <option value="price-asc">{lang === 'fr' ? 'Prix, croissant' : 'Price, low to high'}</option>
            <option value="price-desc">{lang === 'fr' ? 'Prix, décroissant' : 'Price, high to low'}</option>
            <option value="sold">{lang === 'fr' ? 'Vendus' : 'Sold'}</option>
          </select>
        </label>
      </div>

      {loading && <Loader label={t('products.loading')} />}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && visibleProducts.length === 0 && (
        <div className="empty-state">{t('products.empty')}</div>
      )}
      {!loading && !error && visibleProducts.length > 0 && (
        <div className="product-grid">
          {visibleProducts.map((p) => (
            <ProductCard key={p._id || p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
