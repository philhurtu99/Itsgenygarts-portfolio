import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function centsToAmount(value) {
  if (value == null) return null;
  return Number(value) / 100;
}

function normalizeAddress(address) {
  if (!address) return null;
  return {
    line1: address.line1 || '',
    line2: address.line2 || '',
    city: address.city || '',
    province: address.state || '',
    postalCode: address.postal_code || '',
    country: address.country || '',
  };
}

function normalizePaymentMethod(charge) {
  const details = charge?.payment_method_details;
  if (!details) return null;
  if (details.card) {
    return {
      type: 'card',
      brand: details.card.brand,
      last4: details.card.last4,
    };
  }
  return { type: details.type || charge.payment_method || 'stripe' };
}

function normalizeLineItem(item, fallbackCurrency) {
  const quantity = Number(item.quantity || 1);
  const total = centsToAmount(item.amount_total);
  return {
    productName: item.description || item.price?.product?.name || 'Article',
    quantity,
    unitPrice: quantity > 0 && total != null ? total / quantity : centsToAmount(item.price?.unit_amount),
    subtotal: total ?? 0,
    currency: (item.currency || item.price?.currency || fallbackCurrency || 'cad').toUpperCase(),
  };
}

function objectId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

export async function getStripeInvoiceData(order) {
  if (!stripe || (!order?.stripeSessionId && !order?.stripePaymentId)) return null;

  let session = null;
  let paymentIntent = null;
  let lineItems = [];

  if (order.stripeSessionId) {
    session = await stripe.checkout.sessions.retrieve(order.stripeSessionId, {
      expand: ['invoice', 'payment_intent.latest_charge.balance_transaction'],
    });
    const stripeLineItems = await stripe.checkout.sessions.listLineItems(order.stripeSessionId, {
      limit: 100,
      expand: ['data.price.product'],
    });
    lineItems = stripeLineItems.data || [];
    paymentIntent = session.payment_intent;
  }

  if (!paymentIntent && order.stripePaymentId) {
    paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentId, {
      expand: ['latest_charge.balance_transaction'],
    });
  }

  const charge = typeof paymentIntent?.latest_charge === 'object'
    ? paymentIntent.latest_charge
    : null;
  const invoice = typeof session?.invoice === 'object' ? session.invoice : null;
  const currency = (session?.currency || paymentIntent?.currency || order.currency || 'cad').toUpperCase();
  const totalDetails = session?.total_details || {};

  return {
    provider: 'Stripe',
    sessionId: session?.id || order.stripeSessionId || null,
    paymentIntentId: objectId(paymentIntent) || order.stripePaymentId || null,
    chargeId: charge?.id || null,
    invoiceId: invoice?.id || objectId(session?.invoice),
    hostedInvoiceUrl: invoice?.hosted_invoice_url || null,
    invoicePdfUrl: invoice?.invoice_pdf || null,
    receiptUrl: charge?.receipt_url || null,
    paymentStatus: session?.payment_status || paymentIntent?.status || null,
    paidAt: paymentIntent?.created ? new Date(paymentIntent.created * 1000) : null,
    customer: {
      name: session?.customer_details?.name || charge?.billing_details?.name || null,
      email: session?.customer_details?.email || charge?.billing_details?.email || null,
      phone: session?.customer_details?.phone || charge?.billing_details?.phone || null,
      address: normalizeAddress(session?.customer_details?.address || charge?.billing_details?.address),
    },
    paymentMethod: normalizePaymentMethod(charge),
    currency,
    lineItems: lineItems.map((item) => normalizeLineItem(item, currency)),
    subtotal: centsToAmount(session?.amount_subtotal),
    total: centsToAmount(session?.amount_total ?? paymentIntent?.amount_received),
    tax: centsToAmount(totalDetails.amount_tax),
    discount: centsToAmount(totalDetails.amount_discount),
    shipping: centsToAmount(totalDetails.amount_shipping),
  };
}
