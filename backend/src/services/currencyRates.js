import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PROVIDER_URL = 'https://api.frankfurter.dev/v1/latest';
const DEFAULT_BASE_CURRENCY = 'CAD';
const DEFAULT_INTERVAL_HOURS = 24;

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function positiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function currencyRateAutoUpdateEnabled(value = process.env.CURRENCY_RATE_AUTO_UPDATE) {
  return String(value || 'true').toLowerCase() !== 'false';
}

export function currencyRateUpdateIntervalMs(value = process.env.CURRENCY_RATE_UPDATE_INTERVAL_HOURS) {
  const hours = Number(value);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_INTERVAL_HOURS;
  return safeHours * 60 * 60 * 1000;
}

function buildLatestRatesUrl({ sourceUrl, baseCurrency, targetCodes }) {
  const url = new URL(sourceUrl);
  url.searchParams.set('base', baseCurrency);
  url.searchParams.set('symbols', targetCodes.join(','));
  return url.toString();
}

export async function updateCurrencyRates({
  prismaClient = prisma,
  fetchImpl = globalThis.fetch,
  sourceUrl = process.env.CURRENCY_RATE_PROVIDER_URL || DEFAULT_PROVIDER_URL,
  baseCurrency = DEFAULT_BASE_CURRENCY,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API unavailable for currency rate update');
  }

  const normalizedBase = normalizeCode(baseCurrency);
  const currencies = await prismaClient.currencyRate.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  const targetCodes = [...new Set(
    currencies
      .map((currency) => normalizeCode(currency.code))
      .filter((code) => code && code !== normalizedBase)
  )];

  let updated = 0;
  const skipped = [];
  const provider = new URL(sourceUrl).hostname;
  let providerDate = null;

  const baseRows = currencies.filter((currency) => normalizeCode(currency.code) === normalizedBase);
  for (const currency of baseRows) {
    await prismaClient.currencyRate.update({
      where: { id: currency.id },
      data: { rate: 1 },
    });
    updated += 1;
  }

  if (targetCodes.length === 0) {
    return { updated, skipped, provider, date: providerDate };
  }

  const response = await fetchImpl(buildLatestRatesUrl({
    sourceUrl,
    baseCurrency: normalizedBase,
    targetCodes,
  }), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Currency provider returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  providerDate = payload?.date || null;
  const rates = payload?.rates && typeof payload.rates === 'object' ? payload.rates : {};

  for (const currency of currencies) {
    const code = normalizeCode(currency.code);
    if (!code || code === normalizedBase) continue;

    const rate = positiveRate(rates[code]);
    if (!rate) {
      skipped.push(code);
      continue;
    }

    await prismaClient.currencyRate.update({
      where: { id: currency.id },
      data: { rate },
    });
    updated += 1;
  }

  return { updated, skipped, provider, date: providerDate };
}
