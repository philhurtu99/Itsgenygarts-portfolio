import { commitStockForOrder, reserveStockForOrder } from './stock.js';
import { sendPaidOrderEmails } from './orderEmails.js';
import { notifyPaidRegularOrder } from './adminPushNotifications.js';
import { paidOrderUpdateFromStripeSession } from '../utils/stripeCheckout.js';

export async function markRegularOrderPaid(
  prisma,
  orderId,
  stripeObject,
  context = 'payment',
  { allowDraft = false } = {},
) {
  const id = Number(orderId);
  if (!Number.isInteger(id)) return null;

  const pendingOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true, reservations: true },
  });
  if (!pendingOrder || pendingOrder.status !== 'PENDING') return null;

  if (!pendingOrder.reservations?.length) {
    await reserveStockForOrder(
      id,
      pendingOrder.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
        })),
      { allowDraft },
    );
  }

  const updated = await prisma.order.updateMany({
    where: { id, status: 'PENDING' },
    data: paidOrderUpdateFromStripeSession(stripeObject),
  });
  if (updated.count === 0) return null;

  await commitStockForOrder(id);
  const paidOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (paidOrder) {
    console.log(`Order #${id} marked as PAID and stock decremented via ${context}`);
    sendPaidOrderEmails(paidOrder, { prisma });
    notifyPaidRegularOrder(prisma, paidOrder).catch((err) => {
      console.error(`Failed to send paid order push notification for #${id}:`, err.message);
    });
  }

  return paidOrder;
}
