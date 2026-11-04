import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getOrderBySession } from '../services/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import Loader from '../components/Loader.jsx'
import { removeSessionStorage } from '../utils/browserStorage.js'
import SeoHead from '../components/SeoHead.jsx'

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { t } = useLanguage()
  const { clearCart } = useCart()

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    removeSessionStorage('pending_checkout_cancel_token')
    removeSessionStorage('pending_checkout_cart')
    getOrderBySession(sessionId)
      .then((data) => {
        setOrder(data)
        clearCart()
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <SeoHead title={t('confirmation.loading')} url="/order-confirmation" noindex />
        <Loader label={t('confirmation.loading')} />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <SeoHead title={t('confirmation.thankYou')} url="/order-confirmation" noindex />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ marginBottom: '0.5rem' }}>{t('confirmation.thankYou')}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {t('confirmation.thankYouDesc')}
        </p>
        <Link to="/products" className="btn btn-primary">{t('confirmation.backToProducts')}</Link>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <SeoHead title={t('confirmation.confirmed')} url="/order-confirmation" noindex />
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('confirmation.confirmed')}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 0 }}>
          {t('confirmation.order')} <strong>#{order.id}</strong> — {t('confirmation.emailSent')} <strong>{order.customerEmail}</strong>
        </p>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t('confirmation.items')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {order.items?.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {item.productImageUrl ? (
                <img src={item.productImageUrl} alt={item.productName} width="48" height="48" loading="lazy" decoding="async" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 48, height: 48, background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧶</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.productName}</div>
                {item.variantLabelSnapshot && (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {t('products.variation')} {item.variantLabelSnapshot}
                  </div>
                )}
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>× {item.quantity}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                {Number(item.subtotal).toFixed(2)} {order.currency}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('confirmation.subtotal')}</span>
            <span style={{ fontWeight: 600 }}>{Number(order.subtotal).toFixed(2)} {order.currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('confirmation.shipping')}</span>
            <span style={{ fontWeight: 600 }}>{Number(order.shippingTotal).toFixed(2)} {order.currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
            <span>{t('confirmation.total')}</span>
            <span>{Number(order.total).toFixed(2)} {order.currency}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{t('confirmation.deliveryAddress')}</h2>
        <p style={{ fontSize: '0.9rem', margin: 0 }}>
          {[order.customerAddress, order.customerCity, order.customerProvince, order.customerPostalCode, order.customerCountry].filter(Boolean).join(', ')}
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <Link to="/products" className="btn btn-primary">{t('confirmation.continueShopping')}</Link>
      </div>
    </div>
  )
}
