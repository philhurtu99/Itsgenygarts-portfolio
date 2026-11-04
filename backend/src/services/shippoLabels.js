import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';
import { refreshShippoRateForOrder, shippoRatesConfigured } from './shipping.js';

const SHIPPO_API = 'https://api.goshippo.com';

function providerError(message, statusCode = 502) {
  return Object.assign(new Error(message), { statusCode });
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function shippoMessage(body, fallback) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const message = messages
    .map((entry) => entry?.text || entry?.message || entry?.code)
    .find((value) => typeof value === 'string' && value.trim());
  return body?.detail || body?.message || body?.error || message || fallback;
}

function shippoTransactionError(transaction) {
  const message = shippoMessage(transaction, 'création de l’étiquette impossible');
  if (/valid payment method|payment method.*(?:file|billing)/i.test(String(message))) {
    return providerError(
      'Ajoute un moyen de paiement valide dans la section Facturation de Shippo, puis réessaie l’achat de l’étiquette.',
      402,
    );
  }
  return providerError(`Shippo: ${message}`);
}

async function shippoJson(path, options = {}, { purchase = false } = {}) {
  let response;
  try {
    response = await fetch(`${SHIPPO_API}${path}`, {
      ...options,
      headers: {
        Authorization: `ShippoToken ${envValue('SHIPPO_API_TOKEN')}`,
        'Content-Type': 'application/json',
        'SHIPPO-API-VERSION': '2018-02-08',
        ...options.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw Object.assign(providerError(purchase
      ? 'La réponse de Shippo est incertaine. Vérifie l’achat existant avant toute nouvelle tentative.'
      : 'Shippo ne répond pas. Réessaie dans quelques instants.'), { purchaseOutcomeUnknown: purchase });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw Object.assign(providerError('La réponse de Shippo est illisible. Vérifie l’achat existant.'), { purchaseOutcomeUnknown: purchase });
  }
  if (!response.ok) {
    throw Object.assign(providerError(`Shippo: ${shippoMessage(body, `erreur HTTP ${response.status}`)}`), {
      purchaseOutcomeUnknown: purchase && (response.status >= 500 || response.status === 408),
    });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(providerError('La réponse de Shippo est incomplète. Vérifie l’achat existant.'), { purchaseOutcomeUnknown: purchase });
  }
  return body;
}

function shipmentFromTransaction(transaction) {
  if (transaction.status === 'ERROR') {
    throw Object.assign(shippoTransactionError(transaction), { purchaseRejected: true });
  }
  const transactionId = String(transaction.object_id || '').trim();
  const trackingNumber = String(transaction.tracking_number || '').trim();
  if (transaction.status !== 'SUCCESS' || !transactionId || !trackingNumber || !transaction.label_url) {
    throw Object.assign(providerError('L’étiquette est en attente ou son résultat est incertain. Vérifie l’achat existant.', 409), {
      purchaseOutcomeUnknown: true,
    });
  }
  return {
    transactionId,
    trackingNumber,
    trackingUrl: String(transaction.tracking_url_provider || '').trim() || null,
    created: true,
  };
}

export async function reconcileShippoShipment(order, transactionId = order.shippingTransactionId) {
  if (!shippoRatesConfigured()) throw providerError('Shippo n’est pas configuré sur le serveur.', 503);
  const id = String(transactionId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw providerError('Référence de transaction Shippo invalide.', 400);
  const transaction = await shippoJson(`/transactions/${id}`);
  const rateId = typeof transaction.rate === 'string' ? transaction.rate : transaction.rate?.object_id;
  if (transaction.object_id !== id || transaction.metadata !== `Itsgenygarts order ${order.id}`
    || !order.shippingRateId || rateId !== order.shippingRateId
    || transaction.test !== envValue('SHIPPO_API_TOKEN').startsWith('shippo_test_')) {
    throw providerError('Cette transaction Shippo ne correspond pas à cette commande.', 409);
  }
  return shipmentFromTransaction(transaction);
}

export async function createShippoShipment(order, { onRate, onTransaction } = {}) {
  if (!order.shippingTransactionId) assertShippingDestinationAllowed(order.customerCountry);
  if (!shippoRatesConfigured()) {
    throw providerError('Shippo n’est pas configuré sur le serveur.', 503);
  }
  if (order.shippingTransactionId) {
    if (!order.shippingLabelCreatedAt) return reconcileShippoShipment(order);
    return {
      transactionId: order.shippingTransactionId,
      trackingNumber: order.shippingTrackingNumber,
      trackingUrl: order.shippingTrackingUrl,
      created: false,
    };
  }

  const orderAge = Date.now() - new Date(order.createdAt || 0).getTime();
  const storedRateIsFresh = order.shippingRateId
    && Number.isFinite(orderAge)
    && orderAge >= 0
    && orderAge < 6 * 24 * 60 * 60 * 1000;
  const rateId = storedRateIsFresh
    ? order.shippingRateId
    : (await refreshShippoRateForOrder(order)).rateId;
  if (onRate) await onRate(rateId);
  const transaction = await shippoJson('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      rate: rateId,
      async: false,
      label_file_type: 'PDF_4x6',
      metadata: `Itsgenygarts order ${order.id}`,
    }),
  }, { purchase: true });
  if (transaction.object_id && onTransaction) {
    try {
      await onTransaction(String(transaction.object_id));
    } catch (err) {
      throw Object.assign(err, { purchaseOutcomeUnknown: true });
    }
  }
  return shipmentFromTransaction(transaction);
}

function validShippoDocumentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (
        url.hostname === 'deliver.goshippo.com'
        || /^shippo-delivery(?:-[a-z0-9-]+)?\.s3(?:\.[a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)
      );
  } catch {
    return false;
  }
}

export async function downloadShippoLabel(transactionId) {
  if (!shippoRatesConfigured()) {
    throw providerError('Shippo n’est pas configuré sur le serveur.', 503);
  }
  const safeTransactionId = String(transactionId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(safeTransactionId)) {
    throw providerError('Référence d’étiquette Shippo invalide.', 400);
  }

  const transaction = await shippoJson(`/transactions/${safeTransactionId}`);
  if (transaction.status !== 'SUCCESS' || !validShippoDocumentUrl(transaction.label_url)) {
    throw providerError('L’étiquette Shippo n’est pas disponible.', 409);
  }

  let response;
  try {
    response = await fetch(transaction.label_url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw providerError('Le PDF de l’étiquette Shippo est temporairement indisponible.');
  }
  if (!response.ok) {
    throw providerError(`Le PDF de l’étiquette Shippo est indisponible (HTTP ${response.status}).`);
  }
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/pdf',
  };
}

export async function downloadShippoCommercialInvoice(transactionId) {
  if (!shippoRatesConfigured()) {
    throw providerError('Shippo n’est pas configuré sur le serveur.', 503);
  }
  const safeTransactionId = String(transactionId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(safeTransactionId)) {
    throw providerError('Référence d’étiquette Shippo invalide.', 400);
  }

  const transaction = await shippoJson(`/transactions/${safeTransactionId}`);
  if (transaction.status !== 'SUCCESS' || !validShippoDocumentUrl(transaction.commercial_invoice_url)) {
    throw providerError('La facture commerciale Shippo n’est pas disponible pour cet envoi.', 409);
  }

  let response;
  try {
    response = await fetch(transaction.commercial_invoice_url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw providerError('Le PDF de la facture commerciale est temporairement indisponible.');
  }
  if (!response.ok) {
    throw providerError(`Le PDF de la facture commerciale est indisponible (HTTP ${response.status}).`);
  }
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/pdf',
  };
}
