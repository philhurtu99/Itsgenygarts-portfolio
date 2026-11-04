import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import * as Sentry from '@sentry/node';
import { discardPendingOrder } from '../../services/pendingOrders.js';
import { markRegularOrderPaid } from '../../services/regularOrderPayment.js';
import { expireConflictingPendingPaymentLinks } from '../../services/paymentLinkAvailability.js';
import { applyNewsletterConsent } from '../../services/newsletterConsent.js';
import { paidAtFromStripeObject, stripeObjectId } from '../../utils/stripeCheckout.js';
import {
  markLegacyCustomOrderPaid,
  sendCustomPaymentReceipt,
  settleCustomOrderPayment,
} from '../../services/customOrderPayments.js';
import { notifyPaidCustomOrder } from '../../services/adminPushNotifications.js';

function reportWebhookFailure(context, err, extra = {}) {
  console.error(`[stripe-webhook] ${context}:`, err.message);
  Sentry.captureException(err, {
    tags: { area: 'stripe-webhook', context },
    extra,
    level: 'error',
  });
}

const router = Router();
const prisma = new PrismaClient();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

function paymentSourceAllowsDraftProduct(stripeObject) {
  const source = String(stripeObject?.metadata?.source || '');
  return source.startsWith('admin-market-') || source === 'admin-payment-link' || source === 'admin-tap-to-pay';
}

async function markCustomOrderPaid(customOrderId, customOrderPaymentId, stripeObject, context) {
  let result;
  if (customOrderPaymentId) {
    result = await settleCustomOrderPayment(prisma, customOrderPaymentId, stripeObject);
  } else {
    const legacyResult = await markLegacyCustomOrderPaid(prisma, customOrderId, stripeObject);
    result = {
      ...legacyResult,
      payment: legacyResult.order
        ? { amount: Number(legacyResult.order.price || 0), kind: 'FULL' }
        : null,
    };
  }
  if (result?.newlyPaid && result.order && result.payment) {
    sendCustomPaymentReceipt(result.order, result.payment).catch((err) => {
      reportWebhookFailure('custom-payment-receipt', err, { customOrderId, customOrderPaymentId });
    });
    notifyPaidCustomOrder(prisma, result.order, result.payment).catch((err) => {
      reportWebhookFailure('custom-payment-push', err, { customOrderId, customOrderPaymentId });
    });
  }
  console.log(`CustomOrder #${customOrderId} marked as PAID via ${context}`);
}

async function markPersonalizedQuotePaid(personalizedQuoteId, stripeObject, context) {
  await prisma.personalizedQuote.update({
    where: { id: Number(personalizedQuoteId) },
    data: {
      status: 'PAID',
      stripePaymentId: stripeObjectId(stripeObject.payment_intent) || stripeObject.id || null,
      paidAt: paidAtFromStripeObject(stripeObject),
    },
  });
  console.log(`PersonalizedQuote #${personalizedQuoteId} marked as PAID via ${context}`);
}

function parseYarnProductIdsFromStripe(stripeObject) {
  const metadata = stripeObject?.metadata || {};
  const ids = new Set();
  const singularId = Number(metadata.yarnProductId);
  if (Number.isInteger(singularId) && singularId > 0) {
    ids.add(singularId);
  }

  const raw = metadata.yarnProductIds;
  if (!raw) return [...ids];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ids];
    parsed
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
      .forEach((id) => ids.add(id));
  } catch {
    return [...ids];
  }
  return [...ids];
}

async function restoreYarnStock(yarnProductIds) {
  if (!yarnProductIds.length) return;
  await prisma.$transaction(yarnProductIds.map((id) => prisma.yarnProduct.update({
    where: { id: Number(id) },
    data: {
      stockQuantity: { increment: 1 },
      soldOut: false,
    },
  })));
}

async function markOrderPaid(orderId, stripeObject, context) {
  const id = Number(orderId);
  if (!Number.isInteger(id)) return null;

  const yarnProductIds = parseYarnProductIdsFromStripe(stripeObject);
  let decrementedYarnProductIds = [];
  let order = null;
  try {
    if (yarnProductIds.length) {
      const existingOrder = await prisma.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existingOrder || existingOrder.status !== 'PENDING') return null;
      decrementedYarnProductIds = await decrementYarnStocks(yarnProductIds);
    }
    const allowDraft = paymentSourceAllowsDraftProduct(stripeObject);
    order = await markRegularOrderPaid(prisma, id, stripeObject, context, { allowDraft });
    if (!order && decrementedYarnProductIds.length) {
      await restoreYarnStock(decrementedYarnProductIds).catch(() => {});
    }
  } catch (err) {
    await restoreYarnStock(decrementedYarnProductIds).catch(() => {});
    throw err;
  }
  if (order) {
    await expireConflictingPendingPaymentLinks(prisma, stripe, order.items, { excludeOrderId: order.id });
  }
  return order;
}

async function decrementYarnStocks(yarnProductIds) {
  if (!yarnProductIds.length) return [];
  return prisma.$transaction(async (tx) => {
    const decremented = [];
    for (const yarnProductId of yarnProductIds) {
      const id = Number(yarnProductId);
      const yarn = await tx.yarnProduct.findUnique({ where: { id } });
      if (!yarn || yarn.isDeleted || yarn.soldOut || Number(yarn.stockQuantity || 0) <= 0) {
        throw new Error(`Laine indisponible (ID ${id})`);
      }

      const nextStock = Math.max(0, Number(yarn.stockQuantity || 0) - 1);
      await tx.yarnProduct.update({
        where: { id },
        data: {
          stockQuantity: nextStock,
          soldOut: nextStock <= 0,
        },
      });
      decremented.push(id);
    }
    return decremented;
  });
}

function checkoutAcceptedNewsletter(session) {
  const value = session?.consent?.promotions;
  return value === 'opt_in' || value === true || value === 'true';
}

async function storeCheckoutNewsletterConsent(session) {
  if (!checkoutAcceptedNewsletter(session)) return;
  await applyNewsletterConsent(prisma, {
    email: session.customer_details?.email || session.customer_email,
    name: session.customer_details?.name,
    consent: true,
  });
}

router.post('/', async (req, res) => {
  if (!stripe || !endpointSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    reportWebhookFailure('signature-verification', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const customOrderId = session.metadata?.customOrderId;
      const customOrderPaymentId = session.metadata?.customOrderPaymentId;
      const personalizedQuoteId = session.metadata?.personalizedQuoteId;

      try {
        await storeCheckoutNewsletterConsent(session);
      } catch (err) {
        reportWebhookFailure('newsletter-consent-update', err, { sessionId: session.id });
      }

      if (orderId && session.payment_status === 'paid') {
        try {
          await markOrderPaid(orderId, session, event.type);
        } catch (err) {
          reportWebhookFailure('order-paid-update', err, { orderId, sessionId: session.id });
        }
      }

      if (customOrderId && session.payment_status === 'paid') {
        try {
          await markCustomOrderPaid(customOrderId, customOrderPaymentId, session, event.type);
        } catch (err) {
          reportWebhookFailure('custom-order-paid-update', err, { customOrderId, sessionId: session.id });
        }
      }

      if (personalizedQuoteId && session.payment_status === 'paid') {
        try {
          await markPersonalizedQuotePaid(personalizedQuoteId, session, event.type);
        } catch (err) {
          reportWebhookFailure('personalized-quote-paid-update', err, { personalizedQuoteId, sessionId: session.id });
        }
      }
      break;
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const customOrderId = session.metadata?.customOrderId;
      const customOrderPaymentId = session.metadata?.customOrderPaymentId;
      const personalizedQuoteId = session.metadata?.personalizedQuoteId;

      try {
        await storeCheckoutNewsletterConsent(session);
      } catch (err) {
        reportWebhookFailure('newsletter-consent-async-update', err, { sessionId: session.id });
      }

      if (orderId) {
        try {
          await markOrderPaid(orderId, session, event.type);
        } catch (err) {
          reportWebhookFailure('order-async-paid-update', err, { orderId, sessionId: session.id });
        }
      }

      if (customOrderId) {
        try {
          await markCustomOrderPaid(customOrderId, customOrderPaymentId, session, event.type);
        } catch (err) {
          reportWebhookFailure('custom-order-async-paid-update', err, { customOrderId, sessionId: session.id });
        }
      }

      if (personalizedQuoteId) {
        try {
          await markPersonalizedQuotePaid(personalizedQuoteId, session, event.type);
        } catch (err) {
          reportWebhookFailure('personalized-quote-async-paid-update', err, { personalizedQuoteId, sessionId: session.id });
        }
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;
      const customOrderId = paymentIntent.metadata?.customOrderId;
      const customOrderPaymentId = paymentIntent.metadata?.customOrderPaymentId;
      const personalizedQuoteId = paymentIntent.metadata?.personalizedQuoteId;

      if (orderId) {
        try {
          await markOrderPaid(orderId, paymentIntent, event.type);
        } catch (err) {
          reportWebhookFailure('order-intent-paid-update', err, {
            orderId,
            paymentIntentId: paymentIntent.id,
          });
        }
      }

      if (customOrderId) {
        try {
          await markCustomOrderPaid(customOrderId, customOrderPaymentId, paymentIntent, event.type);
        } catch (err) {
          reportWebhookFailure('custom-order-intent-paid-update', err, {
            customOrderId,
            paymentIntentId: paymentIntent.id,
          });
        }
      }

      if (personalizedQuoteId) {
        try {
          await markPersonalizedQuotePaid(personalizedQuoteId, paymentIntent, event.type);
        } catch (err) {
          reportWebhookFailure('personalized-quote-intent-paid-update', err, {
            personalizedQuoteId,
            paymentIntentId: paymentIntent.id,
          });
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        try {
          const discarded = await discardPendingOrder(Number(orderId));
          if (discarded) {
            console.log(`Order #${orderId} discarded (session expired), stock released`);
          }
        } catch (err) {
          reportWebhookFailure('order-expire-cancel', err, { orderId, sessionId: session.id });
        }
      }
      break;
    }

    default:
      // Unhandled event type — that's fine
      break;
  }

  res.json({ received: true });
});

export default router;
