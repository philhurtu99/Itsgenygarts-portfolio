import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext.jsx'
import SeoHead from '../../components/SeoHead.jsx'

export default function LegalLayout({ title, lastUpdated, children }) {
  const { t } = useLanguage()
  const { pathname } = useLocation()

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <SeoHead title={title} url={pathname} noindex />
      <article style={{ minWidth: 0 }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
            {t('legal.nav')}
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{title}</h1>
          {lastUpdated && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t('legal.lastUpdated')} : {lastUpdated}
            </p>
          )}
        </div>
        <div style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
          {children}
        </div>
      </article>
    </div>
  )
}
