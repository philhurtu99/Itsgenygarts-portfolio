import { discardPendingOrder } from './pendingOrders.js';

function itemConflictWhere(item) {
  const productId = Number(item.productId);
  if (!Number.isInteger(productId)) return null;

  const variantId = item.productVariantId ? Number(item.productVariantId) : null;
  if (variantId) {
    return { items: { some: { productVariantId: variantId } } };
  }

  return { items: { some: { productId, productVariantId: null } } };
}

export async function expireConflictingPendingPaymentLinks(prisma, stripe, items, { excludeOrderId = null } = {}) {
  if (!stripe?.checkout?.sessions?.expire || !Array.isArray(items) || items.length === 0) {
    return { expired: 0, checked: 0 };
  }

  const conflicts = items.map(itemConflictWhere).filter(Boolean);
  if (!conflicts.length) return { expired: 0, checked: 0 };

  const pendingOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      stripeSessionId: { not: null },
      reservations: { none: {} },
      ...(excludeOrderId ? { id: { not: Number(excludeOrderId) } } : {}),
      OR: conflicts,
    },
    select: { id: true, stripeSessionId: true },
  });

  let expired = 0;
  for (const order of pendingOrders) {
    try {
      await stripe.checkout.sessions.expire(order.stripeSessionId);
      const discarded = await discardPendingOrder(order.id);
      if (discarded) expired += 1;
    } catch (err) {
      console.error(`Failed to expire conflicting payment link ${order.stripeSessionId}:`, err.message);
    }
  }

  return { expired, checked: pendingOrders.length };
}
