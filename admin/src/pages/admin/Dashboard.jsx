import { useEffect, useState, useCallback } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Loader from '../../components/Loader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  adminGetProducts,
  adminGetOrders,
  adminGetCustomOrders,
  adminGetPersonalizedQuotes,
  adminGetAnalyticsOverview,
} from '../../services/api.js'
import { isInPersonMarketOrder } from '../../utils/marketOrders.js'


function NotifDot({ count }) {
  if (!count) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: '#2563EB', color: 'white',
      borderRadius: '999px',
      minWidth: 18, height: 18,
      padding: '0 4px',
      fontSize: '0.6375rem', fontWeight: 700,
      marginLeft: 'auto',
      lineHeight: 1,
      flexShrink: 0,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function isRegularOrderToProcess(order) {
  return order?.status === 'PAID' && !isInPersonMarketOrder(order)
}

function AdminSidebar() {
  const [newRegularOrders, setNewRegularOrders] = useState(0)
  const [newOrders, setNewOrders] = useState(0)
  const [newQuotes, setNewQuotes] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const fetchCounts = useCallback(() => {
    Promise.all([
      adminGetOrders().catch(() => []),
      adminGetCustomOrders().catch(() => []),
      adminGetPersonalizedQuotes().catch(() => []),
    ]).then(([regularOrders, orders, quotes]) => {
      const rList = Array.isArray(regularOrders) ? regularOrders : []
      const oList = Array.isArray(orders) ? orders : []
      const qList = Array.isArray(quotes) ? quotes : []
      setNewRegularOrders(rList.filter(isRegularOrderToProcess).length)
      setNewOrders(oList.filter((o) => o.status === 'NEW').length)
      setNewQuotes(qList.filter((q) => q.status === 'NEW').length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchCounts()
    window.addEventListener('focus', fetchCounts)
    return () => window.removeEventListener('focus', fetchCounts)
  }, [fetchCounts])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  async function handleLogout() {
    await logout()
    setMenuOpen(false)
    navigate('/login', { replace: true })
  }

  const separatorStyle = {
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-muted)',
    padding: '0.75rem 1rem 0.35rem',
    marginTop: '0.25rem',
  }

  return (
    <aside className={`admin-sidebar${menuOpen ? ' menu-open' : ''}`}>
      <div className="admin-mobile-bar">
        <NavLink to="/" onClick={() => setMenuOpen(false)} style={{ color: 'inherit', display: 'flex', alignItems: 'center', minHeight: 44 }}>Admin</NavLink>
        <button
          type="button"
          className="admin-menu-toggle"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <button
        type="button"
        className="admin-menu-backdrop"
        aria-label="Fermer le menu"
        onClick={() => setMenuOpen(false)}
      />

      <nav
        className="admin-nav-panel"
        onClick={(event) => {
          if (event.target.closest('a')) setMenuOpen(false)
        }}
      >
        <div className="admin-sidebar-title">Navigation</div>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          Tableau de bord
        </NavLink>

        <div style={separatorStyle}>Marché</div>
        <NavLink to="/market" className={({ isActive }) => isActive ? 'active' : ''}>
          Mode marché
        </NavLink>

        <div style={separatorStyle}>Gestion</div>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
          Produits
        </NavLink>
        <NavLink to="/yarn" className={({ isActive }) => isActive ? 'active' : ''}>
          Laines
        </NavLink>
        <NavLink to="/custom-order-categories" className={({ isActive }) => isActive ? 'active' : ''}>
          Sur mesure
        </NavLink>
        <NavLink to="/newsletter" className={({ isActive }) => isActive ? 'active' : ''}>
          Infolettre
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>
          Recherche
        </NavLink>

        <div style={separatorStyle}>Commandes</div>
        <NavLink
          to="/orders"
          className={({ isActive }) => isActive ? 'active' : ''}
          style={{ display: 'flex', alignItems: 'center' }}
          onClick={fetchCounts}
        >
          Commandes
          <NotifDot count={newRegularOrders} />
        </NavLink>
        <NavLink
          to="/custom-orders"
          className={({ isActive }) => isActive ? 'active' : ''}
          style={{ display: 'flex', alignItems: 'center' }}
          onClick={fetchCounts}
        >
          Commandes custom
          <NotifDot count={newOrders} />
        </NavLink>
        <NavLink
          to="/personalized-quotes"
          className={({ isActive }) => isActive ? 'active' : ''}
          style={{ display: 'flex', alignItems: 'center' }}
          onClick={fetchCounts}
        >
          Devis personnalisés
          <NotifDot count={newQuotes} />
        </NavLink>

        <div style={separatorStyle}>Session</div>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            textAlign: 'left',
            border: 0,
            background: 'transparent',
            color: 'var(--color-text)',
            padding: '0.75rem 1rem',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Se déconnecter
        </button>
      </nav>
    </aside>
  )
}

export { AdminSidebar }

function statusBadge(status) {
  const map = {
    NEW: 'badge-blue',
    DISCUSSING: 'badge-yellow',
    AWAITING_PAYMENT: 'badge-yellow',
    IN_PROGRESS: 'badge-yellow',
    IN_PRODUCTION: 'badge-blue',
    PREPARING: 'badge-blue',
    COMPLETED: 'badge-green',
    PENDING: 'badge-yellow',
    PAID: 'badge-green',
    SHIPPED: 'badge-green',
    CANCELLED: 'badge-red',
    Pending: 'badge-yellow',
    Completed: 'badge-green',
  }
  const labels = {
    NEW: 'Nouveau',
    DISCUSSING: 'En discussion',
    AWAITING_PAYMENT: 'En attente de paiement',
    IN_PROGRESS: 'En cours',
    IN_PRODUCTION: 'En production',
    PREPARING: 'En préparation',
    COMPLETED: 'Terminé',
    PENDING: 'En attente',
    PAID: 'Payé',
    SHIPPED: 'Expédié',
    CANCELLED: 'Annulé',
    Pending: 'En attente',
    Completed: 'Complété',
  }
  const cls = map[status] || 'badge-gray'
  return <span className={`badge ${cls}`}>{labels[status] || status}</span>
}

const typeBadge = (type) => {
  const conf = {
    order: { cls: 'badge-green', label: 'Commande' },
    custom: { cls: 'badge-blue', label: 'Commande custom' },
    quote: { cls: 'badge-yellow', label: 'Devis' },
  }
  const c = conf[type] || conf.order
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

function MiniBarChart({ title, total, data, valueKey, color, emptyLabel }) {
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey]) || 0))

  return (
    <div className="analytics-card">
      <div className="analytics-card-head">
        <div>
          <h2>{title}</h2>
          <p>{emptyLabel}</p>
        </div>
        <strong>{total}</strong>
      </div>
      <div className="analytics-bars" aria-label={title}>
        {data.map((item) => {
          const value = Number(item[valueKey]) || 0
          const height = Math.max(7, Math.round((value / max) * 100))
          const date = new Date(`${item.date}T00:00:00`)
          return (
            <div className="analytics-bar-cell" key={`${valueKey}-${item.date}`} title={`${item.date}: ${value}`}>
              <div className="analytics-bar-track">
                <span
                  className="analytics-bar-fill"
                  style={{ height: `${height}%`, background: value ? color : 'var(--color-border)' }}
                />
              </div>
              <span>{date.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ products: 0, orders: 0, customOrders: 0, quotes: 0 })
  const [notifications, setNotifications] = useState([])
  const [recent, setRecent] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  function openRecent(item) {
    navigate(`${item._link}?id=${encodeURIComponent(item.id)}`)
  }

  useEffect(() => {
    Promise.all([
      adminGetProducts().catch(() => []),
      adminGetOrders().catch(() => []),
      adminGetCustomOrders().catch(() => []),
      adminGetPersonalizedQuotes().catch(() => []),
      adminGetAnalyticsOverview(14).catch(() => null),
    ]).then(([products, orders, customOrders, personalizedQuotes, analyticsData]) => {
      const pList = Array.isArray(products) ? products : []
      const oList = Array.isArray(orders) ? orders : []
      const cList = Array.isArray(customOrders) ? customOrders : []
      const qList = Array.isArray(personalizedQuotes) ? personalizedQuotes : []
      const paidRegularOrders = oList.filter(isRegularOrderToProcess)
      const newCustomOrders = cList.filter((o) => o.status === 'NEW')
      const newQuotes = qList.filter((q) => q.status === 'NEW')

      setStats({
        products: pList.length,
        orders: oList.length,
        customOrders: cList.length,
        quotes: qList.length,
      })
      setNotifications([
        paidRegularOrders.length
          ? { key: 'orders', count: paidRegularOrders.length, label: 'commande régulière payée à traiter', plural: 'commandes régulières payées à traiter', link: '/orders' }
          : null,
        newCustomOrders.length
          ? { key: 'custom', count: newCustomOrders.length, label: 'commande custom nouvelle', plural: 'commandes custom nouvelles', link: '/custom-orders' }
          : null,
        newQuotes.length
          ? { key: 'quotes', count: newQuotes.length, label: 'devis personnalisé nouveau', plural: 'devis personnalisés nouveaux', link: '/personalized-quotes' }
          : null,
      ].filter(Boolean))

      // Merge all into one recent list
      const all = [
        ...oList.map((o) => ({ ...o, _type: 'order', _date: o.createdAt, _link: '/orders' })),
        ...cList.map((o) => ({ ...o, _type: 'custom', _date: o.createdAtUtc || o.createdAt, _link: '/custom-orders' })),
        ...qList.map((o) => ({ ...o, _type: 'quote', _date: o.createdAtUtc || o.createdAt, _link: '/personalized-quotes' })),
      ]
      all.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0))
      setRecent(all.slice(0, 12))
      setAnalytics(analyticsData)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Tableau de bord</h1>
        </div>

        {loading ? (
          <Loader label="Chargement..." />
        ) : (
          <>
            <div className="stats-grid">
              <NavLink to="/products" className="stat-card stat-card-link">
                <div className="stat-card-label">Produits</div>
                <div className="stat-card-value">{stats.products}</div>
              </NavLink>
              <NavLink to="/orders" className="stat-card stat-card-link">
                <div className="stat-card-label">Commandes</div>
                <div className="stat-card-value">{stats.orders}</div>
              </NavLink>
              <NavLink to="/custom-orders" className="stat-card stat-card-link">
                <div className="stat-card-label">Commandes custom</div>
                <div className="stat-card-value">{stats.customOrders}</div>
              </NavLink>
              <NavLink to="/personalized-quotes" className="stat-card stat-card-link">
                <div className="stat-card-label">Devis</div>
                <div className="stat-card-value">{stats.quotes}</div>
              </NavLink>
            </div>

            {notifications.length > 0 && (
              <section
                className="card"
                aria-label="Notifications admin"
                style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}
              >
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Notifications</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {notifications.map((notification) => (
                    <button
                      key={notification.key}
                      type="button"
                      className="btn-ghost"
                      onClick={() => navigate(notification.link)}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', textAlign: 'left', padding: '0.65rem 0', borderBottom: '1px solid var(--color-border)' }}
                    >
                      <span>{notification.count} {notification.count > 1 ? notification.plural : notification.label}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Ouvrir</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {analytics?.series?.length > 0 && (
              <div className="analytics-grid">
                <MiniBarChart
                  title="Historique des commandes"
                  total={analytics.totalOrders}
                  data={analytics.series}
                  valueKey="orders"
                  color="var(--color-primary)"
                  emptyLabel="14 derniers jours"
                />
                <MiniBarChart
                  title="Visites du site"
                  total={analytics.totalVisits}
                  data={analytics.series}
                  valueKey="visits"
                  color="var(--color-secondary-dark)"
                  emptyLabel="Avec consentement analytics"
                />
              </div>
            )}

            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Récent</h2>
            {recent.length === 0 ? (
              <div className="empty-state">Rien pour l&apos;instant.</div>
            ) : (
              <div>
                <div className="dashboard-recent-mobile">
                  {recent.map((o) => (
                    <button
                      type="button"
                      key={`${o._type}-${o.id}-mobile`}
                      className="dashboard-recent-card"
                      onClick={() => openRecent(o)}
                    >
                      <span className="dashboard-recent-main">
                        <strong>{o.customerName || 'Client'}</strong>
                        <small>#{o.id} · {o._date ? new Date(o._date).toLocaleDateString('fr-CA') : '—'}</small>
                      </span>
                      <span className="dashboard-recent-badges">
                        {typeBadge(o._type)}
                        {statusBadge(o.status)}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="table-container dashboard-recent-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Client</th>
                        <th>Statut</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((o) => (
                        <tr
                          key={`${o._type}-${o.id}`}
                          onClick={() => openRecent(o)}
                          style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-alt)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = ''}
                        >
                          <td className="admin-mobile-hidden" data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>#{o.id}</td>
                          <td data-label="Type">{typeBadge(o._type)}</td>
                          <td data-label="Client">{o.customerName || '—'}</td>
                          <td data-label="Statut">{statusBadge(o.status)}</td>
                          <td data-label="Date" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {o._date ? new Date(o._date).toLocaleDateString('fr-CA') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
