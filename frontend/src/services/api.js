import { readLocalStorage } from '../utils/browserStorage.js'

function defaultApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`
  }
  return 'http://localhost:3001/api'
}

const BASE_URL = import.meta.env.VITE_API_URL || defaultApiBaseUrl()

function currentLanguage() {
  const stored = readLocalStorage('lang')
  if (stored === 'fr' || stored === 'en') return stored
  return navigator.language?.slice(0, 2) || 'fr'
}

function apiHeaders(extra = {}) {
  return {
    'X-Language': currentLanguage(),
    'Accept-Language': currentLanguage(),
    ...extra,
  }
}

async function request(method, path, data = null) {
  const headers = apiHeaders({ 'Content-Type': 'application/json' })

  const options = { method, headers, credentials: 'include' }
  if (data) options.body = JSON.stringify(data)

  const res = await fetch(`${BASE_URL}${path}`, options)
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw Object.assign(new Error(json.message || json.error || `HTTP ${res.status}`), { code: json.code, status: res.status })
  }
  return json.data !== undefined ? json.data : json
}

// --- Products ---
export const getProducts = () => request('GET', '/products')
export const getProduct = (id) => request('GET', `/products/${id}`)
export const getProductsByCategory = (cat) => request('GET', `/products?category=${encodeURIComponent(cat)}`)
export const getFeaturedProducts = (limit = 6) => request('GET', `/products?featured=true&limit=${encodeURIComponent(limit)}`)
export const getCategories = () => request('GET', '/categories')

// --- Custom Orders ---
export const createCustomOrder = (data) => request('POST', '/custom-orders', data)
export const getModelOptions = () => request('GET', '/custom-orders/model-options')
export const getCustomOrderCategories = () => request('GET', '/custom-orders/categories')

export async function uploadCustomOrderImages(orderId, files, uploadToken) {
  const fd = new FormData()
  files.forEach((file) => fd.append('images', file))
  if (uploadToken) fd.append('uploadToken', uploadToken)
  const res = await fetch(`${BASE_URL}/custom-orders/${orderId}/images`, {
    method: 'POST',
    headers: apiHeaders(),
    body: fd,
    credentials: 'include',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  return json.data !== undefined ? json.data : json
}

// --- Personalized Quotes ---
export const createPersonalizedQuote = (data) => request('POST', '/personalized-quotes', data)

export async function uploadPersonalizedQuoteImages(quoteId, files, uploadToken) {
  const fd = new FormData()
  files.forEach((file) => fd.append('images', file))
  if (uploadToken) fd.append('uploadToken', uploadToken)
  const res = await fetch(`${BASE_URL}/personalized-quotes/${quoteId}/images`, {
    method: 'POST',
    headers: apiHeaders(),
    body: fd,
    credentials: 'include',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  return json.data !== undefined ? json.data : json
}

// --- Product References ---
export const getProductReferences = (category) => request('GET', `/product-references${category ? `?category=${encodeURIComponent(category)}` : ''}`)

// --- Cart / Orders ---
export const submitOrder = (data) => request('POST', '/quotes', data)
export const createQuoteRequest = ({ customer, items }) => request('POST', '/quotes', {
  customerName: customer?.name,
  customerEmail: customer?.email,
  customerPhone: customer?.phone || undefined,
  shippingAddress: customer?.address,
  city: customer?.city,
  postalCode: customer?.postalCode,
  country: customer?.country,
  message: customer?.notes,
  items,
})

// --- Orders (checkout system) ---
export const getCurrencies = () => request('GET', '/orders/currencies')
export const calculateShipping = (data) => request('POST', '/orders/calculate-shipping', data)
export const checkout = (data) => request('POST', '/orders/checkout', data)
export const cancelPendingOrder = (token) => request('POST', '/orders/cancel-pending', { token })
export const getOrderBySession = (sessionId) => request('GET', `/orders/by-session/${sessionId}`)

// --- Analytics ---
export const trackPageView = (data) => request('POST', '/analytics/page-view', data)

// --- Customer Auth ---
export const customerRegister = (data) => request('POST', '/auth/register', data)
export const resendVerification = (email) => request('POST', '/auth/resend-verification', { email })
export const customerLogin = (data) => request('POST', '/auth/login', data)
export const verifyEmail = (token) => request('GET', `/auth/verify-email?token=${encodeURIComponent(token)}`)
export const forgotPassword = (email) => request('POST', '/auth/forgot-password', { email })
export const resetPassword = (token, password) => request('POST', '/auth/reset-password', { token, password })

// --- Customer Cart (server-side) ---
export const getServerCart = () => request('GET', '/auth/cart')
export const syncServerCart = (items) => request('POST', '/auth/cart/sync', { items })
export const replaceServerCart = (items) => request('POST', '/auth/cart/sync', { items, replace: true })
export const clearServerCart = () => request('DELETE', '/auth/cart')

// --- Customer Favorites (server-side) ---
export const getServerFavorites = () => request('GET', '/auth/favorites')
export const syncServerFavorites = (items) => request('POST', '/auth/favorites/sync', { items })
export const addServerFavorite = (productId, productVariantId = null) => request('POST', `/auth/favorites/${productId}`, { productVariantId })
export const removeServerFavorite = (productId, productVariantId = null) => {
  const qs = productVariantId ? `?productVariantId=${encodeURIComponent(productVariantId)}` : ''
  return request('DELETE', `/auth/favorites/${productId}${qs}`)
}

// --- Customer Profile ---
export const getCustomerProfile = () => request('GET', '/auth/me')
export const getCustomerOrders = () => request('GET', '/auth/orders')
export const requestDeleteCustomerAccount = (password) => request('POST', '/auth/me/delete-request', { password })
export const confirmDeleteCustomerAccount = (token) => request('POST', '/auth/delete-account/confirm', { token })
export const customerLogout = () => request('POST', '/auth/logout')

export async function downloadInvoice(orderId) {
  const res = await fetch(`${BASE_URL}/auth/orders/${orderId}/invoice`, {
    headers: apiHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  a.download = match ? match[1] : `facture-${orderId}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --- Admin Auth ---
export const adminLogin = (credentials) => request('POST', '/admin/auth/login', credentials)
export const adminRegister = (data) => request('POST', '/admin/auth/register', data)
export const adminLogout = () => request('POST', '/admin/auth/logout')

// --- Admin Products ---
export const adminGetProducts = () => request('GET', '/admin/products')
export const adminCreateProduct = (data) => request('POST', '/admin/products', data)
export const adminUpdateProduct = (id, data) => request('PUT', `/admin/products/${id}`, data)
export const adminDeleteProduct = (id) => request('DELETE', `/admin/products/${id}`)
export const adminUpdateStock = (id, stock) => request('PATCH', `/admin/products/${id}/stock`, { stock })

export async function adminUploadImage(id, formData) {
  const res = await fetch(`${BASE_URL}/admin/products/${id}/upload-image`, {
    method: 'POST',
    headers: apiHeaders(),
    body: formData,
    credentials: 'include',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  return json
}

// --- Admin Categories ---
export const adminGetCategories = () => request('GET', '/admin/categories')
export const adminCreateCategory = (data) => request('POST', '/admin/categories', data)
export const adminUpdateCategory = (id, data) => request('PUT', `/admin/categories/${id}`, data)
export const adminDeleteCategory = (id) => request('DELETE', `/admin/categories/${id}`)

// --- Admin Custom Orders ---
export const adminGetCustomOrders = () => request('GET', '/admin/custom-orders')
export const adminGetCustomOrder = (id) => request('GET', `/admin/custom-orders/${id}`)
export const adminUpdateOrderStatus = (id, status) => request('PATCH', `/admin/custom-orders/${id}/status`, { status })
export const adminSendCustomOrderEmail = (id, { subject, body }) => request('POST', `/admin/custom-orders/${id}/send-email`, { subject, body })

// --- Admin Personalized Quotes ---
export const adminGetPersonalizedQuotes = () => request('GET', '/admin/personalized-quotes')
export const adminGetPersonalizedQuote = (id) => request('GET', `/admin/personalized-quotes/${id}`)
export const adminUpdatePersonalizedQuoteStatus = (id, status) => request('PATCH', `/admin/personalized-quotes/${id}/status`, { status })
export const adminSendPersonalizedQuoteEmail = (id, { subject, body }) => request('POST', `/admin/personalized-quotes/${id}/send-email`, { subject, body })
