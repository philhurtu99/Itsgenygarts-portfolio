import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { syncServerCart, replaceServerCart, getServerCart, getProducts } from '../services/api.js'
import { isProductUnavailable } from '../utils/productAvailability.js'
import { getAvailableVariants } from '../utils/productVariants.js'
import { readJsonLocalStorage, readLocalStorage, removeLocalStorage, writeJsonLocalStorage } from '../utils/browserStorage.js'

const CartContext = createContext(null)
const PENDING_CART_SYNC = 'cart_pending_sync'

function customerId() {
  return readJsonLocalStorage('customer_info')?.id
}

function pendingCartSync() {
  const pending = readJsonLocalStorage(PENDING_CART_SYNC)
  return pending?.customerId === customerId() ? pending : null
}

function loadCart() {
  const items = readJsonLocalStorage('cart', [])
  return Array.isArray(items)
    ? items.filter((item) => !isProductUnavailable(item)).map((item) => ({ ...item, quantity: 1 }))
    : []
}

function saveCart(items) {
  writeJsonLocalStorage('cart', items)
}

function hasLoggedInCustomer() {
  return Boolean(readLocalStorage('customer_info'))
}

function sanitizeCartItems(items) {
  return items.filter((item) => !isProductUnavailable(item)).map((item) => ({ ...item, quantity: 1 }))
}

function cartKeyFor(id, variantId) {
  return `${id}:${variantId || ''}`
}

function freshVariantForItem(product, item) {
  if (!item.productVariantId) return null
  return getAvailableVariants(product).find((variant) => variant.id === item.productVariantId) || null
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)
  const syncQueueRef = useRef(Promise.resolve())
  const revisionRef = useRef(readJsonLocalStorage(PENDING_CART_SYNC)?.revision || 0)
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const queueServerCart = useCallback((next) => {
    const pending = { customerId: customerId(), items: next, revision: ++revisionRef.current }
    writeJsonLocalStorage(PENDING_CART_SYNC, pending)
    const operation = syncQueueRef.current.catch(() => {}).then(async () => {
      if (customerId() !== pending.customerId) return next
      const saved = await replaceServerCart(next)
      if (pendingCartSync()?.revision === pending.revision) removeLocalStorage(PENDING_CART_SYNC)
      return saved
    })
    syncQueueRef.current = operation
    operation.catch(() => {})
    return operation
  }, [])

  function persistAndSync(next) {
    ++revisionRef.current
    itemsRef.current = next
    saveCart(next)
    if (hasLoggedInCustomer()) queueServerCart(next)
  }

  const addToCart = useCallback((product, quantity = 1, selectedVariant = null) => {
    const prev = itemsRef.current
    const id = product.id || product._id
    const stock = Math.max(0, Number(product.stockQuantity ?? 0))
    const unavailable = isProductUnavailable(product)
    const variants = getAvailableVariants(product)
    const showVariantLabel = variants.length > 1
    const variant = selectedVariant
      || variants.find((v) => v.id === product.selectedVariantId || v.id === product.productVariantId)
      || (product.productVariantId ? {
        id: product.productVariantId,
        label: product.variantLabel || null,
        images: product.variantImageUrl ? [{ imageUrl: product.variantImageUrl }] : [],
      } : null)
      || (variants.length === 1 ? variants[0] : null)
    if (variants.length > 1 && !variant) {
      return
    }
    const variantId = variant?.id || null
    const existing = prev.find((i) => cartKeyFor(i.id, i.productVariantId) === cartKeyFor(id, variantId))
    if (unavailable || stock <= 0 || existing) {
      return
    }

    const next = [...prev, {
      id,
      productId: id,
      productVariantId: variantId,
      variantLabel: showVariantLabel ? (variant?.label || null) : null,
      variantImageUrl: variant?.images?.[0]?.imageUrl || null,
      name: product.name,
      nameFr: product.nameFr || null,
      nameEn: product.nameEn || null,
      description: product.description || null,
      descriptionFr: product.descriptionFr || null,
      descriptionEn: product.descriptionEn || null,
      price: Number(product.price),
      mainImageUrl: variant?.images?.[0]?.imageUrl || product.mainImageUrl || product.images?.[0]?.imageUrl || null,
      soldOut: unavailable,
      stockQuantity: stock,
      quantity: Math.min(1, quantity, stock),
    }]
    persistAndSync(next)
    setItems(next)
  }, [])

  const removeFromCart = useCallback((id, variantId = null) => {
    const prev = itemsRef.current
    const next = prev.filter((i) => cartKeyFor(i.id, i.productVariantId) !== cartKeyFor(id, variantId))
    persistAndSync(next)
    setItems(next)
  }, [])

  const updateQuantity = useCallback((id, quantity, variantId = null) => {
    const prev = itemsRef.current
    const item = prev.find((i) => cartKeyFor(i.id, i.productVariantId) === cartKeyFor(id, variantId))
    const stock = Math.max(0, Number(item?.stockQuantity ?? 0))
    const capped = Math.min(1, quantity, stock)
    const next = capped <= 0
      ? prev.filter((i) => cartKeyFor(i.id, i.productVariantId) !== cartKeyFor(id, variantId))
      : prev.map((i) => cartKeyFor(i.id, i.productVariantId) === cartKeyFor(id, variantId) ? { ...i, quantity: capped } : i)
    persistAndSync(next)
    setItems(next)
  }, [])

  const clearCart = useCallback(() => {
    persistAndSync([])
    setItems([])
  }, [])

  const restoreCartItems = useCallback(async (itemsToRestore = []) => {
    const sanitized = sanitizeCartItems(itemsToRestore)
    ++revisionRef.current
    itemsRef.current = sanitized
    saveCart(sanitized)
    setItems(sanitized)

    if (hasLoggedInCustomer()) {
      try {
        const operation = queueServerCart(sanitized)
        const revision = revisionRef.current
        const merged = await operation
        if (revision !== revisionRef.current) return itemsRef.current
        const serverItems = sanitizeCartItems(merged)
        itemsRef.current = serverItems
        saveCart(serverItems)
        setItems(serverItems)
        return serverItems
      } catch {
        // Keep the restored local cart as the fallback.
      }
    }

    return sanitized
  }, [])

  const refreshCartAvailability = useCallback(async () => {
    try {
      if (hasLoggedInCustomer()) {
        const owner = customerId()
        await syncQueueRef.current.catch(() => {})
        const pending = pendingCartSync()
        if (pending) {
          try { await queueServerCart(itemsRef.current) } catch { return itemsRef.current }
        }
        const revision = revisionRef.current
        const serverItems = await getServerCart()
        if (revision !== revisionRef.current || owner !== customerId()) return itemsRef.current
        const sanitized = sanitizeCartItems(serverItems)
        itemsRef.current = sanitized
        saveCart(sanitized)
        setItems(sanitized)
        return sanitized
      }

      if (itemsRef.current.length === 0) {
        return []
      }

      const products = await getProducts()
      const productById = new Map(products.map((product) => [String(product.id || product._id), product]))

      const nextItems = itemsRef.current
        .map((item) => {
          const fresh = productById.get(String(item.id))
          if (!fresh || isProductUnavailable(fresh)) return null
          const freshVariant = freshVariantForItem(fresh, item)
          const showVariantLabel = getAvailableVariants(fresh).length > 1
          if (item.productVariantId && !freshVariant) return null
          return {
            ...item,
            name: fresh.name,
            price: Number(fresh.price),
            variantLabel: showVariantLabel ? (freshVariant?.label || item.variantLabel || null) : null,
            variantImageUrl: freshVariant?.images?.[0]?.imageUrl || item.variantImageUrl || null,
            mainImageUrl: freshVariant?.images?.[0]?.imageUrl || fresh.mainImageUrl || fresh.images?.[0]?.imageUrl || item.mainImageUrl || null,
            stockQuantity: fresh.stockQuantity ?? item.stockQuantity,
            soldOut: isProductUnavailable(fresh),
            quantity: 1,
          }
        })
        .filter(Boolean)
      itemsRef.current = nextItems
      saveCart(nextItems)
      setItems(nextItems)
      return nextItems
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    refreshCartAvailability()

    function handleRefresh() {
      refreshCartAvailability()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshCartAvailability()
      }
    }

    window.addEventListener('focus', handleRefresh)
    window.addEventListener('pageshow', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('pageshow', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshCartAvailability])

  const syncCartOnLogin = useCallback(async () => {
    try {
      if (pendingCartSync()) {
        await queueServerCart(loadCart())
        return refreshCartAvailability()
      }
      const localItems = loadCart()
      const owner = customerId()
      const revision = ++revisionRef.current
      const operation = syncQueueRef.current.catch(() => {}).then(() => localItems.length > 0 ? syncServerCart(localItems) : getServerCart())
      syncQueueRef.current = operation
      const serverItems = await operation
      if (revision !== revisionRef.current || owner !== customerId()) return
      const sanitized = sanitizeCartItems(serverItems)
      itemsRef.current = sanitized
      saveCart(sanitized)
      setItems(sanitized)
    } catch {
      // keep local cart as fallback
    }
  }, [])

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, restoreCartItems, syncCartOnLogin, refreshCartAvailability, cartCount, cartTotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
