const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL || 'http://localhost:3002';

function normalizeApiBaseUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL;
  if (explicitUrl) return explicitUrl.replace(/\/$/, '');

  try {
    return new URL('/api', ADMIN_URL).toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:3001/api';
  }
}

const API_BASE_URL = normalizeApiBaseUrl();

function currentLanguage() {
  const locale =
    globalThis?.navigator?.language
    || Intl.DateTimeFormat?.().resolvedOptions?.().locale
    || 'fr';
  return String(locale).toLowerCase().startsWith('en') ? 'en' : 'fr';
}

async function request(path, { method = 'GET', body, token } = {}) {
  let response;
  const lang = currentLanguage();
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': lang,
        'X-Language': lang,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`API inaccessible (${API_BASE_URL}). Vérifie que l'admin mobile roule sur ton Mac. Détail: ${err.message}`);
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message || json.error || `HTTP ${response.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

export { API_BASE_URL };

export const adminApi = {
  login: (credentials) => request('/admin/auth/login', { method: 'POST', body: credentials }),
  me: (token) => request('/admin/auth/me', { token }),
  products: (token) => request('/admin/products', { token }),
  orders: (token) => request('/admin/orders', { token }),
  customOrders: (token) => request('/admin/custom-orders', { token }),
  personalizedQuotes: (token) => request('/admin/personalized-quotes', { token }),
  analyticsOverview: (token) => request('/analytics/admin/overview?days=14', { token }),
  updateStock: (token, id, stock) =>
    request(`/admin/products/${id}/stock`, { method: 'PATCH', token, body: { stock } }),
  updateOrderStatus: (token, id, status) =>
    request(`/admin/orders/${id}/status`, { method: 'PATCH', token, body: { status } }),
  sendOrderEmail: (token, id, data) =>
    request(`/admin/orders/${id}/send-email`, { method: 'POST', token, body: data }),
  updateCustomOrderStatus: (token, id, status) =>
    request(`/admin/custom-orders/${id}/status`, { method: 'PATCH', token, body: { status } }),
  sendCustomOrderEmail: (token, id, data) =>
    request(`/admin/custom-orders/${id}/send-email`, { method: 'POST', token, body: data }),
  setCustomOrderPrice: (token, id, price) =>
    request(`/admin/custom-orders/${id}/price`, { method: 'PATCH', token, body: { price } }),
  sendCustomPaymentLink: (token, id) =>
    request(`/admin/custom-orders/${id}/send-payment-link`, { method: 'POST', token }),
  updatePersonalizedQuoteStatus: (token, id, status) =>
    request(`/admin/personalized-quotes/${id}/status`, { method: 'PATCH', token, body: { status } }),
  sendPersonalizedQuoteEmail: (token, id, data) =>
    request(`/admin/personalized-quotes/${id}/send-email`, { method: 'POST', token, body: data }),
  setPersonalizedQuotePrice: (token, id, price) =>
    request(`/admin/personalized-quotes/${id}/price`, { method: 'PATCH', token, body: { price } }),
  sendPersonalizedQuotePaymentLink: (token, id) =>
    request(`/admin/personalized-quotes/${id}/send-payment-link`, { method: 'POST', token }),
  marketSale: (token, id, data) =>
    request(`/admin/products/${id}/market-sale`, { method: 'POST', token, body: data }),
  paymentLink: (token, id, data) =>
    request(`/admin/products/${id}/payment-link`, { method: 'POST', token, body: data }),
  tapToPayIntent: (token, id, data) =>
    request(`/admin/products/${id}/tap-to-pay-intent`, { method: 'POST', token, body: data }),
  marketCartTapToPayIntent: (token, data) =>
    request('/admin/products/market-cart/tap-to-pay-intent', { method: 'POST', token, body: data }),
  customTapToPayIntent: (token, id, data) =>
    request(`/admin/custom-orders/${id}/tap-to-pay-intent`, { method: 'POST', token, body: data }),
  yarnTapToPayIntent: (token, id, data) =>
    request(`/admin/yarn/${id}/tap-to-pay-intent`, { method: 'POST', token, body: data }),
  syncTapToPay: (token, paymentIntentId) =>
    request(`/admin/products/terminal/payment-intents/${paymentIntentId}/sync`, { method: 'POST', token }),
  syncYarnTapToPay: (token, paymentIntentId) =>
    request(`/admin/yarn/terminal/payment-intents/${paymentIntentId}/sync`, { method: 'POST', token }),
  syncCustomTapToPay: (token, paymentIntentId) =>
    request(`/admin/custom-orders/terminal/payment-intents/${paymentIntentId}/sync`, { method: 'POST', token }),
  cancelTapToPay: (token, paymentIntentId) =>
    request(`/admin/products/terminal/payment-intents/${paymentIntentId}/cancel`, { method: 'POST', token }),
  cancelYarnTapToPay: (token, paymentIntentId) =>
    request(`/admin/yarn/terminal/payment-intents/${paymentIntentId}/cancel`, { method: 'POST', token }),
  cancelCustomTapToPay: (token, paymentIntentId) =>
    request(`/admin/custom-orders/terminal/payment-intents/${paymentIntentId}/cancel`, { method: 'POST', token }),
  terminalConnectionToken: (token) =>
    request('/admin/products/terminal/connection-token', { method: 'POST', token }),
  terminalConfig: (token) => request('/admin/products/terminal/config', { token }),
  registerPushToken: (token, data) =>
    request('/admin/push-notifications/register', { method: 'POST', token, body: data }),
  unregisterPushToken: (token, data) =>
    request('/admin/push-notifications/unregister', { method: 'POST', token, body: data }),
  sendTestPush: (token) =>
    request('/admin/push-notifications/test', { method: 'POST', token }),
};
