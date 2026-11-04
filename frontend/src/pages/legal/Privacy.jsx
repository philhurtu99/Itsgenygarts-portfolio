import LegalLayout from './LegalLayout.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { siteConfig } from '../../config/site.js'

const privacyContactEmail = 'info@example.test'

export default function Privacy() {
  const { t, lang } = useLanguage()
  return (
    <LegalLayout title={t('legal.privacy')} lastUpdated="2026-04-19">
      {lang === 'en' ? <PrivacyENSection /> : <PrivacyFRSection />}
    </LegalLayout>
  )
}

export function PrivacyFRSection() {
  return (
    <>
      <h2>1. Responsable du traitement</h2>
      <p>Le traitement des données personnelles est assuré par <strong>{siteConfig.businessName}</strong>, depuis le Québec. Contact : <em>{privacyContactEmail}</em>.</p>

      <h2>2. Données collectées</h2>
      <p>Nous collectons les données suivantes lorsque vous utilisez notre site :</p>
      <ul>
        <li><strong>Compte client :</strong> nom, courriel, mot de passe (chiffré)</li>
        <li><strong>Commandes :</strong> adresse de livraison, téléphone, historique d'achats</li>
        <li><strong>Paiement :</strong> traité par Stripe (nous ne stockons aucune donnée bancaire)</li>
        <li><strong>Navigation :</strong> adresse IP, cookies (voir <a href="/legal/cookies">politique des cookies</a>)</li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>Traiter et livrer vos commandes</li>
        <li>Vous authentifier et sécuriser votre compte</li>
        <li>Vous contacter au sujet de vos commandes</li>
        <li>Respecter nos obligations légales (facturation, comptabilité)</li>
        <li>Améliorer le site (si vous avez consenti aux cookies analytiques)</li>
      </ul>

      <h2>4. Base légale</h2>
      <p>Exécution du contrat de vente (commandes), consentement (cookies non essentiels), obligation légale (conservation comptable) et intérêt légitime (sécurité du site).</p>

      <h2>5. Destinataires</h2>
      <p>Vos données sont transmises uniquement aux prestataires nécessaires :</p>
      <ul>
        <li><strong>Stripe</strong> (traitement des paiements) — <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">politique de Stripe</a></li>
        <li><strong>Cloudinary</strong> (hébergement images)</li>
        {siteConfig.smtpProvider && <li><strong>{siteConfig.smtpProvider}</strong> (envoi d'emails transactionnels)</li>}
        <li><strong>Transporteurs</strong> (livraison)</li>
      </ul>

      <h2>6. Durée de conservation</h2>
      <ul>
        <li>Compte client : tant que le compte est actif + 3 ans après dernière activité</li>
        <li>Commandes et factures : 10 ans (obligation comptable)</li>
        <li>Cookies : voir <a href="/legal/cookies">politique des cookies</a></li>
      </ul>

      <h2>7. Transfert hors Québec ou hors Canada</h2>
      <p>Certains prestataires utilisés sur le site, notamment Stripe et Cloudinary, peuvent traiter des données en dehors du Québec ou du Canada selon leur propre infrastructure technique.</p>

      <h2>8. Vos droits</h2>
      <p>Conformément aux lois applicables au Québec et au Canada, notamment la Loi 25 et la législation canadienne applicable en matière de protection des renseignements personnels, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Accès</strong> : obtenir une copie de vos données</li>
        <li><strong>Rectification</strong> : corriger des données inexactes</li>
        <li><strong>Effacement</strong> : demander la suppression de votre compte</li>
        <li><strong>Opposition</strong> : refuser certains traitements (marketing)</li>
        <li><strong>Portabilité</strong> : récupérer vos données dans un format lisible</li>
        <li><strong>Limitation</strong> : demander la restriction du traitement</li>
      </ul>
      <p>Pour exercer ces droits : <em>{privacyContactEmail}</em>. Nous répondons sous 30 jours.</p>

      <h2>9. Autorité de contrôle</h2>
      <p>Vous pouvez introduire une réclamation auprès de l'autorité compétente :</p>
      <ul>
        <li><strong>Québec :</strong> Commission d'accès à l'information (CAI)</li>
        <li><strong>Canada :</strong> Commissariat à la protection de la vie privée du Canada</li>
      </ul>

      <h2>10. Sécurité</h2>
      <p>Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données : chiffrement HTTPS, hashage des mots de passe (bcrypt), contrôle d'accès, mises à jour de sécurité régulières.</p>

      <h2>11. Modifications</h2>
      <p>Cette politique peut être modifiée. La date de dernière mise à jour est indiquée en haut de cette page.</p>
    </>
  )
}

export function PrivacyENSection() {
  return (
    <>
      <h2>1. Data controller</h2>
      <p>Personal data is controlled by <strong>{siteConfig.businessName}</strong>, from Quebec. Contact: <em>{privacyContactEmail}</em>.</p>

      <h2>2. Data collected</h2>
      <ul>
        <li><strong>Account:</strong> name, email, hashed password</li>
        <li><strong>Orders:</strong> shipping address, phone, order history</li>
        <li><strong>Payment:</strong> handled by Stripe (we do not store card data)</li>
        <li><strong>Browsing:</strong> IP, cookies (see <a href="/legal/cookies">cookie policy</a>)</li>
      </ul>

      <h2>3. Purposes</h2>
      <ul>
        <li>Process and deliver your orders</li>
        <li>Authenticate you and secure your account</li>
        <li>Contact you about your orders</li>
        <li>Comply with legal obligations (invoicing, accounting)</li>
        <li>Improve the site (if you consented to analytics cookies)</li>
      </ul>

      <h2>4. Legal basis</h2>
      <p>Contract performance (orders), consent (non-essential cookies), legal obligation (accounting retention), and legitimate interest (site security).</p>

      <h2>5. Recipients</h2>
      <ul>
        <li><strong>Stripe</strong> (payments) — <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe privacy</a></li>
        <li><strong>Cloudinary</strong> (image hosting)</li>
        {siteConfig.smtpProvider && <li><strong>{siteConfig.smtpProvider}</strong> (transactional email)</li>}
        <li><strong>Shipping carriers</strong> (delivery)</li>
      </ul>

      <h2>6. Retention</h2>
      <ul>
        <li>Account: as long as active + 3 years after last activity</li>
        <li>Orders and invoices: 10 years (accounting obligation)</li>
        <li>Cookies: see <a href="/legal/cookies">cookie policy</a></li>
      </ul>

      <h2>7. Transfers outside Quebec or Canada</h2>
      <p>Some providers used by the site, including Stripe and Cloudinary, may process data outside Quebec or Canada depending on their infrastructure.</p>

      <h2>8. Your rights</h2>
      <p>Under applicable Quebec and Canadian privacy laws, including Quebec Law 25 and the applicable Canadian privacy framework, you have the right to:</p>
      <ul>
        <li>Access a copy of your data</li>
        <li>Rectify inaccurate data</li>
        <li>Erase your account</li>
        <li>Object to certain processing (marketing)</li>
        <li>Portability — receive data in a readable format</li>
        <li>Restrict processing</li>
      </ul>
      <p>To exercise these rights: <em>{privacyContactEmail}</em>. We respond within 30 days.</p>

      <h2>9. Supervisory authority</h2>
      <ul>
        <li>Quebec: Commission d'accès à l'information</li>
        <li>Canada: Office of the Privacy Commissioner of Canada</li>
      </ul>

      <h2>10. Security</h2>
      <p>Technical and organizational measures: HTTPS, bcrypt password hashing, access control, regular security updates.</p>

      <h2>11. Changes</h2>
      <p>This policy may be updated. The last update date is at the top of this page.</p>
    </>
  )
}
