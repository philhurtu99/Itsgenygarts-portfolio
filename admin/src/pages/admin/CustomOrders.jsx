import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import ImageLightbox from '../../components/ImageLightbox.jsx'
import { formatPhoneForCountry } from '../../utils/phone.js'
import {
  adminGetCustomOrders,
  adminGetCustomOrder,
  adminUpdateOrderStatus,
  adminSendCustomOrderEmail,
} from '../../services/api.js'

const EMAIL_TEMPLATES = [
  {
    label: 'Demande de précision',
    subject: (order) => `Question sur votre commande sur mesure #${order.id}`,
    body: (order) => `Bonjour ${order.customerName},\n\nMerci pour votre demande. J'aurais besoin d'une petite précision avant de continuer :\n\n\nMerci,\n`,
  },
  {
    label: 'Prix proposé',
    subject: (order) => `Prix pour votre commande sur mesure #${order.id}`,
    body: (order) => `Bonjour ${order.customerName},\n\nVotre commande sur mesure est prête à être confirmée. Vous trouverez le montant et le lien de paiement ci-dessous.\n\nMerci,\n`,
  },
  {
    label: 'Suivi de production',
    subject: (order) => `Suivi de votre commande sur mesure #${order.id}`,
    body: (order) => `Bonjour ${order.customerName},\n\nPetit suivi concernant votre commande : elle est maintenant en production. Je vous écrirai dès qu'elle sera prête.\n\nMerci,\n`,
  },
]

const STATUS_LABELS = {
  NEW: 'Nouveau',
  DISCUSSING: 'En discussion',
  AWAITING_PAYMENT: 'En attente de paiement',
  PAID: 'Payé',
  IN_PRODUCTION: 'En production',
  SHIPPED: 'Expédié',
  COMPLETED: 'Terminé',
}
const STATUS_BADGES = {
  NEW: 'badge-blue',
  DISCUSSING: 'badge-yellow',
  AWAITING_PAYMENT: 'badge-yellow',
  PAID: 'badge-green',
  IN_PRODUCTION: 'badge-blue',
  SHIPPED: 'badge-blue',
  COMPLETED: 'badge-green',
}
const ALL_STATUSES = ['NEW', 'DISCUSSING', 'AWAITING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED']

function customFinancials(order) {
  const total = Math.max(0, Number(order?.price || 0))
  const paid = Math.min(total, Math.max(0, Number(order?.amountPaid || 0)))
  return { total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100) }
}

function paymentMethodLabel(method) {
  return {
    CASH: 'Cash',
    E_TRANSFER: 'Interac',
    STRIPE_MANUAL: 'Stripe manuel',
    TAP_TO_PAY: 'Tap to Pay',
    STRIPE_LINK: 'Lien Stripe',
    OTHER: 'Autre',
  }[method] || method
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function OrderDetailModal({ orderId, onClose, onStatusChanged }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [notifyMsg, setNotifyMsg] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [emailPrice, setEmailPrice] = useState('')

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      const data = await adminGetCustomOrder(orderId)
      setOrder(data)
      setError(null)
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true })
      }
    }, 5000)
    return () => window.clearInterval(refresh)
  }, [orderId])

  async function handleStatusChange(newStatus) {
    if (newStatus === order.status) return
    setUpdating(true)
    try {
      await adminUpdateOrderStatus(orderId, newStatus)
      onStatusChanged?.()
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  function handleNotifyClient() {
    setNotifyMsg('Fonctionnalité non implémentée — la notification par email sera disponible prochainement.')
    setTimeout(() => setNotifyMsg(null), 4000)
  }

  function openCompose() {
    setEmailSubject(`Re: Votre commande sur mesure #${orderId}`)
    setEmailBody(`Bonjour ${order?.customerName || ''},\n\n`)
    setEmailPrice('')
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
      const priceVal = emailPrice ? Number(emailPrice) : null
      await adminSendCustomOrderEmail(orderId, { subject: emailSubject, body: emailBody, price: priceVal })
      const msg = priceVal > 0
        ? `Courriel avec lien de paiement envoyé à ${order.customerEmail}`
        : `Courriel envoyé à ${order.customerEmail}`
      setEmailFeedback({ ok: true, msg })
      onStatusChanged?.()
      setTimeout(() => { setComposeOpen(false); setEmailFeedback(null); load() }, 2500)
    } catch (err) {
      setEmailFeedback({ ok: false, msg: err.message })
    } finally {
      setSending(false)
    }
  }

  const colors = order?.selectedColors ? order.selectedColors.split(',').filter(Boolean) : []
  const amounts = customFinancials(order)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <span className="modal-title">Commande #{orderId}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && <Loader label="Chargement..." />}
          {error && <div className="alert alert-error">{error}</div>}
          {order && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGES[order.status] || 'badge-gray'}`} style={{ fontSize: '0.875rem', padding: '0.3rem 0.75rem' }}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
                {order.source === 'MARKET' && <span className="badge badge-yellow">Créée au marché</span>}

                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.875rem', padding: '0.3rem 0.6rem' }}
                  value={order.status}
                  disabled={updating}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {notifyMsg && (
                <div className="alert" style={{ background: '#FFF9C4', border: '1px solid #F0C040', color: '#7A5C00', borderRadius: 'var(--radius)', padding: '0.6rem 1rem', fontSize: '0.875rem' }}>
                  ⚠️ {notifyMsg}
                </div>
              )}

              {/* Client */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Client</h3>
                <div className="detail-panel">
                  <dl>
                    <dt>Nom</dt><dd>{order.customerName || '—'}</dd>
                    <dt>Email</dt><dd>{order.customerEmail || '—'}</dd>
                    <dt>Téléphone</dt><dd>{order.customerPhone ? formatPhoneForCountry(order.customerPhone, order.customerCountry) : '—'}</dd>
                    <dt>Adresse</dt>
                    <dd>
                      {[order.customerAddress, order.customerCity, order.customerProvince, order.customerPostalCode, order.customerCountry]
                        .filter(Boolean).join(', ') || '—'}
                    </dd>
                  </dl>
                </div>
              </div>

              {/* Spécifications */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Spécifications</h3>
                <div className="detail-panel">
                  <dl>
                    <dt>Catégorie</dt><dd>{order.category || '—'}</dd>
                    {(() => {
                      try {
                        const opts = typeof order.selectedOptions === 'string' ? JSON.parse(order.selectedOptions) : order.selectedOptions
                        if (opts && typeof opts === 'object') {
                          return Object.entries(opts).map(([key, val]) => (
                            <span key={key}><dt>{key}</dt><dd>{val}</dd></span>
                          ))
                        }
                      } catch {}
                      return null
                    })()}
                    <dt>Style couleur</dt><dd>{order.colorStyle || '—'}</dd>
                    {colors.length > 0 && (
                      <>
                        <dt>Couleurs</dt>
                        <dd>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {colors.map((c, i) => (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid var(--color-border)', display: 'inline-block' }} />
                                {c}
                              </span>
                            ))}
                          </div>
                        </dd>
                      </>
                    )}
                    {order.colorChangingTheme && <><dt>Thème couleur</dt><dd>{order.colorChangingTheme}</dd></>}
                    {order.rainbowMood && <><dt>Ambiance</dt><dd>{order.rainbowMood}</dd></>}
                    {order.customModelOption && <><dt>Modèle référence</dt><dd>{order.customModelOption.displayName}</dd></>}
                    {order.description && order.description !== '-' && <><dt>Notes</dt><dd>{order.description}</dd></>}
                  </dl>
                </div>
              </div>

              {/* Images de référence */}
              {order.images?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Images de référence</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {order.images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setLightboxIndex(i)}
                        title="Cliquer pour agrandir"
                        style={{ cursor: 'zoom-in', position: 'relative' }}
                      >
                        <img
                          src={img.storagePathOrUrl}
                          alt={`Référence ${i + 1}`}
                          style={{
                            width: 100, height: 100, objectFit: 'cover',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                            display: 'block',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)',
                            background: 'rgba(0,0,0,0)', transition: 'background 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem', color: 'white', opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; e.currentTarget.style.opacity = 1 }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = 0 }}
                        >
                          🔍
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lightboxIndex !== null && order.images?.length > 0 && (
                <ImageLightbox
                  images={order.images}
                  initialIndex={lightboxIndex}
                  onClose={() => setLightboxIndex(null)}
                />
              )}

              {/* Écrire au client */}
              <div>
                {!composeOpen ? (
                  <button className="btn btn-primary btn-sm" onClick={openCompose} disabled={!order.customerEmail}
                    title={!order.customerEmail ? 'Aucun courriel renseigné pour ce client.' : undefined}>
                    ✉️ Écrire au client
                  </button>
                ) : (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', background: 'var(--color-bg-subtle, #fafafa)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.9375rem' }}>✉️ Nouveau courriel</strong>
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
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Objet</label>
                      <input
                        type="text"
                        className="form-input"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Message</label>
                      <textarea
                        className="form-input"
                        rows={7}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        style={{ resize: 'vertical', fontSize: '0.875rem', fontFamily: 'inherit' }}
                      />
                    </div>

                    {emailFeedback && (
                      <div
                        className={`alert ${emailFeedback.ok ? '' : 'alert-error'}`}
                        style={emailFeedback.ok
                          ? { background: '#E8F5E9', border: '1px solid #A5D6A7', color: '#2E7D32', borderRadius: 'var(--radius)', padding: '0.6rem 1rem', fontSize: '0.875rem', marginBottom: '0.75rem' }
                          : { marginBottom: '0.75rem' }}
                      >
                        {emailFeedback.ok ? '✅ ' : '❌ '}{emailFeedback.msg}
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>
                        Montant à facturer <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optionnel — un lien de paiement Stripe sera inclus)</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: 140, fontSize: '0.875rem', padding: '0.3rem 0.6rem' }}
                          value={emailPrice}
                          onChange={(e) => setEmailPrice(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>$ CAD</span>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSendEmail}
                      disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                    >
                      {sending ? 'Envoi...' : emailPrice && Number(emailPrice) > 0 ? '💳 Envoyer avec lien de paiement' : '📤 Envoyer'}
                    </button>
                  </div>
                )}
              </div>

              {/* Paiement info */}
              {amounts.total > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Paiement</h3>
                  <div className="detail-panel">
                    <dl>
                      <dt>Total</dt><dd><strong>{amounts.total.toFixed(2)} $ CAD</strong></dd>
                      <dt>Payé</dt><dd style={{ color: '#2E7D32', fontWeight: 700 }}>{amounts.paid.toFixed(2)} $ CAD</dd>
                      <dt>Solde</dt><dd style={{ color: amounts.balance > 0 ? '#C4607A' : '#2E7D32', fontWeight: 700 }}>{amounts.balance.toFixed(2)} $ CAD</dd>
                      <dt>État</dt><dd>{amounts.balance <= 0 ? 'Payé au complet' : amounts.paid > 0 ? 'Dépôt reçu' : 'Non payé'}</dd>
                    </dl>
                  </div>
                  {order.payments?.filter((payment) => payment.status === 'PAID').length > 0 && (
                    <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.65rem' }}>
                      {order.payments.filter((payment) => payment.status === 'PAID').map((payment) => (
                        <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.84rem' }}>
                          <span>{payment.kind === 'DEPOSIT' ? 'Dépôt' : 'Paiement'} · {paymentMethodLabel(payment.method)}</span>
                          <strong>{Number(payment.amount).toFixed(2)} $</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {amounts.balance > 0 && order.source === 'MARKET' && (
                    <p style={{ margin: '0.65rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                      Le solde peut être encaissé dans Mode marché → Customs.
                    </p>
                  )}
                </div>
              )}

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Créé le {order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleString('fr-CA') : '—'}
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

export default function AdminCustomOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFromUrl = searchParams.get('id')

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      const data = await adminGetCustomOrders()
      setOrders(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true })
      }
    }, 5000)
    return () => window.clearInterval(refresh)
  }, [])

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

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Commandes sur mesure</h1>
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
                    <th>Email</th>
                    <th>Catégorie</th>
                    <th>Prix</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune commande</td></tr>
                  ) : orders.map((o) => (
                    <tr key={o.id} onClick={() => openDetail(o.id)} style={{ cursor: 'pointer' }}>
                      <td className="admin-mobile-hidden" data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>#{o.id}</td>
                      <td data-label="Client" style={{ fontWeight: 600 }}>{o.customerName || '—'}</td>
                      <td data-label="Email" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{o.customerEmail || '—'}</td>
                      <td data-label="Catégorie">{o.category || '—'}</td>
                      <td data-label="Prix" style={{ fontSize: '0.875rem' }}>{o.price ? `${customFinancials(o).paid.toFixed(2)} / ${Number(o.price).toFixed(2)} $` : '—'}</td>
                      <td data-label="Statut">
                        <span className={`badge ${STATUS_BADGES[o.status] || 'badge-gray'}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td data-label="Date" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {o.createdAtUtc ? new Date(o.createdAtUtc).toLocaleDateString('fr-CA') : '—'}
                      </td>
                      <td className="admin-mobile-hidden" data-label="Action">
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(o.id) }}>
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-compact-mobile-list">
              {orders.length === 0 ? (
                <div className="admin-compact-mobile-empty">Aucune commande</div>
              ) : orders.map((o) => (
                <article className="admin-compact-mobile-card is-clickable" key={o.id} onClick={() => openDetail(o.id)}>
                  <div className="admin-compact-mobile-top">
                    <div className="admin-compact-mobile-title">
                      <h2>{o.customerName || '—'}</h2>
                      <p>#{o.id} · {o.category || 'Sur mesure'} · {o.createdAtUtc ? new Date(o.createdAtUtc).toLocaleDateString('fr-CA') : '—'}</p>
                    </div>
                    <div className="admin-compact-mobile-value">{o.price ? `${customFinancials(o).balance.toFixed(2)} $ solde` : '—'}</div>
                  </div>
                  <div className="admin-compact-mobile-meta">
                    <span>Commande custom</span>
                    <div className="admin-compact-mobile-badges">
                      <span className={`badge ${STATUS_BADGES[o.status] || 'badge-gray'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
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
