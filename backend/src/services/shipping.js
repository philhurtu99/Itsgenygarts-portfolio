import { getCustomsProfile } from '../utils/customsProfiles.js';
import { assertShippingDestinationAllowed } from '../utils/shippingDestination.js';

const SHIPPO_API = 'https://api.goshippo.com';
const DEFAULT_RATE_CACHE_MINUTES = 60;
const DEFAULT_RATE_CACHE_MAX_ENTRIES = 500;
const DEFAULT_RATE_DAILY_LIMIT = 100;

let cachedShippoCarrierAccounts = null;
let cachedShippoCarrierAccountsToken = null;
let pendingShippoCarrierAccounts = null;
let pendingShippoCarrierAccountsToken = null;
const shippoRateCache = new Map();
const pendingShippoRateRequests = new Map();
let shippoRateUsage = { day: null, count: 0 };

function shippingError(message, statusCode = 400) {
  return Object.assign(new Error(message), {
    statusCode,
    ...(statusCode >= 500 ? {
      publicMessage: 'Le calcul des frais de livraison est indisponible pour le moment. Veuillez réessayer plus tard ou nous contacter.',
    } : {}),
  });
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizedCountry(value) {
  return String(value || '').trim().toUpperCase();
}

export function normalizePostalCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function boundedPositiveInteger(name, fallback, maximum) {
  const parsed = Math.floor(Number(process.env[name]));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function rateCacheTtlMs() {
  return boundedPositiveInteger('SHIPPO_RATE_CACHE_MINUTES', DEFAULT_RATE_CACHE_MINUTES, 24 * 60) * 60 * 1000;
}

function rateCacheMaxEntries() {
  return boundedPositiveInteger('SHIPPO_RATE_CACHE_MAX_ENTRIES', DEFAULT_RATE_CACHE_MAX_ENTRIES, 5_000);
}

function rateDailyLimit() {
  return boundedPositiveInteger('SHIPPO_RATE_DAILY_LIMIT', DEFAULT_RATE_DAILY_LIMIT, 10_000);
}

function reserveShippoRateRequest() {
  const day = new Date().toISOString().slice(0, 10);
  if (shippoRateUsage.day !== day) shippoRateUsage = { day, count: 0 };
  if (shippoRateUsage.count >= rateDailyLimit()) {
    throw shippingError('Les tarifs de livraison sont temporairement indisponibles. Réessaie demain.', 503);
  }
  shippoRateUsage.count += 1;
}

function normalizedCacheText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function rateCacheKey(packageInfo, destination, carrierAccountIds, handlingFee) {
  const origin = shippoOrigin();
  return JSON.stringify({
    origin: {
      name: normalizedCacheText(origin.name),
      company: normalizedCacheText(origin.company),
      street1: normalizedCacheText(origin.street1),
      city: normalizedCacheText(origin.city),
      state: normalizedCacheText(origin.state).toUpperCase(),
      country: normalizedCountry(origin.country),
      zip: normalizePostalCode(origin.zip),
      phone: normalizedCacheText(origin.phone),
      email: normalizedCacheText(origin.email).toLowerCase(),
    },
    destination: {
      name: normalizedCacheText(destination.name || 'Client'),
      address: normalizedCacheText(destination.address),
      city: normalizedCacheText(destination.city),
      province: normalizedCacheText(destination.province).toUpperCase(),
      country: normalizedCountry(destination.country),
      postalCode: normalizePostalCode(destination.postalCode),
      phone: normalizedCacheText(destination.phone),
      email: normalizedCacheText(destination.email).toLowerCase(),
    },
    packageInfo,
    carrierAccountIds: [...carrierAccountIds].sort(),
    handlingFee: roundMoney(handlingFee),
  });
}

function cachedRates(key) {
  const entry = shippoRateCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    shippoRateCache.delete(key);
    return null;
  }
  shippoRateCache.delete(key);
  shippoRateCache.set(key, entry);
  return entry.rates;
}

function storeCachedRates(key, rates) {
  const now = Date.now();
  for (const [candidateKey, entry] of shippoRateCache) {
    if (entry.expiresAt <= now) shippoRateCache.delete(candidateKey);
  }
  while (shippoRateCache.size >= rateCacheMaxEntries()) {
    shippoRateCache.delete(shippoRateCache.keys().next().value);
  }
  shippoRateCache.set(key, { rates, expiresAt: now + rateCacheTtlMs() });
}

function shippoOrigin() {
  return {
    name: envValue('SHIPPING_ORIGIN_NAME') || envValue('BUSINESS_NAME') || 'Itsgenygarts',
    company: envValue('SHIPPING_ORIGIN_COMPANY') || envValue('BUSINESS_NAME') || 'Itsgenygarts',
    street1: envValue('SHIPPING_ORIGIN_ADDRESS'),
    city: envValue('SHIPPING_ORIGIN_CITY'),
    state: envValue('SHIPPING_ORIGIN_PROVINCE').toUpperCase(),
    country: normalizedCountry(envValue('SHIPPING_ORIGIN_COUNTRY') || 'CA'),
    zip: normalizePostalCode(envValue('SHIPPING_ORIGIN_POSTAL_CODE')),
    phone: envValue('SHIPPING_ORIGIN_PHONE') || envValue('BUSINESS_PHONE'),
    email: envValue('SHIPPING_ORIGIN_EMAIL') || envValue('BUSINESS_EMAIL'),
  };
}

function configuredShippoCarrierAccountIds() {
  return envValue('SHIPPO_CARRIER_ACCOUNT_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function shippoCarrierAccountIds() {
  const configuredIds = configuredShippoCarrierAccountIds();
  if (configuredIds.length > 0) return configuredIds;

  const token = envValue('SHIPPO_API_TOKEN');
  if (cachedShippoCarrierAccountsToken === token && cachedShippoCarrierAccounts) {
    return cachedShippoCarrierAccounts;
  }

  if (pendingShippoCarrierAccountsToken === token && pendingShippoCarrierAccounts) {
    return pendingShippoCarrierAccounts;
  }

  pendingShippoCarrierAccountsToken = token;
  pendingShippoCarrierAccounts = (async () => {
    let response;
    try {
      response = await fetch(`${SHIPPO_API}/carrier_accounts/?results=100`, {
        headers: { Authorization: `ShippoToken ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw shippingError('Shippo ne peut pas charger les transporteurs pour le moment.', 502);
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw shippingError(`Shippo: ${shippoErrorMessage(body, 'chargement des transporteurs impossible')}`, 502);
    }

    const accounts = Array.isArray(body?.results) ? body.results : Array.isArray(body) ? body : [];
    const carrier = (envValue('SHIPPO_CARRIER') || 'ups').toLowerCase();
    const country = shippoOrigin().country;
    const activeCarrierAccounts = accounts.filter((account) => (
      account?.active !== false && String(account?.carrier || '').toLowerCase() === carrier
    ));
    const countryAccounts = activeCarrierAccounts.filter(
      (account) => String(account?.metadata || '').trim().toUpperCase() === country,
    );
    const selectedAccounts = countryAccounts.length > 0
      ? countryAccounts
      : activeCarrierAccounts.filter((account) => !String(account?.metadata || '').trim());
    const ids = selectedAccounts.map((account) => String(account?.object_id || '').trim()).filter(Boolean);

    if (ids.length === 0) {
      throw shippingError(`Aucun compte ${carrier.toUpperCase()} actif pour le pays d’origine ${country} dans Shippo.`, 422);
    }

    cachedShippoCarrierAccountsToken = token;
    cachedShippoCarrierAccounts = ids;
    return ids;
  })();

  try {
    return await pendingShippoCarrierAccounts;
  } finally {
    if (pendingShippoCarrierAccountsToken === token) {
      pendingShippoCarrierAccounts = null;
      pendingShippoCarrierAccountsToken = null;
    }
  }
}

export function shippoRatesConfigured() {
  const token = envValue('SHIPPO_API_TOKEN');
  const origin = shippoOrigin();
  const testTokenBlocked = process.env.NODE_ENV === 'production'
    && token.startsWith('shippo_test_')
    && envValue('SHIPPO_ALLOW_TEST_RATES').toLowerCase() !== 'true';
  return Boolean(
    token
    && !testTokenBlocked
    && origin.street1
    && origin.city
    && origin.state
    && origin.country
    && origin.zip,
  );
}

export function buildShippingPackage(items, products) {
  const productMap = new Map(products.map((product) => [Number(product.id), product]));
  let weightGrams = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let combinedHeight = 0;

  for (const item of items) {
    const productId = Number(item.productId);
    const product = productMap.get(productId);
    if (!product) throw shippingError(`Produit introuvable (ID ${productId})`);

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const weight = positiveNumber(product.packageWeightGrams);
    const dimensions = [
      positiveNumber(product.packageLengthCm),
      positiveNumber(product.packageWidthCm),
      positiveNumber(product.packageHeightCm),
    ];
    if (!weight || dimensions.some((dimension) => !dimension)) {
      throw shippingError(`Les dimensions d'expédition sont manquantes pour « ${product.name} ».`, 409);
    }

    const [length, width, height] = dimensions.sort((a, b) => b - a);
    weightGrams += weight * quantity;
    maxLength = Math.max(maxLength, length);
    maxWidth = Math.max(maxWidth, width);
    combinedHeight += height * quantity;
  }

  if (weightGrams <= 0) throw shippingError('Le colis ne contient aucun article valide.');
  const [lengthCm, widthCm, heightCm] = [maxLength, maxWidth, combinedHeight].sort((a, b) => b - a);

  return {
    weightGrams: Math.round(weightGrams),
    weightKg: Math.round((weightGrams / 1000) * 1000) / 1000,
    lengthCm: Math.round(lengthCm * 10) / 10,
    widthCm: Math.round(widthCm * 10) / 10,
    heightCm: Math.round(heightCm * 10) / 10,
  };
}

export function buildCustomsDeclaration(items, products, destinationCountry) {
  const productMap = new Map(products.map((product) => [Number(product.id), product]));
  const signer = envValue('SHIPPING_CUSTOMS_SIGNER');
  if (!signer) {
    throw shippingError('Le signataire douanier Shippo n’est pas configuré sur le serveur.', 503);
  }
  const customsItems = items.map((item) => {
    const productId = Number(item.productId);
    const product = productMap.get(productId);
    if (!product) throw shippingError(`Produit introuvable (ID ${productId})`);

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unitWeight = positiveNumber(product.customsWeightGrams);
    const unitValue = positiveNumber(product.price);
    // Category defaults must be confirmed and saved on each actual article.
    // An unclassified blend must never silently inherit a pure-fibre profile.
    const profileKey = product.customsProfileKey;
    const profile = profileKey ? getCustomsProfile(profileKey) : null;
    if (profileKey && !profile) {
      throw shippingError(`Le profil douanier de « ${product.name} » doit être revérifié.`, 409);
    }
    if (profile?.internationalOnly && normalizedCountry(destinationCountry) === 'US') {
      assertShippingDestinationAllowed(destinationCountry);
    }
    const description = String(profile?.description || product.customsDescription || '').trim();
    const originCountry = String(product.customsOriginCountry || product.category?.customsOriginCountry || '').trim().toUpperCase();
    const tariffNumber = profile
      ? (normalizedCountry(destinationCountry) === 'US' ? profile.usHtsCode : profile.hsCode)
      : String(product.customsHsCode || '').replace(/[.\s]/g, '');
    if (!unitWeight || !unitValue || description.length < 3 || description.length > 100
      || !/^[A-Z]{2}$/.test(originCountry) || !/^\d{6,12}$/.test(tariffNumber)) {
      throw shippingError(`Les informations douanières sont incomplètes pour « ${product.name} ».`, 409);
    }
    if (unitWeight > Number(product.packageWeightGrams)) {
      throw shippingError(`Le poids net dépasse le poids emballé pour « ${product.name} ».`, 409);
    }
    return {
      description,
      quantity,
      net_weight: String(Math.round(unitWeight * quantity * 100) / 100),
      mass_unit: 'g',
      value_amount: roundMoney(unitValue * quantity).toFixed(2),
      value_currency: 'CAD',
      origin_country: originCountry,
      tariff_number: tariffNumber,
    };
  });

  return {
    contents_type: 'MERCHANDISE',
    non_delivery_option: 'RETURN',
    certify: true,
    certify_signer: signer,
    incoterm: 'DDU',
    commercial_invoice: true,
    items: customsItems,
  };
}

function validateDestination(destination) {
  const country = normalizedCountry(destination.country);
  const postalCode = normalizePostalCode(destination.postalCode);
  if (!/^[A-Z]{2}$/.test(country)) throw shippingError('Le pays de livraison est invalide.');
  if (!postalCode) throw shippingError('Le code postal est requis pour calculer la livraison.');
  if (!String(destination.address || '').trim() || !String(destination.city || '').trim()) {
    throw shippingError('L’adresse et la ville sont requises pour calculer la livraison.');
  }
  if ((country === 'CA' || country === 'US') && !String(destination.province || '').trim()) {
    throw shippingError('La province ou l’État est requis pour calculer la livraison.');
  }
  if (country !== shippoOrigin().country) {
    if (!String(destination.phone || '').trim()) {
      throw shippingError('Le téléphone du destinataire est requis pour une livraison internationale.');
    }
    if (!shippoOrigin().phone) {
      throw shippingError('Le téléphone d’expédition Shippo n’est pas configuré sur le serveur.', 503);
    }
  }
}

function selectUsefulRates(rates) {
  if (rates.length <= 3) return rates;
  const cheapest = rates[0];
  const fastest = [...rates]
    .filter((rate) => rate.estimatedDays)
    .sort((a, b) => a.estimatedDays - b.estimatedDays || a.amountCad - b.amountCad)[0];
  const middle = rates.find((rate) => rate.serviceCode !== cheapest.serviceCode && rate.serviceCode !== fastest?.serviceCode);
  return [cheapest, middle, fastest]
    .filter((rate, index, all) => rate && all.findIndex((candidate) => candidate.serviceCode === rate.serviceCode) === index)
    .sort((a, b) => a.amountCad - b.amountCad);
}

function shippoErrorMessage(body, fallback) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const message = messages
    .map((entry) => entry?.text || entry?.message || entry?.code)
    .find((value) => typeof value === 'string' && value.trim());
  return body?.detail || body?.message || body?.error || message || fallback;
}

function throwShippoRateError(body, fallback, defaultStatus = 502) {
  const message = String(shippoErrorMessage(body, fallback));
  if (/too many requests|rate.?limit/i.test(message)) {
    throw shippingError('Shippo limite temporairement les demandes de tarifs. Réessaie dans quelques minutes.', 503);
  }
  throw shippingError(`Shippo: ${message}`, defaultStatus);
}

function shippoServiceCode(rate) {
  const carrier = String(rate?.provider || rate?.provider_image_75 || 'carrier')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  const service = String(rate?.servicelevel?.token || rate?.servicelevel?.name || rate?.object_id || 'service')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  return `SHIPPO_${carrier}_${service}`;
}

function shippoCadAmount(rate) {
  const localCurrency = String(rate?.currency_local || '').toUpperCase();
  const currency = String(rate?.currency || '').toUpperCase();
  if (localCurrency === 'CAD') return positiveNumber(rate?.amount_local);
  if (currency === 'CAD') return positiveNumber(rate?.amount);
  return null;
}

export function parseShippoRates(body, handlingFee = 0) {
  const rates = Array.isArray(body?.rates) ? body.rates : [];
  return rates
    .map((rate) => {
      const amount = shippoCadAmount(rate);
      if (!amount) return null;
      const providerName = String(rate?.provider || '').trim();
      const serviceLevelName = String(rate?.servicelevel?.name || '').trim();
      if (!providerName || !serviceLevelName) return null;
      return {
        rateId: String(rate?.object_id || '').trim(),
        provider: 'SHIPPO',
        serviceCode: shippoServiceCode(rate),
        serviceName: `${providerName} · ${serviceLevelName}`,
        amountCad: roundMoney(amount + Math.max(0, Number(handlingFee) || 0)),
        trackingIncluded: true,
        estimatedDays: positiveNumber(rate?.estimated_days),
        estimatedDeliveryDate: rate?.arrives_by || null,
      };
    })
    .filter(Boolean)
    .filter((rate, index, all) => all.findIndex((candidate) => candidate.serviceCode === rate.serviceCode) === index)
    .sort((a, b) => a.amountCad - b.amountCad);
}

function compactAddress(address) {
  return Object.fromEntries(
    Object.entries(address).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== ''),
  );
}

function shippoEstimateRequest(packageInfo, destination, carrierAccountIds) {
  const origin = shippoOrigin();
  const destinationCountry = normalizedCountry(destination.country);
  const international = origin.country !== destinationCountry;
  return {
    address_from: compactAddress(origin),
    address_to: compactAddress({
      name: String(destination.name || 'Client').trim(),
      street1: String(destination.address || '').trim(),
      city: String(destination.city || '').trim(),
      state: String(destination.province || '').trim().toUpperCase(),
      country: destinationCountry,
      zip: normalizePostalCode(destination.postalCode),
      phone: String(destination.phone || '').trim(),
      email: String(destination.email || '').trim(),
      is_residential: true,
    }),
    parcels: [{
      length: String(packageInfo.lengthCm),
      width: String(packageInfo.widthCm),
      height: String(packageInfo.heightCm),
      distance_unit: 'cm',
      weight: String(packageInfo.weightGrams),
      mass_unit: 'g',
    }],
    carrier_accounts: carrierAccountIds,
    ...(international ? { customs_declaration: packageInfo.customsDeclaration } : {}),
    async: false,
    metadata: 'Itsgenygarts checkout',
  };
}

async function getShippoRates(packageInfo, destination, usefulOnly = true) {
  validateDestination(destination);
  const origin = shippoOrigin();
  if (origin.country !== normalizedCountry(destination.country) && !packageInfo?.customsDeclaration?.items?.length) {
    throw shippingError('La déclaration douanière est absente de cet envoi international.', 409);
  }

  const carrierAccountIds = await shippoCarrierAccountIds();
  const handlingFee = Math.max(0, Number(process.env.SHIPPING_HANDLING_FEE_CAD) || 0);
  const cacheKey = rateCacheKey(packageInfo, destination, carrierAccountIds, handlingFee);
  let parsedRates = cachedRates(cacheKey);

  if (!parsedRates) {
    let pending = pendingShippoRateRequests.get(cacheKey);
    if (!pending) {
      reserveShippoRateRequest();
      pending = (async () => {
        let response;
        try {
          response = await fetch(`${SHIPPO_API}/shipments/`, {
            method: 'POST',
            headers: {
              Authorization: `ShippoToken ${envValue('SHIPPO_API_TOKEN')}`,
              'Content-Type': 'application/json',
              'SHIPPO-API-VERSION': '2018-02-08',
            },
            body: JSON.stringify(shippoEstimateRequest(packageInfo, destination, carrierAccountIds)),
            signal: AbortSignal.timeout(15_000),
          });
        } catch {
          throw shippingError('Shippo ne peut pas calculer la livraison pour le moment.', 502);
        }

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throwShippoRateError(body, 'calcul de livraison impossible');
        }

        const rates = parseShippoRates(body, handlingFee);
        if (rates.length === 0) {
          const providerMessage = shippoErrorMessage(body, '');
          if (providerMessage) throwShippoRateError(body, providerMessage, 422);
          throw shippingError('Aucune option de livraison Shippo en dollars canadiens n’est disponible pour cette adresse.', 422);
        }
        storeCachedRates(cacheKey, rates);
        return rates;
      })();
      pendingShippoRateRequests.set(cacheKey, pending);
    }

    try {
      parsedRates = await pending;
    } finally {
      if (pendingShippoRateRequests.get(cacheKey) === pending) {
        pendingShippoRateRequests.delete(cacheKey);
      }
    }
  }

  const rates = usefulOnly ? selectUsefulRates(parsedRates) : parsedRates;
  return rates;
}

export function resetShippoCarrierAccountCache() {
  cachedShippoCarrierAccounts = null;
  cachedShippoCarrierAccountsToken = null;
  pendingShippoCarrierAccounts = null;
  pendingShippoCarrierAccountsToken = null;
  shippoRateCache.clear();
  pendingShippoRateRequests.clear();
  shippoRateUsage = { day: null, count: 0 };
}

export async function quoteShipping({ items, products, destination, language }) {
  assertShippingDestinationAllowed(destination?.country, language);
  if (!Array.isArray(items) || items.length === 0) throw shippingError('items required');
  if (!destination?.country) throw shippingError('Le pays de livraison est requis.');

  if (!shippoRatesConfigured()) {
    throw shippingError('La livraison Shippo n’est pas configurée sur le serveur.', 503);
  }

  const packageInfo = buildShippingPackage(items, products);
  if (shippoOrigin().country !== normalizedCountry(destination.country)) {
    packageInfo.customsDeclaration = buildCustomsDeclaration(items, products, destination.country);
  }
  const options = await getShippoRates(packageInfo, destination);
  return { options, package: packageInfo, providerConfigured: true };
}

export async function refreshShippoRateForOrder(order) {
  assertShippingDestinationAllowed(order?.customerCountry);
  if (order?.shippingProvider !== 'SHIPPO' || !order?.shippingServiceCode) {
    throw shippingError('Cette commande n’utilise pas une livraison Shippo.', 409);
  }
  const packageInfo = typeof order.shippingPackage === 'string'
    ? JSON.parse(order.shippingPackage)
    : order.shippingPackage;
  const requiredPackageValues = [
    packageInfo?.weightGrams,
    packageInfo?.lengthCm,
    packageInfo?.widthCm,
    packageInfo?.heightCm,
  ];
  if (!requiredPackageValues.every((value) => positiveNumber(value))) {
    throw shippingError('Les dimensions du colis sont absentes de cette commande.', 409);
  }

  const rates = await getShippoRates(packageInfo, {
    name: order.customerName,
    address: order.customerAddress,
    city: order.customerCity,
    province: order.customerProvince,
    country: order.customerCountry,
    postalCode: order.customerPostalCode,
    phone: order.customerPhone,
    email: order.customerEmail,
  }, false);
  const rate = rates.find((candidate) => candidate.serviceCode === order.shippingServiceCode);
  if (!rate?.rateId) {
    throw shippingError('Le service de livraison choisi n’est plus disponible. Sélectionne un autre tarif.', 409);
  }
  return rate;
}
