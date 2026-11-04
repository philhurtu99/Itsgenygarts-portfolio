import LegalLayout from './LegalLayout.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useCookieConsent } from '../../context/CookieConsentContext.jsx'

export default function Cookies() {
  const { t, lang } = useLanguage()
  const { reopen } = useCookieConsent()

  return (
    <LegalLayout title={t('legal.cookies')} lastUpdated="2026-04-19">
      {lang === 'en' ? <CookiesENSection /> : <CookiesFRSection />}

      <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)' }}>
        <p style={{ marginTop: 0 }}><strong>{t('cookies.managePreferences')}</strong></p>
        <button className="btn btn-primary btn-sm" onClick={reopen}>
          {t('cookies.changePreferences')}
        </button>
      </div>
    </LegalLayout>
  )
}

export function CookiesFRSection() {
  return (
    <>
      <h2>1. Qu'est-ce qu'un cookie ?</h2>
      <p>Un cookie est un petit fichier texte déposé par un site sur votre appareil lors de votre navigation. Il permet de reconnaître votre navigateur, mémoriser vos préférences, ou mesurer l'audience du site.</p>

      <h2>2. Cookies utilisés sur ce site</h2>

      <h3>Cookies essentiels (toujours actifs)</h3>
      <p>Nécessaires au fonctionnement du site. Pas de consentement requis.</p>
      <ul>
        <li><code>auth_customer</code> (HttpOnly), <code>customer_info</code> — authentification de votre compte</li>
        <li><code>cart</code> — mémorisation de votre panier</li>
        <li><code>lang</code> — langue préférée</li>
        <li><code>cookie_consent_v1</code> — votre choix de consentement</li>
      </ul>

      <h3>Cookies analytiques (consentement requis)</h3>
      <p>Nous permettent de mesurer l'audience et améliorer le site. Anonymes.</p>
      <ul>
        <li><em>Aucun cookie analytique déployé actuellement.</em> Si nous en ajoutons (Google Analytics, Plausible, etc.), ils ne seront activés qu'avec votre consentement.</li>
      </ul>

      <h3>Cookies marketing (consentement requis)</h3>
      <p>Permettent de personnaliser la publicité et mesurer l'efficacité des campagnes.</p>
      <ul>
        <li><em>Aucun cookie marketing déployé actuellement.</em></li>
      </ul>

      <h2>3. Cookies tiers</h2>
      <p><strong>Stripe</strong> peut déposer des cookies lors du paiement pour la prévention de la fraude. Voir <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer">politique cookies de Stripe</a>.</p>

      <h2>4. Durée de conservation</h2>
      <p>Les cookies de session expirent à la fermeture du navigateur. Les autres ont une durée maximale de 13 mois (conformément aux recommandations de la CNIL et de la Loi 25).</p>

      <h2>5. Gestion de vos préférences</h2>
      <p>Vous pouvez modifier vos préférences à tout moment via le bouton ci-dessous, ou en supprimant les cookies dans les paramètres de votre navigateur.</p>
      <p>Le refus des cookies non essentiels n'empêche pas l'utilisation du site.</p>
    </>
  )
}

export function CookiesENSection() {
  return (
    <>
      <h2>1. What is a cookie?</h2>
      <p>A cookie is a small text file placed on your device during browsing. It allows a site to recognize your browser, remember preferences, or measure audience.</p>

      <h2>2. Cookies used on this site</h2>

      <h3>Essential cookies (always active)</h3>
      <p>Necessary for the site to function. No consent required.</p>
      <ul>
        <li><code>auth_customer</code> (HttpOnly), <code>customer_info</code> — account authentication</li>
        <li><code>cart</code> — shopping cart persistence</li>
        <li><code>lang</code> — language preference</li>
        <li><code>cookie_consent_v1</code> — your consent choice</li>
      </ul>

      <h3>Analytics cookies (consent required)</h3>
      <p>Help us measure traffic and improve the site. Anonymous.</p>
      <ul>
        <li><em>No analytics cookies currently deployed.</em> If we add any (Google Analytics, Plausible, etc.), they will only activate with your consent.</li>
      </ul>

      <h3>Marketing cookies (consent required)</h3>
      <p>Personalize advertising and measure campaign effectiveness.</p>
      <ul>
        <li><em>No marketing cookies currently deployed.</em></li>
      </ul>

      <h2>3. Third-party cookies</h2>
      <p><strong>Stripe</strong> may set cookies during payment for fraud prevention. See <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer">Stripe's cookie policy</a>.</p>

      <h2>4. Retention</h2>
      <p>Session cookies expire when you close your browser. Others have a maximum duration of 13 months (per CNIL / Quebec Law 25 recommendations).</p>

      <h2>5. Managing your preferences</h2>
      <p>You can change your preferences at any time via the button below, or by deleting cookies in your browser settings. Refusing non-essential cookies does not prevent use of the site.</p>
    </>
  )
}
