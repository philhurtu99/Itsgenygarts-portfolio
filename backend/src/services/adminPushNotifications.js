const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(String(token || ''))
    || /^ExpoPushToken\[[^\]]+\]$/.test(String(token || ''));
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function deactivateInvalidTokens(prisma, tokens, tickets = []) {
  const invalidTokens = tickets
    .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[index] : null))
    .filter(Boolean);

  if (!invalidTokens.length) return;
  await prisma.adminPushToken.updateMany({
    where: { token: { in: invalidTokens } },
    data: { isActive: false },
  });
}

export async function sendAdminPushNotification(prisma, {
  title,
  body,
  data = {},
  sound = 'default',
  badge = 1,
}) {
  const rows = await prisma.adminPushToken.findMany({
    where: { isActive: true },
    select: { token: true },
  });

  const tokens = [...new Set(rows.map((row) => row.token).filter(isExpoPushToken))];
  if (!tokens.length) return { sent: 0 };

  let sent = 0;
  for (const tokenChunk of chunk(tokens, 100)) {
    const messages = tokenChunk.map((to) => ({
      to,
      title,
      body,
      data,
      sound,
      badge,
      priority: 'high',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.errors?.[0]?.message || `Expo push failed with HTTP ${response.status}`);
    }

    const tickets = Array.isArray(json.data) ? json.data : [];
    await deactivateInvalidTokens(prisma, tokenChunk, tickets);
    sent += tokenChunk.length;
  }

  return { sent };
}

export function notifyNewCustomOrder(prisma, order) {
  return sendAdminPushNotification(prisma, {
    title: 'Nouvelle commande custom',
    body: `${order.customerName} a envoyé une demande sur mesure #${order.id}.`,
    data: { type: 'custom-order', id: order.id, path: '/custom-orders' },
  });
}

export function notifyNewPersonalizedQuote(prisma, quote) {
  return sendAdminPushNotification(prisma, {
    title: 'Nouveau devis personnalisé',
    body: `${quote.customerName} a envoyé une demande de devis #${quote.id}.`,
    data: { type: 'personalized-quote', id: quote.id, path: '/personalized-quotes' },
  });
}

export function notifyPaidRegularOrder(prisma, order) {
  return sendAdminPushNotification(prisma, {
    title: 'Nouvelle commande payée',
    body: `${order.customerName} a payé la commande #${order.id}. Total: ${Number(order.total).toFixed(2)} ${order.currency || 'CAD'}.`,
    data: { type: 'order', id: order.id, path: '/orders' },
  });
}

export function notifyPaidCustomOrder(prisma, order, payment) {
  const total = Math.max(0, Number(order?.price || 0));
  const paid = Math.min(total, Math.max(0, Number(order?.amountPaid || 0)));
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const amount = Math.max(0, Number(payment?.amount || 0));
  const fullyPaid = balance <= 0.001;
  const deposit = payment?.kind === 'DEPOSIT' && !fullyPaid;

  return sendAdminPushNotification(prisma, {
    title: fullyPaid
      ? 'Commande custom payée'
      : deposit
        ? 'Dépôt custom reçu'
        : 'Paiement custom reçu',
    body: fullyPaid
      ? `${order.customerName} a payé ${amount.toFixed(2)} $ pour la commande custom #${order.id}. Paiement complet.`
      : `${order.customerName} a payé ${amount.toFixed(2)} $ pour la commande custom #${order.id}. Solde: ${balance.toFixed(2)} $.`,
    data: {
      type: 'custom-order-payment',
      id: order.id,
      path: `/custom-orders?id=${order.id}`,
    },
  });
}
