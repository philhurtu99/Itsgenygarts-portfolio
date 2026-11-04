import { useLanguage } from '../context/LanguageContext.jsx'
import { siteConfig } from '../config/site.js'
import { formatPhoneForCountry } from '../utils/phone.js'

export default function MerchantDisclosure() {
  const { t } = useLanguage()
  return (
    <details className="merchant-disclosure">
      <summary>
        {t('checkout.merchantContact')}
        <span className="merchant-disclosure-chevron" aria-hidden="true" />
      </summary>
      <address>
        <strong>{siteConfig.legalName}</strong>
        {siteConfig.legalName !== siteConfig.businessName && <> · {siteConfig.businessName}</>}
        <br />
        {siteConfig.businessAddress}
        <br />
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
        {' · '}
        <a href={`tel:${siteConfig.phone.replace(/[^+\d]/g, '')}`}>{formatPhoneForCountry(siteConfig.phone, 'CA')}</a>
      </address>
    </details>
  )
}
