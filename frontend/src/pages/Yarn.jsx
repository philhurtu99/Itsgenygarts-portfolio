import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import ComingSoonAnimation from '../components/ComingSoonAnimation.jsx'

export default function Yarn() {
  const { t } = useLanguage()

  return (
    <div className="page yarn-coming-soon-page">
      <SeoHead title={t('yarn.title')} url="/yarn" description={t('yarn.comingSoon')} />
      <div className="yarn-coming-soon">
        <ComingSoonAnimation label={t('common.comingSoonAnimation')} />
        <h1>{t('yarn.title')}</h1>
        <p>{t('yarn.comingSoon')}</p>
      </div>
    </div>
  )
}
