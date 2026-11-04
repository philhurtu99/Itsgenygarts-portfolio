import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import ImageLightbox from '../../components/ImageLightbox.jsx'
import { formatPhoneForCountry } from '../../utils/phone.js'
import {
  adminGetPersonalizedQuotes,
  adminGetPersonalizedQuote,
  adminUpdatePersonalizedQuoteStatus,
  adminSendPersonalizedQuoteEmail,
} from '../../services/api.js'

const EMAIL_TEMPLATES = [
  {
    label: 'Demande de précision',
    subject: (quote) => `Question sur votre devis personnalisé #${quote.id}`,
    body: (quote) => `Bonjour ${quote.customerName},\n\nMerci pour votre demande. J'aurais besoin d'une petite précision avant de préparer le devis :\n\n\nMerci,\n`,
  },
  {
    label: 'Devis prêt',
    subject: (quote) => `Votre devis personnalisé #${quote.id}`,
    body: (quote) => `Bonjour ${quote.customerName},\n\nVotre devis personnalisé est prêt. Vous trouverez le montant et le lien de paiement ci-dessous.\n\nMerci,\n`,
  },
  {
    label: 'Suivi',
    subject: (quote) => `Suivi de votre devis personnalisé #${quote.id}`,
    body: (quote) => `Bonjour ${quote.customerName},\n\nPetit suivi concernant votre demande personnalisée :\n\n\nMerci,\n`,
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

function QuoteDetailModal({ quoteId, onClose, onStatusChanged }) {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [emailPrice, setEmailPrice] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetPersonalizedQuote(quoteId)
      setQuote(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [quoteId])

  function openCompose() {
    setEmailSubject(`Re: Votre devis personnalisé #${quoteId}`)
    setEmailBody(`Bonjour ${quote?.customerName || ''},\n\n`)
    setEmailPrice('')
    setEmailFeedback(null)
    setComposeOpen(true)
  }

  function applyEmailTemplate(template) {
    setEmailSubject(template.subject(quote))
    setEmailBody(template.body(quote))
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSending(true)
    setEmailFeedback(null)
    try {
      const priceVal = emailPrice ? Number(emailPrice) : null
      await adminSendPersonalizedQuoteEmail(quoteId, { subject: emailSubject, body: emailBody, price: priceVal })
      const msg = priceVal > 0
        ? `Courriel avec lien de paiement envoyé à ${quote.customerEmail}`
        : `Courriel envoyé à ${quote.customerEmail}`
      setEmailFeedback({ ok: true, msg })
      onStatusChanged?.()
      setTimeout(() => { setComposeOpen(false); setEmailFeedback(null); load() }, 2500)
    } catch (err) {
      setEmailFeedback({ ok: false, msg: err.message })
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === quote.status) return
    setUpdating(true)
    try {
      await adminUpdatePersonalizedQuoteStatus(quoteId, newStatus)
      onStatusChanged?.()
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <span className="modal-title">Devis personnalisé #{quoteId}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && <Loader label="Chargement..." />}
          {error && <div className="alert alert-error">{error}</div>}
          {quote && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Statut */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGES[quote.status] || 'badge-gray'}`} style={{ fontSize: '0.875rem', padding: '0.3rem 0.75rem' }}>
                  {STATUS_LABELS[quote.status] || quote.status}
                </span>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.875rem', padding: '0.3rem 0.6rem' }}
                  value={quote.status}
                  disabled={updating}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Description</h3>
                <div className="detail-panel">
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{quote.description}</p>
                </div>
              </div>

              {/* Client */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Client</h3>
                <div className="detail-panel">
                  <dl>
                    <dt>Nom</dt><dd>{quote.customerName || '—'}</dd>
                    <dt>Email</dt><dd>{quote.customerEmail || '—'}</dd>
                    <dt>Téléphone</dt><dd>{quote.customerPhone ? formatPhoneForCountry(quote.customerPhone, quote.customerCountry) : '—'}</dd>
                    <dt>Adresse</dt>
                    <dd>
                      {[quote.customerAddress, quote.customerCity, quote.customerProvince, quote.customerPostalCode, quote.customerCountry]
                        .filter(Boolean).join(', ') || '—'}
                    </dd>
                  </dl>
                </div>
              </div>

              {/* Images */}
              {quote.images?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Images de référence</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {quote.images.map((img, i) => (
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
                        <div style={{
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

              {lightboxIndex !== null && quote.images?.length > 0 && (
                <ImageLightbox
                  images={quote.images}
                  initialIndex={lightboxIndex}
                  onClose={() => setLightboxIndex(null)}
                />
              )}

              {/* Bouton écrire au client */}
              <div>
                {!composeOpen ? (
                  <button className="btn btn-primary btn-sm" onClick={openCompose}>
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
                      À : <strong>{quote.customerEmail}</strong>
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
                        style={emailFeedback.ok ? { background: '#E8F5E9', border: '1px solid #A5D6A7', color: '#2E7D32', borderRadius: 'var(--radius)', padding: '0.6rem 1rem', fontSize: '0.875rem', marginBottom: '0.75rem' } : { marginBottom: '0.75rem' }}
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
              {quote.price && Number(quote.price) > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius)',
                  background: quote.paidAt ? '#E8F5E9' : '#FFF8E1',
                  border: `1px solid ${quote.paidAt ? '#A5D6A7' : '#FFE082'}`,
                  fontSize: '0.875rem',
                }}>
                  <strong>{Number(quote.price).toFixed(2)} $</strong>
                  {quote.paidAt ? (
                    <span style={{ color: '#2E7D32' }}>Payé le {new Date(quote.paidAt).toLocaleString('fr-CA')}</span>
                  ) : (
                    <span style={{ color: '#F57F17' }}>En attente de paiement</span>
                  )}
                </div>
              )}

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Reçu le {quote.createdAtUtc ? new Date(quote.createdAtUtc).toLocaleString('fr-CA') : '—'}
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

export default function AdminPersonalizedQuotes() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFromUrl = searchParams.get('id')

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetPersonalizedQuotes()
      setQuotes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Devis personnalisés</h1>
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
                    <th>Description</th>
                    <th>Prix</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucun devis</td></tr>
                  ) : quotes.map((q) => (
                    <tr key={q.id} onClick={() => openDetail(q.id)} style={{ cursor: 'pointer' }}>
                      <td className="admin-mobile-hidden" data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>#{q.id}</td>
                      <td data-label="Client" style={{ fontWeight: 600 }}>{q.customerName || '—'}</td>
                      <td data-label="Email" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{q.customerEmail || '—'}</td>
                      <td data-label="Description" style={{ fontSize: '0.875rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.description || '—'}
                      </td>
                      <td data-label="Prix" style={{ fontSize: '0.875rem' }}>{q.price ? `${Number(q.price).toFixed(2)} $` : '—'}</td>
                      <td data-label="Statut">
                        <span className={`badge ${STATUS_BADGES[q.status] || 'badge-gray'}`}>
                          {STATUS_LABELS[q.status] || q.status}
                        </span>
                      </td>
                      <td data-label="Date" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {q.createdAtUtc ? new Date(q.createdAtUtc).toLocaleDateString('fr-CA') : '—'}
                      </td>
                      <td className="admin-mobile-hidden" data-label="Action">
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(q.id) }}>
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-compact-mobile-list">
              {quotes.length === 0 ? (
                <div className="admin-compact-mobile-empty">Aucun devis</div>
              ) : quotes.map((q) => (
                <article className="admin-compact-mobile-card is-clickable" key={q.id} onClick={() => openDetail(q.id)}>
                  <div className="admin-compact-mobile-top">
                    <div className="admin-compact-mobile-title">
                      <h2>{q.customerName || '—'}</h2>
                      <p>#{q.id} · {(q.description || 'Devis personnalisé').slice(0, 58)}{(q.description || '').length > 58 ? '...' : ''}</p>
                    </div>
                    <div className="admin-compact-mobile-value">{q.price ? `${Number(q.price).toFixed(2)} $` : '—'}</div>
                  </div>
                  <div className="admin-compact-mobile-meta">
                    <span>{q.createdAtUtc ? new Date(q.createdAtUtc).toLocaleDateString('fr-CA') : '—'}</span>
                    <div className="admin-compact-mobile-badges">
                      <span className={`badge ${STATUS_BADGES[q.status] || 'badge-gray'}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {selectedId && (
          <QuoteDetailModal
            quoteId={selectedId}
            onStatusChanged={load}
            onClose={closeDetail}
          />
        )}
      </main>
    </div>
  )
}
