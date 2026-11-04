import LegalLayout from './LegalLayout.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { siteConfig } from '../../config/site.js'

export default function Mentions() {
  const { t, lang } = useLanguage()
  return (
    <LegalLayout title={t('legal.mentions')} lastUpdated="2026-10-07">
      {lang === 'en' ? <MentionsENSection /> : <MentionsFRSection />}
    </LegalLayout>
  )
}

export function MentionsFRSection() {
  return (
    <>
      <h2>Éditeur du site</h2>
      <p>{siteConfig.businessName}<br /><a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a></p>
      <p>Les coordonnées complètes du commerçant sont présentées à l’étape de vérification de la commande, avant le paiement.</p>
    </>
  )
}

export function MentionsENSection() {
  return (
    <>
      <h2>Site publisher</h2>
      <p>{siteConfig.businessName}<br /><a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a></p>
      <p>The merchant’s full contact details are presented at the order review step, before payment.</p>
    </>
  )
}
