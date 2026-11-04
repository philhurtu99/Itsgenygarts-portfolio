import { Helmet } from 'react-helmet-async'
import { siteConfig } from '../config/site.js'

const DEFAULT_IMAGE = '/og-app-icon.jpg?v=4'
const DEFAULT_DESCRIPTION = 'Créations crochet artisanales faites main, pièces uniques et commandes personnalisées.'

function toAbsoluteUrl(value) {
  if (!value) return siteConfig.siteUrl
  if (/^https?:\/\//i.test(value)) return value
  return `${siteConfig.siteUrl}${value.startsWith('/') ? value : `/${value}`}`
}

/**
 * @param {{
 *   title?: string,
 *   description?: string,
 *   image?: string,
 *   url?: string,
 *   type?: string,
 *   noindex?: boolean,
 * }} props
 */
export default function SeoHead({ title, description, image, url, type = 'website', noindex = false }) {
  const fullTitle = title ? `${title} — ${siteConfig.siteName}` : siteConfig.siteName
  const fullUrl = toAbsoluteUrl(url)
  const ogImage = toAbsoluteUrl(image || DEFAULT_IMAGE)
  const metaDescription = description || DEFAULT_DESCRIPTION

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={fullUrl} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={siteConfig.siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={siteConfig.siteName} />
    </Helmet>
  )
}
