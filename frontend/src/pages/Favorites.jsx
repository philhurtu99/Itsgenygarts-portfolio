import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { useFavorites } from '../context/FavoriteContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import { sortProductsByAvailability } from '../utils/productAvailability.js'

export default function Favorites() {
  const { items } = useFavorites()
  const { t } = useLanguage()

  return (
    <div className="page">
      <SeoHead title={t('favorites.title')} url="/favorites" noindex />
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.35rem' }}>{t('favorites.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
          {items.length > 0 ? t('favorites.subtitle') : t('favorites.emptyDesc')}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>♡</div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{t('favorites.empty')}</p>
          <Link to="/products" className="btn btn-primary">{t('favorites.browseProducts')}</Link>
        </div>
      ) : (
        <div className="product-grid">
          {sortProductsByAvailability(items).map((product) => (
            <ProductCard
              key={`${product.id}:${product.productVariantId || ''}`}
              product={product}
            />
          ))}
        </div>
      )}
    </div>
  )
}
