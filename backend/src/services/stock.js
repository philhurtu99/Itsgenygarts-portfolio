import { PrismaClient } from '@prisma/client';
import { removeProductFromCustomerLists } from './cartCleanup.js';

const prisma = new PrismaClient();

// 30 min matches Stripe Checkout session expires_at minimum, so reservation and session expire together.
export const RESERVATION_MINUTES = 30;

// Returns available stock (physical - active reservations, excluding those belonging to excludeOrderId).
export async function getAvailableStock(productId, excludeOrderId = null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { where: { status: { not: 'SOLD' } } } },
  });
  if (!product || product.isDeleted || product.isDraft || product.soldOut) return 0;

  if (product.variants?.length) {
    return product.variants.filter((variant) => variant.status === 'AVAILABLE').length;
  }

  const reservations = await prisma.stockReservation.findMany({
    where: {
      productId,
      expiresAt: { gt: new Date() },
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
    },
  });

  const reserved = reservations.reduce((sum, r) => sum + r.quantity, 0);
  return Math.max(0, product.stockQuantity - reserved);
}

// Creates reservations for an order. Validates availability atomically.
// Throws if insufficient stock.
export async function reserveStockForOrder(orderId, items, { allowDraft = false } = {}) {
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const productId = Number(item.productId);
      const qty = 1;

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { variants: { where: { status: { not: 'SOLD' } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
      });
      if (!product || product.isDeleted || (!allowDraft && product.isDraft)) {
        throw new Error(`Produit introuvable (ID ${productId})`);
      }

      const variants = product.variants || [];
      const variantId = item.productVariantId ? Number(item.productVariantId) : null;
      if (variants.length > 0) {
        if (!variantId) {
          throw new Error(`Variation requise pour "${product.name}"`);
        }
        const lockedVariant = await tx.productVariant.updateMany({
          where: {
            id: variantId,
            productId,
            status: 'AVAILABLE',
          },
          data: { status: 'RESERVED' },
        });

        if (lockedVariant.count !== 1) {
          throw new Error(`Variation indisponible pour "${product.name}"`);
        }

        await tx.stockReservation.create({
          data: { orderId, productId, productVariantId: variantId, quantity: qty, expiresAt },
        });

        const remaining = await tx.productVariant.count({ where: { productId, status: 'AVAILABLE' } });
        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: remaining, soldOut: remaining <= 0 },
        });
        continue;
      }

      const locked = await tx.product.updateMany({
        where: {
          id: productId,
          isDeleted: false,
          ...(allowDraft ? {} : { isDraft: false }),
          soldOut: false,
          stockQuantity: { gte: qty },
        },
        data: { soldOut: true },
      });

      if (locked.count !== 1) {
        throw new Error(`Stock insuffisant pour "${product.name}". Disponible : 0, demandé : ${qty}`);
      }

      await tx.stockReservation.create({
        data: { orderId, productId, quantity: qty, expiresAt },
      });
    }
  });
}

// Called on webhook PAID: decrement physical stock, delete reservations for this order.
export async function commitStockForOrder(orderId) {
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.stockReservation.findMany({ where: { orderId } });
    for (const r of reservations) {
      if (r.productVariantId) {
        await tx.productVariant.update({
          where: { id: r.productVariantId },
          data: { status: 'SOLD' },
        });
        const remaining = await tx.productVariant.count({ where: { productId: r.productId, status: 'AVAILABLE' } });
        await tx.product.update({
          where: { id: r.productId },
          data: { stockQuantity: remaining, soldOut: remaining <= 0 },
        });
        if (remaining <= 0) {
          const product = await tx.product.findUnique({ where: { id: r.productId } });
          await removeProductFromCustomerLists(tx, { ...product, stockQuantity: 0, soldOut: true });
        }
        continue;
      }

      const product = await tx.product.findUnique({ where: { id: r.productId } });
      if (!product) continue;

      const nextStock = Math.max(0, product.stockQuantity - r.quantity);
      await tx.product.update({
        where: { id: r.productId },
        data: {
          stockQuantity: nextStock,
          soldOut: nextStock <= 0,
        },
      });
      if (nextStock <= 0) {
        await removeProductFromCustomerLists(tx, { ...product, stockQuantity: nextStock, soldOut: true });
      }
    }
    await tx.stockReservation.deleteMany({ where: { orderId } });
  });
}

export async function releaseStockForOrderInTransaction(tx, orderId) {
  const reservations = await tx.stockReservation.findMany({ where: { orderId } });
  await tx.stockReservation.deleteMany({ where: { orderId } });

  for (const reservation of reservations) {
    if (reservation.productVariantId) {
      await tx.productVariant.updateMany({
        where: { id: reservation.productVariantId, status: 'RESERVED' },
        data: { status: 'AVAILABLE' },
      });
      const remaining = await tx.productVariant.count({ where: { productId: reservation.productId, status: 'AVAILABLE' } });
      await tx.product.update({
        where: { id: reservation.productId },
        data: { stockQuantity: remaining, soldOut: remaining <= 0 },
      });
      continue;
    }

    const product = await tx.product.findUnique({ where: { id: reservation.productId } });
    if (!product || product.isDeleted || product.stockQuantity <= 0) continue;

    const activeReservations = await tx.stockReservation.findMany({
      where: {
        productId: reservation.productId,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeReservations.length === 0) {
      await tx.product.update({
        where: { id: reservation.productId },
        data: { soldOut: false },
      });
    }
  }
}

// Called on session expired / cancellation: drop reservations and unlock still-unsold products.
export async function releaseStockForOrder(orderId) {
  await prisma.$transaction((tx) => releaseStockForOrderInTransaction(tx, orderId));
}
