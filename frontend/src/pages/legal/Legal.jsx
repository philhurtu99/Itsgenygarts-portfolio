import SeoHead from '../../components/SeoHead.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { TermsENSection, TermsFRSection } from './Terms.jsx'
import { PrivacyENSection, PrivacyFRSection } from './Privacy.jsx'
import { CookiesENSection, CookiesFRSection } from './Cookies.jsx'
import { ReturnsENSection, ReturnsFRSection } from './Returns.jsx'
import { MentionsENSection, MentionsFRSection } from './Mentions.jsx'

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: '6rem' }}>
      <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

export default function Legal() {
  const { t, lang } = useLanguage()

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <SeoHead title={t('legal.nav')} url="/legal" noindex />

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('legal.nav')}</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
          {t('legal.lastUpdated')} : 2026-10-07
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
        <Section id="terms" title={t('legal.terms')}>
          {lang === 'en' ? <TermsENSection /> : <TermsFRSection />}
        </Section>

        <Section id="privacy" title={t('legal.privacy')}>
          {lang === 'en' ? <PrivacyENSection /> : <PrivacyFRSection />}
        </Section>

        <Section id="cookies" title={t('legal.cookies')}>
          {lang === 'en' ? <CookiesENSection /> : <CookiesFRSection />}
        </Section>

        <Section id="returns" title={t('legal.returns')}>
          {lang === 'en' ? <ReturnsENSection /> : <ReturnsFRSection />}
        </Section>

        <Section id="mentions" title={t('legal.mentions')}>
          {lang === 'en' ? <MentionsENSection /> : <MentionsFRSection />}
        </Section>
      </div>
    </div>
  )
}
