import { PrismaClient } from '@prisma/client';
import { releaseStockForOrderInTransaction, RESERVATION_MINUTES } from './stock.js';

const prisma = new PrismaClient();

export async function discardPendingOrder(orderId) {
  const id = Number(orderId);
  if (!Number.isInteger(id)) return false;

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ABANDONED' },
    });

    if (claimed.count <= 0) return false;

    await releaseStockForOrderInTransaction(tx, id);
    await tx.order.deleteMany({ where: { id, status: 'ABANDONED' } });
    return true;
  });
}

export async function expireStalePendingOrders({ olderThanMinutes = RESERVATION_MINUTES } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const pendingOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  let expiredCount = 0;
  for (const order of pendingOrders) {
    const discarded = await discardPendingOrder(order.id);
    if (discarded) {
      expiredCount += 1;
    }
  }

  return expiredCount;
}
