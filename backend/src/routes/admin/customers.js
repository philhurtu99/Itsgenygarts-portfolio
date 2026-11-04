import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

function money(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function normalizeOrder(order) {
  return {
    id: order.id,
    type: 'order',
    label: 'Commande',
    status: order.status,
    amount: money(order.total),
    currency: order.currency || 'CAD',
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

function normalizeCustomOrder(order) {
  return {
    id: order.id,
    type: 'customOrder',
    label: 'Commande custom',
    status: order.status,
    amount: money(order.price),
    currency: 'CAD',
    createdAt: order.createdAtUtc,
    paidAt: order.paidAt,
  };
}

function normalizePersonalizedQuote(quote) {
  return {
    id: quote.id,
    type: 'personalizedQuote',
    label: 'Devis personnalisé',
    status: quote.status,
    amount: money(quote.price),
    currency: 'CAD',
    createdAt: quote.createdAtUtc,
    paidAt: quote.paidAt,
  };
}

function normalizeQuoteRequest(quote) {
  return {
    id: quote.id,
    type: 'quoteRequest',
    label: 'Panier devis',
    status: quote.status,
    amount: money(quote.totalAmount),
    currency: 'CAD',
    createdAt: quote.createdAt,
    paidAt: quote.completedAt,
  };
}

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        emailVerified: true,
        newsletterConsent: true,
        createdAt: true,
        cartItems: {
          include: { product: { select: { id: true, name: true, price: true, mainImageUrl: true } } },
        },
        favoriteItems: {
          include: { product: { select: { id: true, name: true, price: true, mainImageUrl: true } } },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
    }

    const [orders, customOrders, personalizedQuotes, quoteRequests, notes] = await Promise.all([
      prisma.order.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAt: 'desc' } }),
      prisma.customOrder.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAtUtc: 'desc' } }),
      prisma.personalizedQuote.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAtUtc: 'desc' } }),
      prisma.quoteRequest.findMany({ where: { customerEmail: customer.email }, orderBy: { createdAt: 'desc' } }),
      prisma.adminNote.findMany({ where: { entityType: 'customer', entityId: customer.id }, orderBy: { createdAt: 'desc' } }),
    ]);

    const transactions = [
      ...orders.map(normalizeOrder),
      ...customOrders.map(normalizeCustomOrder),
      ...personalizedQuotes.map(normalizePersonalizedQuote),
      ...quoteRequests.map(normalizeQuoteRequest),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const paidTotal = transactions
      .filter((item) => item.paidAt || ['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(item.status))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    res.json({
      success: true,
      data: {
        customer,
        transactions,
        notes,
        stats: {
          transactionCount: transactions.length,
          paidTotal,
          lastActivityAt: transactions[0]?.createdAt || customer.createdAt,
          cartItems: customer.cartItems.length,
          favoriteItems: customer.favoriteItems.length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
