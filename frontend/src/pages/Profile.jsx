import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getCustomerOrders, getCustomerProfile, downloadInvoice, requestDeleteCustomerAccount } from '../services/api.js'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import Loader from '../components/Loader.jsx'
import SeoHead from '../components/SeoHead.jsx'

function formatDate(iso, lang) {
  if (!iso) return '—'
  const locale = lang === 'en' ? 'en-CA' : 'fr-CA'
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function statusBadge(status) {
  const s = String(status || '').toUpperCase()
  const map = {
    PAID: { bg: '#dcfce7', fg: '#166534' },
    PREPARING: { bg: '#dbeafe', fg: '#1e40af' },
    COMPLETED: { bg: '#dcfce7', fg: '#166534' },
    PENDING: { bg: '#fef3c7', fg: '#92400e' },
    NEW: { bg: '#fef3c7', fg: '#92400e' },
    CANCELLED: { bg: '#fee2e2', fg: '#991b1b' },
  }
  const c = map[s] || { bg: 'var(--color-bg-alt)', fg: 'var(--color-text-muted)' }
  return {
    display: 'inline-block',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    background: c.bg,
    color: c.fg,
  }
}

function canDownloadInvoice(order) {
  const status = String(order?.status || '').toUpperCase()
  return Boolean(order?.paidAt) || ['PAID', 'PROCESSING', 'PREPARING', 'SHIPPED', 'COMPLETED'].includes(status)
}

export default function Profile() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { customer, isLoggedIn, logoutCustomer, ready } = useCustomerAuth()
  const { t, lang } = useLanguage()
  const initialTab = ['orders', 'delete'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'info'
  const [tab, setTab] = useState(initialTab)
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState({ orders: [], customOrders: [], personalizedQuotes: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ready) return
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getCustomerProfile(), getCustomerOrders()])
      .then(([p, orders]) => {
        if (cancelled) return
        setProfile(p)
        setData(orders)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [isLoggedIn, ready])

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    if (['orders', 'delete'].includes(nextTab) && nextTab !== tab) {
      setTab(nextTab)
    }
  }, [searchParams, tab])

  if (!ready) {
    return (
      <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <SeoHead title={t('profile.title')} url="/profile" noindex />
        <Loader label={t('profile.loading')} />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: tab === 'info' ? '/profile' : `/profile?tab=${tab}` }} />
  }

  async function handleLogout() {
    await logoutCustomer()
    navigate('/')
  }

  function selectTab(nextTab) {
    setTab(nextTab)
    if (nextTab === 'info') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: nextTab })
    }
  }

  const totalOrders = data.orders.length + data.customOrders.length + data.personalizedQuotes.length

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <SeoHead title={t('profile.title')} url="/profile" noindex />
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{t('profile.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
          {t('profile.hello')}, <strong>{customer?.name}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => selectTab('info')}
          style={{
            padding: '0.75rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
            color: tab === 'info' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === 'info' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          {t('profile.tabInfo')}
        </button>
        <button
          onClick={() => selectTab('orders')}
          style={{
            padding: '0.75rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
            color: tab === 'orders' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === 'orders' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          {t('profile.tabOrders')}{totalOrders > 0 && ` (${totalOrders})`}
        </button>
      </div>

      {loading && <Loader label={t('profile.loading')} />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && tab === 'info' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>{t('profile.accountInfo')}</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <InfoRow label={t('profile.name')} value={profile?.name} />
            <InfoRow label={t('profile.email')} value={profile?.email} />
            <InfoRow
              label={t('profile.emailStatus')}
              value={profile?.emailVerified
                ? <span style={{ color: '#166534', fontWeight: 600 }}>✓ {t('profile.verified')}</span>
                : <span style={{ color: '#92400e', fontWeight: 600 }}>{t('profile.notVerified')}</span>
              }
            />
            <InfoRow label={t('profile.memberSince')} value={formatDate(profile?.createdAt, lang)} />
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '1.5rem', paddingTop: '1.25rem' }}>
            <button className="btn btn-ghost" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'delete' && (
        <DeleteAccountSection t={t} />
      )}

      {!loading && !error && tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {totalOrders === 0 && (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧶</div>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{t('profile.noOrders')}</p>
              <Link to="/products" className="btn btn-primary">{t('profile.browseProducts')}</Link>
            </div>
          )}

          {data.orders.map((o) => (
            <OrderCard key={`o-${o.id}`} type={t('profile.typeOrder')} order={o} lang={lang} t={t} />
          ))}
          {data.customOrders.map((o) => (
            <CustomOrderCard key={`c-${o.id}`} order={o} lang={lang} t={t} />
          ))}
          {data.personalizedQuotes.map((q) => (
            <PersonalizedQuoteCard key={`q-${q.id}`} quote={q} lang={lang} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteAccountSection({ t }) {
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const CONFIRM_WORD = t('profile.deleteConfirmWord') || 'SUPPRIMER'
  const canSubmit = password.length > 0 && confirmText.trim().toUpperCase() === CONFIRM_WORD

  async function handleDeleteRequest() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await requestDeleteCustomerAccount(password)
      setSuccess(result?.message || t('profile.deleteRequestSent'))
      setPassword('')
      setConfirmText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card" style={{ padding: '1.5rem', borderColor: '#fecaca' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#991b1b' }}>
        {t('profile.deleteAccount')}
      </h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        {t('profile.deleteAccountDesc')}
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        {t('profile.deleteEmailNotice')}
      </p>
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          {t('profile.deletePasswordLabel')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)' }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          {t('profile.deleteConfirmLabel').replace('{word}', CONFIRM_WORD)}
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)' }}
          />
        </label>
        {error && <div style={{ color: '#991b1b', fontSize: '0.8125rem' }}>{error}</div>}
        {success && <div style={{ color: '#166534', fontSize: '0.8125rem', fontWeight: 600 }}>{success}</div>}
        <button
          className="btn btn-primary"
          style={{ background: '#dc2626', borderColor: '#dc2626', width: 'fit-content' }}
          disabled={!canSubmit || submitting}
          onClick={handleDeleteRequest}
        >
          {submitting ? t('profile.deleteRequestSending') : t('profile.sendDeleteEmail')}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.95rem' }}>{value || '—'}</span>
    </div>
  )
}

function OrderCard({ type, order, lang, t }) {
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState(null)

  async function handleDownload() {
    setDownloading(true)
    setDlError(null)
    try {
      await downloadInvoice(order.id)
    } catch (err) {
      setDlError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 700 }}>{type}</span>
            <span style={statusBadge(order.status)}>{order.status}</span>
          </div>
          <div style={{ fontWeight: 700 }}>#{order.id}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {formatDate(order.createdAt, lang)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            {Number(order.total).toFixed(2)} {order.currency}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {order.items?.length || 0} {t('profile.articles')}
          </div>
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {item.productImageUrl ? (
                <img src={item.productImageUrl} alt={item.productName} width="40" height="40" loading="lazy" decoding="async" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🧶</div>
              )}
              <div style={{ flex: 1, fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600 }}>{item.productName}</div>
                {item.variantLabelSnapshot && (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {t('products.variation')} {item.variantLabelSnapshot}
                  </div>
                )}
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>× {item.quantity}</div>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {Number(item.subtotal).toFixed(2)} {order.currency}
              </div>
            </div>
          ))}
        </div>
      )}

      {canDownloadInvoice(order) && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? t('profile.downloading') : t('profile.downloadInvoice')}
          </button>
          {dlError && <span style={{ color: 'var(--color-error, #991b1b)', fontSize: '0.8125rem' }}>{dlError}</span>}
        </div>
      )}
    </div>
  )
}

function CustomOrderCard({ order, lang, t }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              {t('profile.typeCustom')}
            </span>
            <span style={statusBadge(order.status)}>{order.status}</span>
          </div>
          <div style={{ fontWeight: 700 }}>#{order.id} — {order.category}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {formatDate(order.createdAtUtc, lang)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            {order.price ? `${Number(order.price).toFixed(2)} CAD` : t('profile.quotePending')}
          </div>
        </div>
      </div>

      {order.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
          {order.description}
        </p>
      )}

      {order.images && order.images.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {order.images.map((img) => (
            <img
              key={img.id}
              src={img.storagePathOrUrl}
              alt=""
              width="60"
              height="60"
              loading="lazy"
              decoding="async"
              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PersonalizedQuoteCard({ quote, lang, t }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              {t('profile.typeQuote')}
            </span>
            <span style={statusBadge(quote.status)}>{quote.status}</span>
          </div>
          <div style={{ fontWeight: 700 }}>#{quote.id}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {formatDate(quote.createdAtUtc, lang)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            {quote.price ? `${Number(quote.price).toFixed(2)} CAD` : t('profile.quotePending')}
          </div>
        </div>
      </div>

      {quote.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.5rem 0 0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
          {quote.description}
        </p>
      )}

      {quote.images && quote.images.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {quote.images.map((img) => (
            <img
              key={img.id}
              src={img.storagePathOrUrl}
              alt=""
              width="60"
              height="60"
              loading="lazy"
              decoding="async"
              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
