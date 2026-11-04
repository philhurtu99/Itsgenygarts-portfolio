export function isInPersonMarketOrder(order) {
  const paymentId = String(order?.stripePaymentId || '').toLowerCase()
  const sessionId = String(order?.stripeSessionId || '').toLowerCase()
  const email = String(order?.customerEmail || '').toLowerCase()
  const address = String(order?.customerAddress || '').trim().toLowerCase()
  const city = String(order?.customerCity || '').trim().toLowerCase()
  const postalCode = String(order?.customerPostalCode || '').trim().toLowerCase()

  if (paymentId.startsWith('market-')) return true

  const hasPosIdentity = email.endsWith('@pos.local')
    || (address === 'vente en personne' && city === 'marché' && postalCode === 'pos')

  return hasPosIdentity && !sessionId && (paymentId.startsWith('pi_') || Boolean(order?.paidAt))
}
