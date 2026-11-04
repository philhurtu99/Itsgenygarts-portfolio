import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import { localizedName } from '../utils/localizedFields.js'

export default function Cart() {
  const { items, removeFromCart, updateQuantity, cartTotal } = useCart()
  const { formatPrice } = useCurrency()
  const { t, lang } = useLanguage()

  if (items.length === 0) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <SeoHead title={t('cart.title')} url="/cart" noindex />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('cart.empty')}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {t('cart.emptyDesc')}
        </p>
        <Link to="/products" className="btn btn-primary">{t('cart.viewProducts')}</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <SeoHead title={t('cart.title')} url="/cart" noindex />
      <h1 style={{ marginBottom: '2rem' }}>{t('cart.title')}</h1>

      <div className="cart-layout">
        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div
              key={`${item.id}:${item.productVariantId || ''}`}
              className="card"
              style={{ display: 'flex', gap: '1rem', padding: '1rem', boxShadow: 'none', transform: 'none' }}
            >
              {item.mainImageUrl ? (
                <img
                  src={item.mainImageUrl}
                  alt={localizedName(item, lang)}
                  width="80"
                  height="80"
                  loading="lazy"
                  decoding="async"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 80, height: 80, background: 'var(--color-bg-alt)',
                  borderRadius: 'var(--radius-md)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                }}>🧶</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{localizedName(item, lang)}</div>
                {item.variantLabel && (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                    {t('products.variation')} {item.variantLabel}
                  </div>
                )}
                <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {formatPrice(item.price)} {t('products.perUnit')}
                </div>
              </div>

              <div className="cart-item-actions">
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {formatPrice(item.price * item.quantity)}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id, item.productVariantId)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0,
                  }}
                >
                  {t('cart.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="card cart-summary" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.2rem' }}>{t('cart.summary')}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {items.map((item) => (
              <div key={`${item.id}:${item.productVariantId || ''}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                <span>{localizedName(item, lang)}{item.variantLabel ? ` (${t('products.variation')} ${item.variantLabel})` : ''} × {item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
              <span>{t('cart.total')}</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
          </div>

          <Link to="/checkout" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
            {t('cart.checkout')}
          </Link>
          <Link to="/products" className="btn btn-secondary" style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: '0.75rem' }}>
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  )
}
