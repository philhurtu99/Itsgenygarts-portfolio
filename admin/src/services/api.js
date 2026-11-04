function defaultApiBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    if (window.location.hostname.startsWith("admin.")) {
      return `${window.location.protocol}//api.${window.location.hostname.replace(/^admin\./, "")}/api`;
    }
    return `${window.location.origin}/api`;
  }
  return "http://localhost:3001/api";
}

const BASE_URL = import.meta.env.VITE_API_URL || defaultApiBaseUrl();
const ADMIN_TOKEN_KEY = "itsgenygarts_admin_token";
const REQUEST_TIMEOUT_MS = 15000;
const SERVER_STATUS_EVENT = "itsgenygarts:server-status";

function emitServerStatus(status, message = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT, {
    detail: { status, message, at: Date.now() },
  }));
}

function serverOfflineError(message) {
  emitServerStatus("offline", message);
  const error = new Error(message);
  error.code = "SERVER_OFFLINE";
  error.isNetworkError = true;
  return error;
}

export function isServerOfflineError(error) {
  return error?.isNetworkError || error?.code === "SERVER_OFFLINE";
}

export function getAdminAuthToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminAuthToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // localStorage can be unavailable in private/embedded contexts.
  }
}

export function clearAdminAuthToken() {
  setAdminAuthToken(null);
}

export function getApiBaseUrl() {
  return BASE_URL;
}

function currentLanguage() {
  return localStorage.getItem("lang") || navigator.language?.slice(0, 2) || "fr";
}

function apiHeaders(extra = {}) {
  const token = getAdminAuthToken();
  return {
    "X-Language": currentLanguage(),
    "Accept-Language": currentLanguage(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(method, path, data = null) {
  const headers = apiHeaders({ "Content-Type": "application/json" });
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const options = { method, headers, credentials: "include", signal: controller.signal };
  if (data) options.body = JSON.stringify(data);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, options);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw serverOfflineError("Serveur offline. Vérifie que l'API roule et que le téléphone est sur le même réseau.");
    }
    throw serverOfflineError(err?.message || "Connexion au serveur impossible.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  emitServerStatus("online");
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

async function uploadForm(method, path, formData) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: apiHeaders(),
      body: formData,
      credentials: "include",
    });
  } catch (err) {
    throw serverOfflineError(err?.message || "Connexion au serveur impossible.");
  }
  emitServerStatus("online");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data !== undefined ? json.data : json;
}

// --- Admin Auth ---
export const adminLogin = (credentials) => request("POST", "/admin/auth/login", credentials);
export const adminMe = () => request("GET", "/admin/auth/me");
export const adminCreateSessionToken = () => request("POST", "/admin/auth/session-token");
export const adminLogout = () => request("POST", "/admin/auth/logout");

// --- Admin Products ---
export const adminGetProducts = () => request("GET", "/admin/products");
export const adminReorderImages = (id, imageIds) => request("PATCH", `/admin/products/${id}/images/order`, { imageIds });
export const adminCreateProduct = (data) => request("POST", "/admin/products", data);
export const adminPatchProduct = (id, data) => request("PATCH", `/admin/products/${id}`, data);
export const adminUpdateProduct = (id, data) => request("PUT", `/admin/products/${id}`, data);
export const adminDeleteProduct = (id) => request("DELETE", `/admin/products/${id}`);
export const adminUpdateStock = (id, stock) => request("PATCH", `/admin/products/${id}/stock`, { stock });
export const adminCreateMarketSale = (id, data) => request("POST", `/admin/products/${id}/market-sale`, data);
export const adminCreateMarketBundleSale = (data) => request("POST", "/admin/products/market-bundle-sale", data);
export const adminCreateMarketCartTapToPayIntent = (data) => request("POST", "/admin/products/market-cart/tap-to-pay-intent", data);
export const adminCreateMarketCartPaymentLink = (data) => request("POST", "/admin/products/market-cart/payment-link", data);
export const adminCreateMarketCartPaymentQr = (data) => request("POST", "/admin/products/market-cart/payment-qr", data);
export const adminCreateProductPaymentLink = (id, data) => request("POST", `/admin/products/${id}/payment-link`, data);
export const adminCreateTapToPayIntent = (id, data) => request("POST", `/admin/products/${id}/tap-to-pay-intent`, data);
export const adminSyncTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/products/terminal/payment-intents/${paymentIntentId}/sync`);
export const adminCancelTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/products/terminal/payment-intents/${paymentIntentId}/cancel`);
export const adminCreateTerminalConnectionToken = () => request("POST", "/admin/products/terminal/connection-token");

export const adminUploadImage = (id, formData) => uploadForm("POST", `/admin/products/${id}/upload-image`, formData);
export const adminDeleteImage = (productId, imageId) => request("DELETE", `/admin/products/${productId}/images/${imageId}`);

// --- Admin Yarn ---
export const adminGetYarnProducts = () => request("GET", "/admin/yarn");
export const adminCreateYarnProduct = (data) => request("POST", "/admin/yarn", data);
export const adminUpdateYarnProduct = (id, data) => request("PUT", `/admin/yarn/${id}`, data);
export const adminDeleteYarnProduct = (id) => request("DELETE", `/admin/yarn/${id}`);
export const adminCreateYarnMarketSale = (id, data) => request("POST", `/admin/yarn/${id}/market-sale`, data);
export const adminCreateYarnPaymentLink = (id, data) => request("POST", `/admin/yarn/${id}/payment-link`, data);
export const adminCreateYarnTapToPayIntent = (id, data) => request("POST", `/admin/yarn/${id}/tap-to-pay-intent`, data);
export const adminSyncYarnTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/yarn/terminal/payment-intents/${paymentIntentId}/sync`);
export const adminCancelYarnTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/yarn/terminal/payment-intents/${paymentIntentId}/cancel`);
export const adminUploadYarnImage = (id, formData) => uploadForm("POST", `/admin/yarn/${id}/upload-image`, formData);
export const adminDeleteYarnImage = (yarnProductId, imageId) => request("DELETE", `/admin/yarn/${yarnProductId}/images/${imageId}`);
export const adminGetYarnCategories = () => request("GET", "/admin/yarn/categories/all");
export const adminCreateYarnCategory = (data) => request("POST", "/admin/yarn/categories", data);
export const adminUpdateYarnCategory = (id, data) => request("PUT", `/admin/yarn/categories/${id}`, data);
export const adminDeleteYarnCategory = (id) => request("DELETE", `/admin/yarn/categories/${id}`);

// --- Admin Categories ---
export const adminGetCategories = () => request("GET", "/admin/categories");
export const adminCreateCategory = (data) => request("POST", "/admin/categories", data);
export const adminUpdateCategory = (id, data) => request("PUT", `/admin/categories/${id}`, data);
export const adminDeleteCategory = (id) => request("DELETE", `/admin/categories/${id}`);
export const getCategories = () => request("GET", "/categories");

// --- Admin Custom Orders ---
export const adminGetCustomOrders = ({ limit } = {}) =>
  request("GET", `/admin/custom-orders${limit ? `?limit=${encodeURIComponent(limit)}` : ""}`);
export const adminGetCustomOrder = (id) => request("GET", `/admin/custom-orders/${id}`);
export const adminCreateMarketCustomOrder = (formData) => uploadForm("POST", "/admin/custom-orders/market", formData);
export const adminUploadCustomOrderFinalImage = (id, file) => {
  const formData = new FormData();
  formData.append("image", file);
  return uploadForm("POST", `/admin/custom-orders/${id}/final-product-image`, formData);
};
export const adminRecordCustomOrderPayment = (id, data) => request("POST", `/admin/custom-orders/${id}/market-payment`, data);
export const adminCreateCustomTapToPayIntent = (id, data) => request("POST", `/admin/custom-orders/${id}/tap-to-pay-intent`, data);
export const adminSyncCustomTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/custom-orders/terminal/payment-intents/${paymentIntentId}/sync`);
export const adminCancelCustomTapToPayPayment = (paymentIntentId) =>
  request("POST", `/admin/custom-orders/terminal/payment-intents/${paymentIntentId}/cancel`);
export const adminUpdateOrderStatus = (id, status) => request("PATCH", `/admin/custom-orders/${id}/status`, { status });
export const adminSendCustomOrderEmail = (id, { subject, body, price }) =>
  request("POST", `/admin/custom-orders/${id}/send-email`, { subject, body, price });
export const adminSetCustomOrderPrice = (id, price) => request("PATCH", `/admin/custom-orders/${id}/price`, { price });
export const adminSendCustomOrderPaymentLink = (id, data = {}) => request("POST", `/admin/custom-orders/${id}/send-payment-link`, data);

// --- Admin Personalized Quotes ---
export const adminGetPersonalizedQuotes = () => request("GET", "/admin/personalized-quotes");
export const adminGetPersonalizedQuote = (id) => request("GET", `/admin/personalized-quotes/${id}`);
export const adminUpdatePersonalizedQuoteStatus = (id, status) =>
  request("PATCH", `/admin/personalized-quotes/${id}/status`, { status });
export const adminSendPersonalizedQuoteEmail = (id, { subject, body, price }) =>
  request("POST", `/admin/personalized-quotes/${id}/send-email`, { subject, body, price });
export const adminSetPersonalizedQuotePrice = (id, price) =>
  request("PATCH", `/admin/personalized-quotes/${id}/price`, { price });
export const adminSendPersonalizedQuotePaymentLink = (id) =>
  request("POST", `/admin/personalized-quotes/${id}/send-payment-link`);

// --- Admin Product References ---
export const adminGetProductReferences = (category) =>
  request("GET", `/admin/product-references${category ? `?category=${encodeURIComponent(category)}` : ""}`);
export const adminCreateProductReference = (formData) => uploadForm("POST", "/admin/product-references", formData);
export const adminUpdateProductReference = (id, formData) => uploadForm("PUT", `/admin/product-references/${id}`, formData);
export const adminDeleteProductReference = (id) => request("DELETE", `/admin/product-references/${id}`);
export const adminGetExistingImages = () => request("GET", "/admin/product-references/existing-images");

// --- Admin Custom Order Categories ---
export const adminGetCustomOrderCategories = () => request("GET", "/admin/custom-order-categories");
export const adminCreateCustomOrderCategory = (data) => request("POST", "/admin/custom-order-categories", data);
export const adminUpdateCustomOrderCategory = (id, data) => request("PUT", `/admin/custom-order-categories/${id}`, data);
export const adminDeleteCustomOrderCategory = (id) => request("DELETE", `/admin/custom-order-categories/${id}`);

// --- Admin Quotes ---
export const adminGetQuotes = () => request("GET", "/admin/quotes");
export const adminGetQuote = (id) => request("GET", `/admin/quotes/${id}`);
export const adminUpdateQuoteStatus = (id, status) => request("PATCH", `/admin/quotes/${id}/status`, { status });

// --- Admin Shipping Zones ---
export const adminGetShippingZones = () => request("GET", "/admin/shipping-zones");
export const adminGetCustomsProfiles = () => request("GET", "/admin/customs-profiles");
export const adminCreateShippingZone = (data) => request("POST", "/admin/shipping-zones", data);
export const adminUpdateShippingZone = (id, data) => request("PUT", `/admin/shipping-zones/${id}`, data);
export const adminDeleteShippingZone = (id) => request("DELETE", `/admin/shipping-zones/${id}`);

// --- Admin Currencies ---
export const adminGetCurrencies = () => request("GET", "/admin/currencies");
export const adminCreateCurrency = (data) => request("POST", "/admin/currencies", data);
export const adminUpdateCurrency = (id, data) => request("PUT", `/admin/currencies/${id}`, data);
export const adminDeleteCurrency = (id) => request("DELETE", `/admin/currencies/${id}`);

// --- Admin Product Shipping Rates ---
export const adminGetProductShippingRates = (productId) => request("GET", `/admin/product-shipping-rates/${productId}`);
export const adminSetProductShippingRates = (productId, rates) =>
  request("PUT", `/admin/product-shipping-rates/${productId}`, { rates });

// --- Admin Orders ---
export const adminGetOrders = () => request("GET", "/admin/orders");
export const adminGetOrder = (id) => request("GET", `/admin/orders/${id}`);
export const adminUpdateRegularOrderStatus = (id, status, trackingNumber) => request("PATCH", `/admin/orders/${id}/status`, {
  status,
  ...(trackingNumber ? { trackingNumber } : {}),
});
export const adminSendRegularOrderEmail = (id, { subject, body }) =>
  request("POST", `/admin/orders/${id}/send-email`, { subject, body });
export const adminCreateShippingLabel = (id) => request("POST", `/admin/orders/${id}/shipping-label`);
async function adminDownloadOrderDocument(path, fallbackFilename) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: apiHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackFilename;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export const adminDownloadShippingLabel = (id) => adminDownloadOrderDocument(
  `/admin/orders/${id}/shipping-label/pdf`,
  `etiquette-shippo-${id}.pdf`,
);
export const adminDownloadCommercialInvoice = (id) => adminDownloadOrderDocument(
  `/admin/orders/${id}/shipping-label/commercial-invoice/pdf`,
  `facture-commerciale-${id}.pdf`,
);
export const adminReconcileShippingLabel = (id, transactionId) => request(
  'POST', `/admin/orders/${id}/shipping-label/reconcile`, { transactionId },
);

// --- Admin Newsletter ---
export const adminGetNewsletterStats = () => request("GET", "/admin/newsletter/subscribers");
export const adminSendNewsletter = (data) => request("POST", "/admin/newsletter/send", data);

// --- Admin Search ---
export const adminSearchDatabase = ({ query = "", limit = 25 } = {}) =>
  request("GET", `/admin/search?${new URLSearchParams({ q: query, limit: String(limit) }).toString()}`);

export const adminAdvancedSearchDatabase = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return request("GET", `/admin/search?${search.toString()}`);
};
export const adminGetCustomerProfile = (id) => request("GET", `/admin/customers/${id}`);
export const adminGetTimeline = (type, id) => request("GET", `/admin/operations/timeline/${type}/${id}`);
export const adminGetNotes = (entityType, entityId) => request("GET", `/admin/notes/${entityType}/${entityId}`);
export const adminCreateNote = (entityType, entityId, body) => request("POST", `/admin/notes/${entityType}/${entityId}`, { body });

// --- Admin Analytics ---
export const adminGetAnalyticsOverview = (days = 14) => request("GET", `/analytics/admin/overview?days=${encodeURIComponent(days)}`);

// --- Admin Push Notifications ---
export const adminSendTestPushNotification = () => request("POST", "/admin/push-notifications/test");
