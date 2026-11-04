import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import { formatPhoneForCountry } from '../../utils/phone.js'
import { isInPersonMarketOrder } from '../../utils/marketOrders.js'
import {
  adminGetOrders,
  adminGetOrder,
  adminUpdateRegularOrderStatus,
  adminSendRegularOrderEmail,
  adminCreateShippingLabel,
  adminReconcileShippingLabel,
  adminDownloadCommercialInvoice,
  adminDownloadShippingLabel,
} from '../../services/api.js'

const STATUS_LABELS = {
  PAID: 'Payé',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédié',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  PENDING: 'Paiement incomplet',
  PROCESSING: 'En préparation',
}
const STATUS_BADGES = {
  PAID: 'badge-green',
  PREPARING: 'badge-blue',
  SHIPPED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
  PROCESSING: 'badge-blue',
}
const FILTER_STATUSES = ['', 'PAID', 'PREPARING', 'SHIPPED', 'COMPLETED', 'CANCELLED']
const EMAIL_TEMPLATES = [
  {
    label: 'Suivi de commande',
    subject: (order) => `Suivi de votre commande #${order.id}`,
    body: (order) => `Bonjour ${order.customerName},\n\nPetit suivi concernant votre commande #${order.id} :\n\n\nMerci,\n`,
  },
  {
    label: 'Question',
    subject: (order) => `Question sur votre commande #${order.id}`,
    body: (order) => `Bonjour ${order.customerName},\n\nJ'aurais besoin d'une petite précision concernant votre commande #${order.id} :\n\n\nMerci,\n`,
  },
  {
    label: 'Préparation',
    subject: (order) => `Votre commande #${order.id} est en préparation`,
    body: (order) => `Bonjour ${order.customerName},\n\nVotre commande #${order.id} est maintenant en préparation. Je vous écrirai dès qu'elle sera expédiée.\n\nMerci,\n`,
  },
]

function normalizeStatus(status) {
  if (status === 'PROCESSING') return 'PREPARING'
  return status
}

function paymentModeLabel(order) {
  const id = String(order?.stripePaymentId || '')
  const sessionId = String(order?.stripeSessionId || '')
  const source = `${id} ${sessionId}`.toLowerCase()

  if (source.includes('market-bundle-cash') || source.includes('market-cash')) return 'Vente marché - cash'
  if (source.includes('market-bundle-interac') || source.includes('market-interac')) return 'Vente marché - Interac'
  if (source.includes('market-bundle-manual') || source.includes('market-manual')) return 'Vente marché - manuel'
  if (source.includes('tap-to-pay') || id.startsWith('pi_')) return 'Tap to Pay / Stripe Terminal'
  if (source.includes('payment-link') || sessionId.startsWith('cs_')) return 'Lien de paiement Stripe'
  if (id) return 'Stripe'
  return 'Non indiqué'
}

function csvCell(value) {
  const str = value == null ? '' : String(value)
  return `"${str.replace(/"/g, '""')}"`
}

function orderItemsSummary(order) {
  return (order.items || []).map((item) => {
    const variant = item.variantLabelSnapshot ? ` variation ${item.variantLabelSnapshot}` : ''
    const quantity = item.quantity ? ` x${item.quantity}` : ''
    const unitPrice = Number(item.unitPrice || 0).toFixed(2)
    return `${item.productName}${variant}${quantity} (${unitPrice} ${order.currency})`
  }).join(' | ')
}

function downloadOrdersCsv(orders) {
  const headers = [
    'ID',
    'Date',
    'Client',
    'Email',
    'Téléphone',
    'Mode de paiement',
    'Statut',
    'Articles',
    'Sous-total',
    'Livraison',
    'Service de livraison',
    'Suivi inclus',
    'Numéro de suivi',
    'Délai estimé',
    'Total',
    'Devise',
    'Stripe/Référence',
  ]
  const rows = orders.map((order) => [
    order.id,
    new Date(order.createdAt).toLocaleString('fr-CA'),
    order.customerName,
    order.customerEmail,
    order.customerPhone || '',
    paymentModeLabel(order),
    STATUS_LABELS[normalizeStatus(order.status)] || normalizeStatus(order.status),
    orderItemsSummary(order),
    Number(order.subtotal || 0).toFixed(2),
    Number(order.shippingTotal || 0).toFixed(2),
    order.shippingServiceName || '',
    order.shippingTrackingIncluded ? 'Oui' : 'Non',
    order.shippingTrackingNumber || '',
    order.shippingEstimatedDays ? `${order.shippingEstimatedDays} jours ouvrables` : '',
    Number(order.total || 0).toFixed(2),
    order.currency,
    order.stripePaymentId || order.stripeSessionId || '',
  ])
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function OrderDetailModal({ orderId, onClose, onStatusChanged }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [creatingLabel, setCreatingLabel] = useState(false)
  const [recoveryTransactionId, setRecoveryTransactionId] = useState('')
  const [downloadingLabel, setDownloadingLabel] = useState(false)
  const [downloadingCommercialInvoice, setDownloadingCommercialInvoice] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')

  async function load() {
    setLoading(true)
    try {
      const nextOrder = await adminGetOrder(orderId)
      setOrder(nextOrder)
      setTrackingNumber(nextOrder?.shippingTrackingNumber || '')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [orderId])

  async function handleStatus(status) {
    if (status === 'PREPARING') {
      const ok = window.confirm('Marquer cette commande comme en préparation? Un courriel sera envoyé au client.')
      if (!ok) return
    }
    if (status === 'SHIPPED') {
      const ok = window.confirm('Marquer cette commande comme expédiée? Un courriel sera envoyé au client.')
      if (!ok) return
    }
    setUpdating(true)
    try {
      await adminUpdateRegularOrderStatus(
        orderId,
        status,
        status === 'SHIPPED' && order.shippingTrackingIncluded ? trackingNumber.trim() : undefined,
      )
      onStatusChanged?.()
      await load()
    } catch (err) { alert(err.message) }
    finally { setUpdating(false) }
  }

  function openCompose() {
    setEmailSubject(`Re: Votre commande #${orderId}`)
    setEmailBody(`Bonjour ${order?.customerName || ''},\n\n`)
    setEmailFeedback(null)
    setComposeOpen(true)
  }

  function applyEmailTemplate(template) {
    setEmailSubject(template.subject(order))
    setEmailBody(template.body(order))
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSending(true)
    setEmailFeedback(null)
    try {
      await adminSendRegularOrderEmail(orderId, { subject: emailSubject, body: emailBody })
      setEmailFeedback({ ok: true, msg: `Courriel envoyé à ${order.customerEmail}` })
      setTimeout(() => { setComposeOpen(false); setEmailFeedback(null) }, 2200)
    } catch (err) {
      setEmailFeedback({ ok: false, msg: err.message })
    } finally {
      setSending(false)
    }
  }

  async function handleCreateLabel() {
    const ok = window.confirm('Acheter l’étiquette Shippo? Cette action achète officiellement l’étiquette sur le compte Shippo.')
    if (!ok) return
    setCreatingLabel(true)
    try {
      const updated = await adminCreateShippingLabel(orderId)
      setOrder(updated)
      setTrackingNumber(updated?.shippingTrackingNumber || '')
      onStatusChanged?.()
    } catch (err) {
      alert(err.message)
      await load()
    } finally {
      setCreatingLabel(false)
    }
  }

  async function handleReconcileLabel() {
    setCreatingLabel(true)
    try {
      const updated = await adminReconcileShippingLabel(orderId, recoveryTransactionId.trim() || undefined)
      setOrder(updated)
      setTrackingNumber(updated?.shippingTrackingNumber || '')
      onStatusChanged?.()
    } catch (err) {
      alert(err.message)
      await load()
    } finally {
      setCreatingLabel(false)
    }
  }

  async function handleDownloadLabel() {
    setDownloadingLabel(true)
    try {
      await adminDownloadShippingLabel(orderId)
    } catch (err) {
      alert(err.message)
    } finally {
      setDownloadingLabel(false)
    }
  }

  async function handleDownloadCommercialInvoice() {
    setDownloadingCommercialInvoice(true)
    try {
      await adminDownloadCommercialInvoice(orderId)
    } catch (err) {
      alert(err.message)
    } finally {
      setDownloadingCommercialInvoice(false)
    }
  }

  const normalizedStatus = order ? normalizeStatus(order.status) : null
  const marketOrder = isInPersonMarketOrder(order)
  const hasCustomerEmail = Boolean(order?.customerEmail) && !String(order.customerEmail).toLowerCase().endsWith('.local')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <span className="modal-title">Commande #{orderId}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && <Loader label="Chargement..." />}
          {error && <div className="alert alert-error">{error}</div>}
          {order && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Status + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGES[normalizedStatus] || 'badge-gray'}`} style={{ fontSize: '0.875rem', padding: '0.3rem 0.75rem' }}>
                  {marketOrder ? 'Vente complétée' : (STATUS_LABELS[normalizedStatus] || normalizedStatus)}
                </span>
                {marketOrder && (
                  <span className="badge badge-yellow" style={{ fontSize: '0.875rem', padding: '0.3rem 0.75rem' }}>
                    Vente sur place
                  </span>
                )}
                {!marketOrder && normalizedStatus === 'PAID' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleStatus('PREPARING')} disabled={updating}>
                    {updating ? '...' : 'Marquer en préparation'}
                  </button>
                )}
                {!marketOrder && normalizedStatus === 'PREPARING' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleStatus('SHIPPED')} disabled={updating}>
                    {updating ? '...' : 'Marquer expédiée'}
                  </button>
                )}
                {!marketOrder && normalizedStatus === 'SHIPPED' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleStatus('COMPLETED')} disabled={updating}>
                    {updating ? '...' : 'Marquer terminée'}
                  </button>
                )}
                {!marketOrder && normalizedStatus !== 'CANCELLED' && normalizedStatus !== 'COMPLETED' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleStatus('CANCELLED')} disabled={updating}>
                    Annuler
                  </button>
                )}
              </div>

              {/* Écrire au client */}
              {hasCustomerEmail && <div>
                {!composeOpen ? (
                  <button className="btn btn-primary btn-sm" onClick={openCompose}>
                    Écrire au client
                  </button>
                ) : (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', background: 'var(--color-bg-subtle, #fafafa)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.9375rem' }}>Nouveau courriel</strong>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setComposeOpen(false)}
                        style={{ padding: '0.2rem 0.5rem' }}
                      >
                        Annuler
                      </button>
                    </div>

                    <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      À : <strong>{order.customerEmail}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      {EMAIL_TEMPLATES.map((template) => (
                        <button key={template.label} type="button" className="btn btn-secondary btn-sm" onClick={() => applyEmailTemplate(template)}>
                          {template.label}
                        </button>
                      ))}
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">Objet</label>
                      <input
                        type="text"
                        className="form-input"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">Message</label>
                      <textarea
                        className="form-input"
                        rows={7}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>

                    {emailFeedback && (
                      <div
                        className={`alert ${emailFeedback.ok ? '' : 'alert-error'}`}
                        style={emailFeedback.ok
                          ? { background: '#E8F5E9', border: '1px solid #A5D6A7', color: '#2E7D32', borderRadius: 'var(--radius)', padding: '0.6rem 1rem', fontSize: '0.875rem', marginBottom: '0.75rem' }
                          : { marginBottom: '0.75rem' }}
                      >
                        {emailFeedback.msg}
                      </div>
                    )}

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSendEmail}
                      disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                    >
                      {sending ? 'Envoi...' : 'Envoyer'}
                    </button>
                  </div>
                )}
              </div>}

              {/* Client */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Client</h3>
                <div className="detail-panel">
                  <dl>
                    <dt>Nom</dt><dd>{order.customerName}</dd>
                    <dt>Email</dt><dd>{hasCustomerEmail ? order.customerEmail : 'Aucun courriel fourni'}</dd>
                    {order.customerPhone && <><dt>Téléphone</dt><dd>{formatPhoneForCountry(order.customerPhone, order.customerCountry)}</dd></>}
                    <dt>Adresse</dt>
                    <dd>
                      {[order.customerAddress, order.customerCity, order.customerProvince, order.customerPostalCode, order.customerCountry]
                        .filter(Boolean).join(', ')}
                    </dd>
                  </dl>
                </div>
              </div>

              {/* Items */}
              {order.items?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Articles</h3>
                  <div className="table-container" style={{ boxShadow: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Prix unit.</th>
                          <th>Shipping</th>
                          <th>Qté</th>
                          <th>Sous-total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, i) => (
                          <tr key={i}>
                            <td data-label="Produit" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {(item.variantImageUrl || item.productImageUrl) && (
                                <img src={item.variantImageUrl || item.productImageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                              )}
                              <span>
                                {item.productName}
                                {item.variantLabelSnapshot && (
                                  <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    Variation {item.variantLabelSnapshot}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td data-label="Prix unit.">{Number(item.unitPrice).toFixed(2)} {order.currency}</td>
                            <td data-label="Shipping">{Number(item.shippingPrice).toFixed(2)} {order.currency}</td>
                            <td data-label="Qté">{item.quantity}</td>
                            <td data-label="Sous-total" style={{ fontWeight: 700 }}>{Number(item.subtotal).toFixed(2)} {order.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                    <div>Sous-total: <strong>{Number(order.subtotal).toFixed(2)} {order.currency}</strong></div>
                    <div>Livraison: <strong>{Number(order.shippingTotal).toFixed(2)} {order.currency}</strong></div>
                    {order.shippingServiceName && (
                      <div style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}>
                        {order.shippingServiceName}
                        {order.shippingTrackingIncluded ? ' · suivi inclus' : ' · sans suivi'}
                        {order.shippingEstimatedDays ? ` · ${order.shippingEstimatedDays} jours ouvrables` : ''}
                      </div>
                    )}
                    {order.shippingTrackingIncluded && !marketOrder && !order.shippingLabelCreatedAt && (
                      <div className="form-group" style={{ width: '100%', maxWidth: 360, marginTop: '0.75rem', textAlign: 'left' }}>
                        <label className="form-label" htmlFor={`tracking-${order.id}`}>Numéro de suivi</label>
                        <input
                          id={`tracking-${order.id}`}
                          type="text"
                          className="form-input"
                          value={trackingNumber}
                          onChange={(event) => setTrackingNumber(event.target.value)}
                          maxLength={100}
                          autoComplete="off"
                        />
                      </div>
                    )}
                    {order.shippingProvider === 'SHIPPO' && !marketOrder && (
                      <div style={{ width: '100%', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
                        {order.shippingTrackingNumber && order.shippingLabelCreatedAt ? (
                          <>
                            <div style={{ marginBottom: '0.5rem' }}>
                              Suivi: <strong style={{ fontFamily: 'monospace' }}>{order.shippingTrackingNumber}</strong>
                            </div>
                            {order.shippingLabelCreatedAt && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadLabel} disabled={downloadingLabel}>
                                  {downloadingLabel ? 'Téléchargement...' : 'Télécharger l’étiquette'}
                                </button>
                                {String(order.customerCountry || '').trim().toUpperCase() !== 'CA' && (
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadCommercialInvoice} disabled={downloadingCommercialInvoice}>
                                    {downloadingCommercialInvoice ? 'Téléchargement...' : 'Facture commerciale'}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : order.shippingLabelPurchaseStartedAt || order.shippingTransactionId ? (
                          <div style={{ maxWidth: 420, marginLeft: 'auto' }}>
                            <div className="alert alert-error" style={{ textAlign: 'left' }}>Achat en attente de vérification. Aucun nouvel achat ne sera lancé.</div>
                            {!order.shippingTransactionId && (
                              <div className="form-group" style={{ textAlign: 'left' }}>
                                <label className="form-label" htmlFor={`shippo-transaction-${order.id}`}>ID de transaction dans Shippo</label>
                                <input id={`shippo-transaction-${order.id}`} className="form-input" value={recoveryTransactionId} onChange={(e) => setRecoveryTransactionId(e.target.value)} />
                              </div>
                            )}
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleReconcileLabel} disabled={creatingLabel || (!order.shippingTransactionId && !recoveryTransactionId.trim())}>
                              {creatingLabel ? 'Vérification...' : 'Vérifier l’étiquette existante'}
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateLabel} disabled={creatingLabel || !['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(normalizedStatus)}>
                            {creatingLabel ? 'Création...' : 'Acheter l’étiquette Shippo'}
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                      Total: {Number(order.total).toFixed(2)} {order.currency}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment */}
              {(order.stripePaymentId || order.paidAt) && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Paiement</h3>
                  <div className="detail-panel">
                    <dl>
                      {order.stripePaymentId && <><dt>{marketOrder ? 'Référence' : 'Stripe ID'}</dt><dd style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{order.stripePaymentId}</dd></>}
                      {order.paidAt && <><dt>Payé le</dt><dd>{new Date(order.paidAt).toLocaleString('fr-CA')}</dd></>}
                    </dl>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Créé le {new Date(order.createdAt).toLocaleString('fr-CA')}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFromUrl = searchParams.get('id')

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selectedFromUrl) {
      setSelectedId(null)
      return
    }
    const id = Number(selectedFromUrl)
    if (Number.isInteger(id) && id > 0) {
      setSelectedId(id)
    }
  }, [selectedFromUrl])

  function openDetail(id) {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    next.set('id', String(id))
    setSearchParams(next)
  }

  function closeDetail() {
    setSelectedId(null)
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }

  const filtered = filterStatus ? orders.filter((o) => normalizeStatus(o.status) === filterStatus) : orders

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Commandes</h1>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadOrdersCsv(filtered)}
            disabled={filtered.length === 0}
          >
            Exporter CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {FILTER_STATUSES.map((s) => (
            <button
              key={s}
              className={`filter-btn${filterStatus === s ? ' active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s ? STATUS_LABELS[s] : 'Toutes'}
            </button>
          ))}
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="table-container admin-mobile-replaced-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Client</th>
                    <th>Articles</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune commande</td></tr>
                  ) : filtered.map((o) => (
                    <tr key={o.id} onClick={() => openDetail(o.id)} style={{ cursor: 'pointer' }}>
                      <td className="admin-mobile-hidden" data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>#{o.id}</td>
                      <td data-label="Client" style={{ fontWeight: 600 }}>{o.customerName}</td>
                      <td data-label="Articles" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{o.items?.length || 0} article(s)</td>
                      <td data-label="Total" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{Number(o.total).toFixed(2)} {o.currency}</td>
                      <td data-label="Statut">
                        <span className={`badge ${STATUS_BADGES[normalizeStatus(o.status)] || 'badge-gray'}`}>
                          {isInPersonMarketOrder(o) ? 'Vente complétée' : (STATUS_LABELS[normalizeStatus(o.status)] || normalizeStatus(o.status))}
                        </span>
                        {isInPersonMarketOrder(o) && (
                          <span className="badge badge-yellow" style={{ marginLeft: '0.4rem' }}>Vente sur place</span>
                        )}
                      </td>
                      <td data-label="Date" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {new Date(o.createdAt).toLocaleDateString('fr-CA')}
                      </td>
                      <td className="admin-mobile-hidden" data-label="Action">
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(o.id) }}>Voir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-compact-mobile-list">
              {filtered.length === 0 ? (
                <div className="admin-compact-mobile-empty">Aucune commande</div>
              ) : filtered.map((o) => (
                <article className="admin-compact-mobile-card is-clickable" key={o.id} onClick={() => openDetail(o.id)}>
                  <div className="admin-compact-mobile-top">
                    <div className="admin-compact-mobile-title">
                      <h2>{o.customerName}</h2>
                      <p>#{o.id} · {o.items?.length || 0} article(s) · {new Date(o.createdAt).toLocaleDateString('fr-CA')}</p>
                    </div>
                    <div className="admin-compact-mobile-value">{Number(o.total).toFixed(2)} {o.currency}</div>
                  </div>
                  <div className="admin-compact-mobile-meta">
                    <span>Commande</span>
                    <div className="admin-compact-mobile-badges">
                      <span className={`badge ${STATUS_BADGES[normalizeStatus(o.status)] || 'badge-gray'}`}>
                        {isInPersonMarketOrder(o) ? 'Vente complétée' : (STATUS_LABELS[normalizeStatus(o.status)] || normalizeStatus(o.status))}
                      </span>
                      {isInPersonMarketOrder(o) && <span className="badge badge-yellow">Vente sur place</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {selectedId && (
          <OrderDetailModal
            orderId={selectedId}
            onStatusChanged={load}
            onClose={closeDetail}
          />
        )}
      </main>
    </div>
  )
}
