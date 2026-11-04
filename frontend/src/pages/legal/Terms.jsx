import LegalLayout from './LegalLayout.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { siteConfig } from '../../config/site.js'

export default function Terms() {
  const { t, lang } = useLanguage()
  return (
    <LegalLayout title={t('legal.terms')} lastUpdated="2026-10-07">
      {lang === 'en' ? <TermsENSection /> : <TermsFRSection />}
    </LegalLayout>
  )
}

export function TermsFRSection() {
  const { t } = useLanguage()
  return (
    <>
      <h2>1. Objet</h2>
      <p>Les présentes conditions générales de vente (CGV) régissent toute commande passée sur le site <strong>{siteConfig.businessName}</strong>, accessible à l'adresse <em>{siteConfig.siteUrl}</em>. Les coordonnées du commerçant sont présentées à l’étape de vérification de la commande, avant le paiement.</p>

      <h2>2. Produits</h2>
      <p>Les produits proposés sont des articles de crochet artisanaux, faits main. Les photos sont non contractuelles : chaque pièce étant unique, des variations peuvent exister. Le stock disponible est indiqué en temps réel sur la fiche produit.</p>

      <h2>3. Commande</h2>
      <p>Toute commande implique l'acceptation sans réserve des présentes CGV. Le client reconnaît en avoir pris connaissance avant validation du paiement.</p>
      <p>Les commandes sur mesure font l'objet d'un devis préalable et ne sont confirmées qu'après réception du paiement intégral.</p>

      <h2>4. Prix</h2>
      <p>Les prix sont affichés dans la devise sélectionnée par le client. Les frais de livraison sont indiqués avant la validation définitive.</p>

      <h2>5. Paiement</h2>
      <p>Le paiement s'effectue en ligne via Stripe (cartes Visa, Mastercard, American Express). Aucune donnée bancaire n'est stockée sur nos serveurs. Une facture est automatiquement envoyée par courriel après confirmation du paiement.</p>

      <h2>6. Livraison</h2>
      <p>Les commandes sont préparées dans un délai de 3 à 10 jours ouvrables (hors commandes sur mesure, délai indiqué au devis). La livraison est assurée par <em>{siteConfig.shippingCarrier}</em>. Les délais varient selon la destination et le mode d’expédition retenu.</p>
      <p>Les risques liés au transport sont transférés au client dès la remise au transporteur.</p>
      <h3>Livraisons internationales et douanes</h3>
      <p>{t('checkout.importFeesNotice')}</p>
      <p>Le montant de ces frais est déterminé par les autorités douanières et le transporteur selon la réglementation applicable. Cette information ne limite pas vos droits légaux ni les obligations légales de {siteConfig.businessName}.</p>

      <h2>7. Droit de rétractation</h2>
      <p>Les retours sont encadrés par notre <a href="/legal/returns">politique de retours</a>. Les articles sur mesure, personnalisés ou fabriqués spécialement à la demande ne sont pas retournables, sauf défaut de conformité.</p>

      <h2>8. Garanties</h2>
      <p>Les produits bénéficient des garanties légales applicables au Québec et au Canada, notamment en cas de défaut de conformité ou de vice caché selon la législation applicable.</p>

      <h2>9. Responsabilité</h2>
      <p>La responsabilité de <strong>{siteConfig.legalName}</strong> est limitée au prix du produit commandé. Aucune responsabilité ne pourra être engagée en cas de dommages indirects.</p>

      <h2>10. Propriété intellectuelle</h2>
      <p>L'ensemble du contenu du site (photos, textes, logos, designs) est la propriété exclusive de <strong>{siteConfig.legalName}</strong>. Toute reproduction est interdite sans autorisation écrite.</p>

      <h2>11. Protection des données</h2>
      <p>Voir notre <a href="/legal/privacy">Politique de confidentialité</a>.</p>

      <h2>12. Droit applicable et litiges</h2>
      <p>Les présentes CGV sont soumises au droit <em>{siteConfig.governingLaw}</em>. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. À défaut, les tribunaux compétents seront ceux du siège de l'entreprise.</p>

      <h2>13. Contact</h2>
      <p>Pour toute question : <em>{siteConfig.contactEmail}</em>.</p>
    </>
  )
}

export function TermsENSection() {
  const { t } = useLanguage()
  return (
    <>
      <h2>1. Purpose</h2>
      <p>These Terms of Sale govern any order placed on <strong>{siteConfig.businessName}</strong>, accessible at <em>{siteConfig.siteUrl}</em>. The merchant’s contact details are presented at the order review step, before payment.</p>

      <h2>2. Products</h2>
      <p>The products offered are handmade crochet items. Photos are non-contractual: as each piece is unique, slight variations may occur. Available stock is shown in real time on each product page.</p>

      <h2>3. Order</h2>
      <p>Any order implies unreserved acceptance of these Terms. Custom orders require a prior quote and are only confirmed after full payment is received.</p>

      <h2>4. Pricing</h2>
      <p>Prices are displayed in the currency selected by the customer. Shipping fees are shown before final confirmation.</p>

      <h2>5. Payment</h2>
      <p>Payment is processed online via Stripe (Visa, Mastercard, American Express). No banking information is stored on our servers. An invoice is automatically sent by email after payment confirmation.</p>

      <h2>6. Delivery</h2>
      <p>Orders are prepared within 3–10 business days (excluding custom orders — timeframe stated in quote). Delivery is handled by <em>{siteConfig.shippingCarrier}</em>. Delivery times vary depending on destination and shipping method.</p>
      <p>Risks during transport transfer to the customer upon handover to the carrier.</p>
      <h3>International deliveries and customs</h3>
      <p>{t('checkout.importFeesNotice')}</p>
      <p>These charges are determined by customs authorities and the carrier under applicable regulations. This information does not limit your statutory rights or the legal obligations of {siteConfig.businessName}.</p>

      <h2>7. Right of withdrawal</h2>
      <p>Returns are governed by our <a href="/legal/returns">Returns Policy</a>. Custom-made, personalized, or made-to-order items are non-returnable except in case of defect or non-conformity.</p>

      <h2>8. Warranties</h2>
      <p>Products are covered by the legal warranties applicable in Quebec and Canada, including protections relating to hidden defects and non-conforming goods where applicable.</p>

      <h2>9. Liability</h2>
      <p>Liability is limited to the price of the ordered product. No liability for indirect damages.</p>

      <h2>10. Intellectual property</h2>
      <p>All site content (photos, text, logos, designs) is the exclusive property of <strong>{siteConfig.legalName}</strong>. Any reproduction is prohibited without written authorization.</p>

      <h2>11. Data protection</h2>
      <p>See our <a href="/legal/privacy">Privacy Policy</a>.</p>

      <h2>12. Governing law</h2>
      <p>These Terms are governed by <em>{siteConfig.governingLaw}</em>. In case of dispute, an amicable solution will be sought before any judicial action.</p>

      <h2>13. Contact</h2>
      <p>For any question: <em>{siteConfig.contactEmail}</em>.</p>
    </>
  )
}
