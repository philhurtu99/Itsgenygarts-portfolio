import SeoHead from '../components/SeoHead.jsx'
import ComingSoonAnimation from '../components/ComingSoonAnimation.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function CustomOrderComingSoon() {
  const { t } = useLanguage()

  return (
    <div className="page yarn-coming-soon-page">
      <SeoHead
        title={t('customComingSoon.title')}
        description={t('customComingSoon.description')}
        url="/custom-order"
        noindex
      />
      <section className="yarn-coming-soon" aria-labelledby="custom-coming-soon-title">
        <ComingSoonAnimation label={t('common.comingSoonAnimation')} />
        <h1 id="custom-coming-soon-title">{t('customComingSoon.label')}</h1>
        <p>{t('customComingSoon.title')}</p>
      </section>
    </div>
  )
}
