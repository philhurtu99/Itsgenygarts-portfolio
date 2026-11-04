import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useCustomerAuth } from './CustomerAuthContext.jsx'
import {
  addServerFavorite,
  getServerFavorites,
  removeServerFavorite,
  syncServerFavorites,
} from '../services/api.js'
import { isProductUnavailable } from '../utils/productAvailability.js'
import { getAvailableVariants } from '../utils/productVariants.js'
import { readJsonLocalStorage, writeJsonLocalStorage } from '../utils/browserStorage.js'

const FavoriteContext = createContext(null)
const STORAGE_KEY = 'favorites'

function productIdOf(product) {
  const id = Number(product?.id ?? product?._id)
  return Number.isInteger(id) ? id : null
}

function productSummary(product) {
  const id = productIdOf(product)
  if (!id) return null
  if (isProductUnavailable(product)) return null
  const variants = getAvailableVariants(product)
  const variant = product.selectedVariant
    || variants.find((item) => String(item.id) === String(product.selectedVariantId || product.productVariantId || ''))
    || variants[0]
  const variantId = variant?.id || product.productVariantId || null
  const showVariantLabel = variants.length > 1
  const variantLabel = showVariantLabel ? (variant?.label || product.variantLabel || null) : null
  const variantImageUrl = variant?.images?.[0]?.imageUrl || product.variantImageUrl || null

  return {
    id,
    productId: id,
    productVariantId: variantId,
    variantLabel,
    variantImageUrl,
    name: product.name,
    nameFr: product.nameFr || null,
    nameEn: product.nameEn || null,
    description: product.description || null,
    descriptionFr: product.descriptionFr || null,
    descriptionEn: product.descriptionEn || null,
    price: product.price != null ? Number(product.price) : null,
    mainImageUrl: variantImageUrl || product.mainImageUrl || product.images?.[0]?.imageUrl || product.imageUrl || null,
    stockQuantity: product.stockQuantity ?? 0,
    soldOut: Boolean(product.soldOut),
    category: product.category,
    images: product.images,
    variants: product.variants,
  }
}

function favoriteKey(productId, productVariantId = null) {
  return `${Number(productId)}:${productVariantId || ''}`
}

function normalizeItems(items) {
  const byKey = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const summary = productSummary(item)
    if (summary) byKey.set(favoriteKey(summary.id, summary.productVariantId), summary)
  }
  return [...byKey.values()]
}

function loadFavorites() {
  return normalizeItems(readJsonLocalStorage(STORAGE_KEY, []))
}

function saveFavorites(items) {
  writeJsonLocalStorage(STORAGE_KEY, normalizeItems(items))
}

export function FavoriteProvider({ children }) {
  const { isLoggedIn, ready } = useCustomerAuth()
  const [items, setItems] = useState(loadFavorites)

  const persistLocal = useCallback((next) => {
    const normalized = normalizeItems(next)
    saveFavorites(normalized)
    return normalized
  }, [])

  useEffect(() => {
    if (!ready) return

    let cancelled = false

    async function syncFavorites() {
      if (!isLoggedIn) {
        setItems(loadFavorites())
        return
      }

      try {
        const localItems = loadFavorites()
        const serverItems = localItems.length > 0
          ? await syncServerFavorites(localItems)
          : await getServerFavorites()

        if (cancelled) return
        const normalized = persistLocal(serverItems)
        setItems(normalized)
      } catch {
        if (!cancelled) setItems(loadFavorites())
      }
    }

    syncFavorites()
    return () => { cancelled = true }
  }, [isLoggedIn, persistLocal, ready])

  const isFavorite = useCallback((productId, productVariantId = null) => {
    const id = Number(productId)
    return items.some((item) => item.id === id && (item.productVariantId || null) === (productVariantId || null))
  }, [items])

  const addFavorite = useCallback((product) => {
    const summary = productSummary(product)
    if (!summary) return

    setItems((prev) => {
      if (prev.some((item) => favoriteKey(item.id, item.productVariantId) === favoriteKey(summary.id, summary.productVariantId))) return prev
      const next = persistLocal([summary, ...prev])

      if (isLoggedIn) {
        addServerFavorite(summary.id, summary.productVariantId).catch(() => {})
      }

      return next
    })
  }, [isLoggedIn, persistLocal])

  const removeFavorite = useCallback((productId, productVariantId = null) => {
    const id = Number(productId)
    setItems((prev) => {
      const next = persistLocal(prev.filter((item) => favoriteKey(item.id, item.productVariantId) !== favoriteKey(id, productVariantId)))

      if (isLoggedIn && Number.isInteger(id)) {
        removeServerFavorite(id, productVariantId).catch(() => {})
      }

      return next
    })
  }, [isLoggedIn, persistLocal])

  const toggleFavorite = useCallback((product) => {
    const summary = productSummary(product)
    if (!summary) return
    if (isFavorite(summary.id, summary.productVariantId)) removeFavorite(summary.id, summary.productVariantId)
    else addFavorite(product)
  }, [addFavorite, isFavorite, removeFavorite])

  const value = useMemo(() => ({
    items,
    favoriteCount: items.length,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  }), [addFavorite, isFavorite, items, removeFavorite, toggleFavorite])

  return (
    <FavoriteContext.Provider value={value}>
      {children}
    </FavoriteContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoriteContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoriteProvider')
  return ctx
}
