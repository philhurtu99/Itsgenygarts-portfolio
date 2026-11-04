import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'

export default function NotFound() {
  const { t } = useLanguage()
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <SeoHead title={t('notFound.title')} url="/404" noindex />
      <p style={{ fontSize: '5rem', margin: '0 0 0.5rem', lineHeight: 1 }}>🧶</p>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--color-primary)' }}>404</h1>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text)' }}>
        {t('notFound.title')}
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', maxWidth: 380 }}>
        {t('notFound.desc')}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">{t('notFound.home')}</Link>
        <Link to="/products" className="btn btn-secondary">{t('notFound.products')}</Link>
      </div>
    </div>
  )
}
