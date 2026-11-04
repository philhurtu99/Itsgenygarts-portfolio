import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import { formatPhoneForCountry } from '../../utils/phone.js'
import {
  adminGetQuotes,
  adminGetQuote,
  adminUpdateQuoteStatus,
} from '../../services/api.js'

// Backend stores status as capitalized strings: "Pending", "Completed"
const STATUS_LABELS = { Pending: 'En attente', Completed: 'Complété', Cancelled: 'Annulé' }
const STATUS_BADGES = { Pending: 'badge-yellow', Completed: 'badge-green', Cancelled: 'badge-red' }

function QuoteDetailModal({ quoteId, onClose, onStatusChanged }) {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetQuote(quoteId)
      setQuote(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [quoteId])

  async function handleComplete() {
    setUpdating(true)
    try {
      await adminUpdateQuoteStatus(quoteId, 'Completed')
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
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <span className="modal-title">Devis #{quoteId}</span>
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
                {quote.status === 'Pending' && (
                  <button className="btn btn-primary btn-sm" onClick={handleComplete} disabled={updating}>
                    {updating ? '...' : 'Marquer comme complété'}
                  </button>
                )}
              </div>

              {/* Client */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Client</h3>
                <div className="detail-panel">
                  <dl>
                    <dt>Nom</dt><dd>{quote.customerName || '—'}</dd>
                    <dt>Email</dt><dd>{quote.customerEmail || '—'}</dd>
                    <dt>Téléphone</dt><dd>{quote.customerPhone ? formatPhoneForCountry(quote.customerPhone, quote.country) : '—'}</dd>
                    <dt>Adresse</dt>
                    <dd>
                      {[quote.shippingAddress, quote.city, quote.postalCode, quote.country]
                        .filter(Boolean).join(', ') || '—'}
                    </dd>
                    {quote.message && <><dt>Message</dt><dd>{quote.message}</dd></>}
                  </dl>
                </div>
              </div>

              {/* Articles */}
              {quote.items?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Articles</h3>
                  <div className="table-container" style={{ boxShadow: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Prix unitaire</th>
                          <th>Quantité</th>
                          <th>Sous-total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((item, i) => (
                          <tr key={i}>
                            <td data-label="Produit">{item.productName || '—'}</td>
                            <td data-label="Prix unitaire">{item.productPrice != null ? `${Number(item.productPrice).toFixed(2)} $` : '—'}</td>
                            <td data-label="Quantité">{item.quantity}</td>
                            <td data-label="Sous-total" style={{ fontWeight: 700 }}>
                              {item.subtotal != null ? `${Number(item.subtotal).toFixed(2)} $` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: 800, fontSize: '1.0625rem', padding: '0.75rem 1rem', color: 'var(--color-primary)' }}>
                    Total : {Number(quote.totalAmount || 0).toFixed(2)} $
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Créé le {quote.createdAt ? new Date(quote.createdAt).toLocaleString('fr-CA') : '—'}
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

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFromUrl = searchParams.get('id')

  async function load() {
    setLoading(true)
    try {
      const data = await adminGetQuotes()
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
          <h1>Devis</h1>
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
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucun devis</td></tr>
                  ) : quotes.map((q) => (
                    <tr key={q.id} onClick={() => openDetail(q.id)} style={{ cursor: 'pointer' }}>
                      <td className="admin-mobile-hidden" data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>#{q.id}</td>
                      <td data-label="Client" style={{ fontWeight: 600 }}>{q.customerName || '—'}</td>
                      <td data-label="Email" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{q.customerEmail || '—'}</td>
                      <td data-label="Total" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {q.totalAmount != null ? `${Number(q.totalAmount).toFixed(2)} $` : '—'}
                      </td>
                      <td data-label="Statut">
                        <span className={`badge ${STATUS_BADGES[q.status] || 'badge-gray'}`}>
                          {STATUS_LABELS[q.status] || q.status}
                        </span>
                      </td>
                      <td data-label="Date" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {q.createdAt ? new Date(q.createdAt).toLocaleDateString('fr-CA') : '—'}
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
                      <p>#{q.id} · {q.customerEmail || '—'} · {q.createdAt ? new Date(q.createdAt).toLocaleDateString('fr-CA') : '—'}</p>
                    </div>
                    <div className="admin-compact-mobile-value">{q.totalAmount != null ? `${Number(q.totalAmount).toFixed(2)} $` : '—'}</div>
                  </div>
                  <div className="admin-compact-mobile-meta">
                    <span>Devis</span>
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
