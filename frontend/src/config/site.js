const DEFAULT_SITE_URL = 'http://localhost:3000'

function normalizeUrl(url) {
  const normalized = String(url || '').trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(normalized) ? normalized : DEFAULT_SITE_URL
}

function hasPlaceholder(value) {
  const str = String(value || '').trim()
  return !str || str.includes('your-domain.com') || str.startsWith('[')
}

export const siteConfig = {
  siteName: import.meta.env.VITE_SITE_NAME || 'Itsgenygarts',
  siteUrl: normalizeUrl(import.meta.env.VITE_FRONTEND_URL),
  businessName: import.meta.env.VITE_BUSINESS_NAME || 'Itsgenygarts',
  legalName: import.meta.env.VITE_BUSINESS_LEGAL_NAME || import.meta.env.VITE_BUSINESS_NAME || 'Itsgenygarts',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'info@example.test',
  businessAddress: import.meta.env.VITE_BUSINESS_ADDRESS || '123 rue Exemple, Ville Démo, Canada',
  legalForm: import.meta.env.VITE_BUSINESS_LEGAL_FORM || 'Personne physique',
  businessNumber: import.meta.env.VITE_BUSINESS_NUMBER || '',
  vatNumber: import.meta.env.VITE_BUSINESS_VAT_NUMBER || '',
  phone: import.meta.env.VITE_BUSINESS_PHONE || '+1 514-555-0100',
  hostingName: import.meta.env.VITE_HOSTING_NAME || 'Serveur autohébergé',
  hostingAddress: import.meta.env.VITE_HOSTING_ADDRESS || import.meta.env.VITE_BUSINESS_ADDRESS || '[server location]',
  hostingContact: import.meta.env.VITE_HOSTING_CONTACT || import.meta.env.VITE_CONTACT_EMAIL || 'info@example.test',
  smtpProvider: import.meta.env.VITE_SMTP_PROVIDER || '',
  shippingCarrier: import.meta.env.VITE_SHIPPING_CARRIER || 'transporteurs sélectionnés selon la destination',
  siteAuthor: import.meta.env.VITE_SITE_AUTHOR || '',
  photoCredits: import.meta.env.VITE_PHOTO_CREDITS || '',
  governingLaw: import.meta.env.VITE_GOVERNING_LAW || 'droit du Québec et droit fédéral canadien applicable',
}

export const hasLegalConfigGaps = [
  siteConfig.siteUrl,
  siteConfig.businessName,
  siteConfig.legalName,
  siteConfig.contactEmail,
  siteConfig.businessAddress,
  siteConfig.phone,
].some(hasPlaceholder)
