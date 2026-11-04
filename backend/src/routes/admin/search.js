import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

const MAX_LIMIT = 50;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function contains(value) {
  return { contains: value, mode: 'insensitive' };
}

function money(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function textOrNull(value) {
  return value || null;
}

function buildSearchWhere(query, fields) {
  if (!query) return {};
  const id = Number(query);
  const or = fields.map((field) => ({ [field]: contains(query) }));
  if (Number.isInteger(id) && id > 0) {
    or.unshift({ id });
  }
  return { OR: or };
}

function normalizeOrder(order) {
  return {
    id: order.id,
    type: 'order',
    label: 'Commande',
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    amount: money(order.total),
    currency: order.currency || 'CAD',
    stripeSessionId: textOrNull(order.stripeSessionId),
    stripePaymentId: textOrNull(order.stripePaymentId),
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    itemCount: order.items?.length || 0,
  };
}

function normalizeCustomOrder(order) {
  return {
    id: order.id,
    type: 'customOrder',
    label: 'Commande custom',
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    amount: money(order.price),
    currency: 'CAD',
    stripeSessionId: textOrNull(order.stripeSessionId),
    stripePaymentId: textOrNull(order.stripePaymentId),
    paidAt: order.paidAt,
    createdAt: order.createdAtUtc,
    itemCount: null,
  };
}

function normalizePersonalizedQuote(quote) {
  return {
    id: quote.id,
    type: 'personalizedQuote',
    label: 'Devis personnalisé',
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    status: quote.status,
    amount: money(quote.price),
    currency: 'CAD',
    stripeSessionId: textOrNull(quote.stripeSessionId),
    stripePaymentId: textOrNull(quote.stripePaymentId),
    paidAt: quote.paidAt,
    createdAt: quote.createdAtUtc,
    itemCount: null,
  };
}

function normalizeQuoteRequest(quote) {
  return {
    id: quote.id,
    type: 'quoteRequest',
    label: 'Panier devis',
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    status: quote.status,
    amount: money(quote.totalAmount),
    currency: 'CAD',
    stripeSessionId: null,
    stripePaymentId: null,
    paidAt: quote.completedAt,
    createdAt: quote.createdAt,
    itemCount: quote.items?.length || 0,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = clampLimit(req.query.limit);
    const queryId = Number(query);
    const hasQuery = query.length >= 2 || (Number.isInteger(queryId) && queryId > 0);
    const type = String(req.query.type || 'all');
    const status = String(req.query.status || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
    const minAmount = req.query.minAmount !== undefined && req.query.minAmount !== '' ? Number(req.query.minAmount) : null;
    const maxAmount = req.query.maxAmount !== undefined && req.query.maxAmount !== '' ? Number(req.query.maxAmount) : null;

    const createdAtRange = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) createdAtRange.gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      dateTo.setHours(23, 59, 59, 999);
      createdAtRange.lte = dateTo;
    }
    const hasDateRange = Object.keys(createdAtRange).length > 0;

    const amountRange = {};
    if (Number.isFinite(minAmount)) amountRange.gte = minAmount;
    if (Number.isFinite(maxAmount)) amountRange.lte = maxAmount;
    const hasAmountRange = Object.keys(amountRange).length > 0;

    const customerWhere = hasQuery
      ? {
          OR: [
            { name: contains(query) },
            { email: contains(query) },
          ],
        }
      : {};

    const orderWhere = hasQuery
      ? buildSearchWhere(query, ['customerName', 'customerEmail', 'stripeSessionId', 'stripePaymentId'])
      : { status: { not: 'PENDING' } };
    if (status) orderWhere.status = status;
    if (hasDateRange) orderWhere.createdAt = createdAtRange;
    if (hasAmountRange) orderWhere.total = amountRange;

    const customOrderWhere = hasQuery
      ? buildSearchWhere(query, ['customerName', 'customerEmail', 'stripeSessionId', 'stripePaymentId'])
      : {};
    if (status) customOrderWhere.status = status;
    if (hasDateRange) customOrderWhere.createdAtUtc = createdAtRange;
    if (hasAmountRange) customOrderWhere.price = amountRange;

    const personalizedQuoteWhere = hasQuery
      ? buildSearchWhere(query, ['customerName', 'customerEmail', 'stripeSessionId', 'stripePaymentId'])
      : {};
    if (status) personalizedQuoteWhere.status = status;
    if (hasDateRange) personalizedQuoteWhere.createdAtUtc = createdAtRange;
    if (hasAmountRange) personalizedQuoteWhere.price = amountRange;

    const quoteRequestWhere = hasQuery
      ? buildSearchWhere(query, ['customerName', 'customerEmail'])
      : {};
    if (status) quoteRequestWhere.status = status;
    if (hasDateRange) quoteRequestWhere.createdAt = createdAtRange;
    if (hasAmountRange) quoteRequestWhere.totalAmount = amountRange;

    const [customers, orders, customOrders, personalizedQuotes, quoteRequests] = await Promise.all([
      prisma.customer.findMany({
        where: customerWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          emailVerified: true,
          newsletterConsent: true,
          createdAt: true,
        },
      }),
      type === 'all' || type === 'order' ? prisma.order.findMany({
        where: orderWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { id: true } } },
      }) : [],
      type === 'all' || type === 'customOrder' ? prisma.customOrder.findMany({
        where: customOrderWhere,
        take: limit,
        orderBy: { createdAtUtc: 'desc' },
      }) : [],
      type === 'all' || type === 'personalizedQuote' ? prisma.personalizedQuote.findMany({
        where: personalizedQuoteWhere,
        take: limit,
        orderBy: { createdAtUtc: 'desc' },
      }) : [],
      type === 'all' || type === 'quoteRequest' ? prisma.quoteRequest.findMany({
        where: quoteRequestWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { id: true } } },
      }) : [],
    ]);

    const transactions = [
      ...orders.map(normalizeOrder),
      ...customOrders.map(normalizeCustomOrder),
      ...personalizedQuotes.map(normalizePersonalizedQuote),
      ...quoteRequests.map(normalizeQuoteRequest),
    ]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit);

    res.json({
      success: true,
      data: {
        query,
        customers,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
