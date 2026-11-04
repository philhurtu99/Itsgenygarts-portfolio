import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import {
  adminAdvancedSearchDatabase,
  adminCreateNote,
  adminGetCustomerProfile,
  adminGetTimeline,
} from '../../services/api.js'

const TYPE_LINKS = {
  order: '/orders',
  customOrder: '/custom-orders',
  personalizedQuote: '/personalized-quotes',
  quoteRequest: '/quotes',
}

const TYPE_LABELS = {
  all: 'Tous',
  order: 'Commandes',
  customOrder: 'Commandes custom',
  personalizedQuote: 'Devis personnalisés',
  quoteRequest: 'Paniers devis',
}

const STATUS_LABELS = {
  NEW: 'Nouveau',
  DISCUSSING: 'En discussion',
  AWAITING_PAYMENT: 'Paiement attendu',
  IN_PROGRESS: 'En cours',
  IN_PRODUCTION: 'En production',
  PREPARING: 'En préparation',
  PAID: 'Payé',
  SHIPPED: 'Expédié',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  PENDING: 'En attente',
  Pending: 'En attente',
  Completed: 'Complété',
}

const STATUS_BADGES = {
  NEW: 'badge-blue',
  DISCUSSING: 'badge-yellow',
  AWAITING_PAYMENT: 'badge-yellow',
  IN_PROGRESS: 'badge-yellow',
  IN_PRODUCTION: 'badge-blue',
  PREPARING: 'badge-blue',
  PAID: 'badge-green',
  SHIPPED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
  Pending: 'badge-yellow',
  Completed: 'badge-green',
}

function statusBadge(status) {
  if (!status) return <span className="badge badge-gray">Sans statut</span>
  return <span className={`badge ${STATUS_BADGES[status] || 'badge-gray'}`}>{STATUS_LABELS[status] || status}</span>
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(transaction) {
  if (transaction.amount === null || transaction.amount === undefined) return '-'
  return `${Number(transaction.amount).toFixed(2)} ${transaction.currency || 'CAD'}`
}

function formatShortDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('fr-CA', {
    month: '2-digit',
    day: '2-digit',
  })
}

function smallBadge(label, className = 'badge-gray') {
  return <span className={`badge ${className}`}>{label}</span>
}

function transactionTypeBadge(transaction) {
  const typeClasses = {
    order: 'badge-green',
    customOrder: 'badge-blue',
    personalizedQuote: 'badge-yellow',
    quoteRequest: 'badge-gray',
  }
  return smallBadge(transaction.label || 'Transaction', typeClasses[transaction.type] || 'badge-gray')
}

function csvEscape(value) {
  const str = String(value ?? '')
  return `"${str.replace(/"/g, '""')}"`
}

function NotesPanel({ entityType, entityId, initialNotes = [], onCreated }) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setNotes(initialNotes), [initialNotes])

  async function saveNote() {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    try {
      const note = await adminCreateNote(entityType, entityId, text)
      setNotes((current) => [note, ...current])
      setBody('')
      onCreated?.(note)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="detail-panel">
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Notes internes</h3>
      <textarea
        className="form-textarea"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ajouter une note privée..."
      />
      <button className="btn btn-primary btn-sm" type="button" onClick={saveNote} disabled={saving || !body.trim()} style={{ marginTop: '0.5rem' }}>
        {saving ? 'Ajout...' : 'Ajouter'}
      </button>
      <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
        {notes.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Aucune note.</p>
        ) : notes.map((note) => (
          <div key={note.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.65rem' }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{note.body}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{formatDate(note.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomerModal({ customerId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    adminGetCustomerProfile(customerId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [customerId])

  const customer = data?.customer

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <span className="modal-title">Fiche client #{customerId}</span>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          {loading && <Loader label="Chargement..." />}
          {error && <div className="alert alert-error">{error}</div>}
          {customer && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card"><div className="stat-card-label">Total payé</div><div className="stat-card-value">{Number(data.stats.paidTotal).toFixed(2)} $</div></div>
                <div className="stat-card"><div className="stat-card-label">Transactions</div><div className="stat-card-value">{data.stats.transactionCount}</div></div>
                <div className="stat-card"><div className="stat-card-label">Panier</div><div className="stat-card-value">{data.stats.cartItems}</div></div>
                <div className="stat-card"><div className="stat-card-label">Favoris</div><div className="stat-card-value">{data.stats.favoriteItems}</div></div>
              </div>

              <div className="detail-panel">
                <dl>
                  <dt>Nom</dt><dd>{customer.name}</dd>
                  <dt>Email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd>
                  <dt>Compte</dt><dd>{customer.isActive ? 'Actif' : 'Inactif'}</dd>
                  <dt>Email valide</dt><dd>{customer.emailVerified ? 'Oui' : 'Non'}</dd>
                  <dt>Infolettre</dt><dd>{customer.newsletterConsent ? 'Oui' : 'Non'}</dd>
                  <dt>Dernière activité</dt><dd>{formatDate(data.stats.lastActivityAt)}</dd>
                </dl>
              </div>

              <NotesPanel entityType="customer" entityId={customer.id} initialNotes={data.notes || []} />

              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Transactions</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>ID</th><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
                    <tbody>
                      {data.transactions.map((item) => (
                        <tr key={`${item.type}-${item.id}`}>
                          <td>#{item.id}</td>
                          <td>{item.label}</td>
                          <td>{formatAmount(item)}</td>
                          <td>{statusBadge(item.status)}</td>
                          <td>{formatDate(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineModal({ transaction, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    adminGetTimeline(transaction.type, transaction.id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [transaction])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <span className="modal-title">Timeline {transaction.label} #{transaction.id}</span>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          {loading && <Loader label="Chargement..." />}
          {error && <div className="alert alert-error">{error}</div>}
          {data && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div className="detail-panel">
                {(data.events || []).length === 0 ? <p>Aucun événement.</p> : data.events.map((item, index) => (
                  <div key={`${item.label}-${index}`} style={{ borderLeft: '3px solid var(--color-primary)', padding: '0 0 1rem 1rem' }}>
                    <strong>{item.label}</strong>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{formatDate(item.at)}</div>
                    {item.amount != null && <div>{Number(item.amount).toFixed(2)} {item.currency}</div>}
                  </div>
                ))}
              </div>
              <NotesPanel entityType={transaction.type} entityId={transaction.id} initialNotes={data.notes || []} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminSearch() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ q: '', type: 'all', status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '' })
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [results, setResults] = useState({ customers: [], transactions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customerId, setCustomerId] = useState(null)
  const [timelineTransaction, setTimelineTransaction] = useState(null)

  const summary = useMemo(() => {
    const paidTotal = results.transactions
      .filter((item) => item.paidAt || ['PAID', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(item.status))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    return { customers: results.customers.length, transactions: results.transactions.length, paidTotal }
  }, [results])

  async function load(nextFilters = filters) {
    setLoading(true)
    setError(null)
    try {
      const data = await adminAdvancedSearchDatabase({ ...nextFilters, limit: 50 })
      setSubmittedQuery(nextFilters.q?.trim() || '')
      setResults({
        customers: Array.isArray(data.customers) ? data.customers : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ ...filters, q: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    load(filters)
  }

  function clearSearch() {
    const next = { q: '', type: 'all', status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '' }
    setFilters(next)
    load(next)
  }

  function exportCsv() {
    const rows = [
      ['Type', 'ID', 'Client', 'Email', 'Montant', 'Statut', 'Stripe', 'Date'],
      ...results.transactions.map((item) => [
        item.label,
        item.id,
        item.customerName,
        item.customerEmail,
        formatAmount(item),
        STATUS_LABELS[item.status] || item.status || '',
        item.stripePaymentId || item.stripeSessionId || '',
        formatDate(item.createdAt),
      ]),
    ]
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recherche-admin-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <div>
            <h1>Recherche</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
              Clients, emails, commandes, montants, statuts et références Stripe.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="admin-search-panel">
          <input className="form-input" type="search" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Email, nom, ID, ID Stripe..." aria-label="Recherche admin" />
          <select className="form-select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="form-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input className="form-input" type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
          <input className="form-input" type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
          <input className="form-input" type="number" min="0" step="0.01" value={filters.minAmount} onChange={(e) => setFilter('minAmount', e.target.value)} placeholder="Montant min" />
          <input className="form-input" type="number" min="0" step="0.01" value={filters.maxAmount} onChange={(e) => setFilter('maxAmount', e.target.value)} placeholder="Montant max" />
          <button className="btn btn-primary" type="submit" disabled={loading}>Rechercher</button>
          <button className="btn btn-secondary" type="button" onClick={clearSearch} disabled={loading}>Récent</button>
          <button className="btn btn-secondary" type="button" onClick={exportCsv} disabled={loading || results.transactions.length === 0}>CSV</button>
        </form>

        {submittedQuery && <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Résultats pour <strong>{submittedQuery}</strong></p>}
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Loader label="Recherche..." /> : (
          <>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-card-label">Clients</div><div className="stat-card-value">{summary.customers}</div></div>
              <div className="stat-card"><div className="stat-card-label">Transactions</div><div className="stat-card-value">{summary.transactions}</div></div>
              <div className="stat-card"><div className="stat-card-label">Total payé affiché</div><div className="stat-card-value">{summary.paidTotal.toFixed(2)} $</div></div>
            </div>

            <div className="admin-section-header"><h2 style={{ fontSize: '1.125rem' }}>Clients</h2></div>
            <div className="admin-search-mobile-list">
              {results.customers.length === 0 ? (
                <div className="admin-search-mobile-empty">Aucun client trouvé.</div>
              ) : results.customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="dashboard-recent-card admin-search-mobile-card"
                  onClick={() => setCustomerId(customer.id)}
                >
                  <span className="dashboard-recent-main">
                    <strong>{customer.name || customer.email || `Client #${customer.id}`}</strong>
                    <small>#{customer.id} · {customer.email || 'Sans email'}</small>
                  </span>
                  <span className="dashboard-recent-badges">
                    {smallBadge(customer.isActive ? 'Actif' : 'Inactif', customer.isActive ? 'badge-green' : 'badge-red')}
                    {customer.emailVerified && smallBadge('Email ok', 'badge-blue')}
                    {customer.newsletterConsent && smallBadge('Infolettre', 'badge-yellow')}
                  </span>
                </button>
              ))}
            </div>
            <div className="table-container admin-search-table" style={{ marginBottom: '2rem' }}>
              <table>
                <thead><tr><th>ID</th><th>Nom</th><th>Email</th><th>Compte</th><th>Email validé</th><th>Infolettre</th><th>Action</th></tr></thead>
                <tbody>
                  {results.customers.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucun client trouvé.</td></tr>
                  ) : results.customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>#{customer.id}</td>
                      <td style={{ fontWeight: 700 }}>{customer.name}</td>
                      <td><a href={`mailto:${customer.email}`}>{customer.email}</a></td>
                      <td>{customer.isActive ? statusBadge('COMPLETED') : statusBadge('CANCELLED')}</td>
                      <td>{customer.emailVerified ? statusBadge('COMPLETED') : statusBadge('PENDING')}</td>
                      <td>{customer.newsletterConsent ? 'Oui' : 'Non'}</td>
                      <td><button className="btn btn-secondary btn-sm" type="button" onClick={() => setCustomerId(customer.id)}>Fiche</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-section-header"><h2 style={{ fontSize: '1.125rem' }}>Transactions</h2></div>
            <div className="admin-search-mobile-list">
              {results.transactions.length === 0 ? (
                <div className="admin-search-mobile-empty">Aucune transaction trouvée.</div>
              ) : results.transactions.map((transaction) => (
                <button
                  key={`${transaction.type}-${transaction.id}`}
                  type="button"
                  className="dashboard-recent-card admin-search-mobile-card"
                  onClick={() => setTimelineTransaction(transaction)}
                >
                  <span className="dashboard-recent-main">
                    <strong>{transaction.customerName || transaction.customerEmail || transaction.label || 'Transaction'}</strong>
                    <small>#{transaction.id} · {formatShortDate(transaction.createdAt)}</small>
                  </span>
                  <span className="dashboard-recent-badges admin-search-mobile-badges">
                    {transactionTypeBadge(transaction)}
                    {statusBadge(transaction.status)}
                    <span className="admin-search-mobile-amount">{formatAmount(transaction)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="table-container admin-search-table">
              <table>
                <thead><tr><th>ID</th><th>Type</th><th>Client</th><th>Email</th><th>Montant</th><th>Statut</th><th>Stripe</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {results.transactions.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Aucune transaction trouvée.</td></tr>
                  ) : results.transactions.map((transaction) => (
                    <tr key={`${transaction.type}-${transaction.id}`}>
                      <td>#{transaction.id}</td>
                      <td>{transaction.label}</td>
                      <td style={{ fontWeight: 700 }}>{transaction.customerName}</td>
                      <td><a href={`mailto:${transaction.customerEmail}`}>{transaction.customerEmail}</a></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatAmount(transaction)}</td>
                      <td>{statusBadge(transaction.status)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{transaction.stripePaymentId || transaction.stripeSessionId || '-'}</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatDate(transaction.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTimelineTransaction(transaction)}>Timeline</button>
                          {TYPE_LINKS[transaction.type] && <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(TYPE_LINKS[transaction.type])}>Ouvrir</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {customerId && <CustomerModal customerId={customerId} onClose={() => setCustomerId(null)} />}
        {timelineTransaction && <TimelineModal transaction={timelineTransaction} onClose={() => setTimelineTransaction(null)} />}
      </main>
    </div>
  )
}
