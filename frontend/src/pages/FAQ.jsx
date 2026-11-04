import SeoHead from '../components/SeoHead.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function FAQ() {
  const { t } = useLanguage()
  const items = t('faq.items') || []

  return (
    <div className="page faq-page">
      <SeoHead title={t('faq.title')} url="/faq" description={t('faq.subtitle')} />

      <header className="faq-header">
        <p className="faq-kicker">{t('faq.kicker')}</p>
        <h1>{t('faq.title')}</h1>
        <p>{t('faq.subtitle')}</p>
      </header>

      <div className="faq-list">
        {items.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
