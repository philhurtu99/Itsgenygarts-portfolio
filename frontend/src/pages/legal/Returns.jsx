import LegalLayout from './LegalLayout.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { siteConfig } from '../../config/site.js'

export default function Returns() {
  const { t, lang } = useLanguage()
  return (
    <LegalLayout title={t('legal.returns')} lastUpdated="2026-04-19">
      {lang === 'en' ? <ReturnsENSection /> : <ReturnsFRSection />}
    </LegalLayout>
  )
}

export function ReturnsFRSection() {
  return (
    <>
      <h2>1. Vente finale</h2>
      <p>Toutes les ventes sont <strong>finales</strong>. Aucun retour, échange ou remboursement n'est offert par convenance, changement d'idée, erreur de taille, préférence personnelle ou toute autre raison similaire après la commande.</p>

      <h2>2. Exceptions — produits non retournables</h2>
      <p>Compte tenu de la nature artisanale et personnalisée des créations proposées, aucun retour ni remboursement volontaire ne s'applique aux :</p>
      <ul>
        <li>Articles confectionnés <strong>sur mesure</strong> selon vos spécifications (couleurs, tailles, motifs personnalisés)</li>
        <li>Articles issus d'un <strong>devis personnalisé</strong></li>
        <li>Articles nettement personnalisés (broderie à votre nom, demande particulière)</li>
      </ul>
      <p>Ces produits étant fabriqués spécifiquement pour vous, ils ne peuvent faire l'objet d'aucun retour, échange ou remboursement volontaire.</p>

      <h2>3. Exceptions prévues par la loi</h2>
      <p>Rien dans la présente politique ne limite les droits qui peuvent être reconnus au consommateur par les lois applicables au Québec et au Canada, notamment en cas de produit défectueux, non conforme ou d'erreur de notre part dans la commande.</p>

      <h2>4. Procédure en cas de problème</h2>
      <ol>
        <li>Envoyez un courriel à <em>{siteConfig.contactEmail}</em> avec votre numéro de commande, une description du problème et, si possible, des photos.</li>
        <li>Nous évaluerons la situation et vous indiquerons la marche à suivre dans un délai raisonnable.</li>
        <li>Si un retour est requis dans le cadre d'un cas couvert par la loi, nous vous communiquerons les instructions applicables.</li>
      </ol>

      <h2>5. Frais de retour</h2>
      <p>Aucun retour volontaire n'étant accepté, les frais de retour ne sont normalement pas applicables. Si un retour est nécessaire dans un cas couvert par la loi ou à la suite d'une erreur de notre part, les modalités applicables seront précisées au cas par cas.</p>

      <h2>6. Remboursement</h2>
      <p>Aucun remboursement volontaire n'est offert. Si un remboursement est requis en vertu de la loi applicable ou à la suite d'une erreur de notre part, il sera traité selon le mode de paiement utilisé lors de l'achat, dans un délai raisonnable après vérification de la situation.</p>

      <h2>7. Produit défectueux ou non conforme</h2>
      <p>Si vous recevez un produit défectueux, endommagé ou non conforme à votre commande, contactez-nous immédiatement à <em>{siteConfig.contactEmail}</em> avec des photos du problème. Nous procéderons au remplacement ou au remboursement intégral, frais de retour inclus.</p>
      <p>Les garanties légales suivantes s'appliquent :</p>
      <ul>
        <li><strong>Québec :</strong> garantie légale selon la Loi sur la protection du consommateur</li>
        <li><strong>Canada :</strong> garantie implicite de qualité marchande</li>
      </ul>

      <h2>8. Annulation d'une commande non expédiée</h2>
      <p>Les demandes d'annulation sont évaluées au cas par cas avant expédition. Aucune annulation n'est garantie une fois la commande confirmée, surtout lorsqu'une production sur mesure ou une préparation spécifique a déjà commencé.</p>

      <h2>9. Contact</h2>
      <p>Pour toute question concernant les retours : <em>{siteConfig.contactEmail}</em>.</p>
    </>
  )
}

export function ReturnsENSection() {
  return (
    <>
      <h2>1. Final sale</h2>
      <p>All sales are <strong>final</strong>. No returns, exchanges, or refunds are offered for convenience, change of mind, sizing preference, personal preference, or any similar reason once an order has been placed.</p>

      <h2>2. Exceptions — non-returnable products</h2>
      <p>Due to the handmade and personalized nature of the products sold on the site, no voluntary return or refund applies to:</p>
      <ul>
        <li>Items made <strong>to order</strong> according to your specifications (colors, sizes, custom patterns)</li>
        <li>Items from a <strong>personalized quote</strong></li>
        <li>Items clearly personalized (embroidered with your name, specific request)</li>
      </ul>
      <p>As these products are made specifically for you, they are not eligible for voluntary return, exchange, or refund.</p>

      <h2>3. Exceptions required by law</h2>
      <p>Nothing in this policy limits rights that may be granted to consumers under applicable Quebec and Canadian law, including cases involving defective goods, non-conforming goods, or our own fulfillment error.</p>

      <h2>4. Procedure if there is a problem</h2>
      <ol>
        <li>Email <em>{siteConfig.contactEmail}</em> with your order number, a description of the issue, and photos where possible.</li>
        <li>We will review the situation and provide next steps within a reasonable time.</li>
        <li>If a return is required in a case covered by law, we will provide the applicable instructions.</li>
      </ol>

      <h2>5. Return shipping costs</h2>
      <p>Because voluntary returns are not accepted, return shipping costs are normally not applicable. If a return is required in a case covered by law or due to our own error, the applicable terms will be communicated case by case.</p>

      <h2>6. Refunds</h2>
      <p>No voluntary refunds are offered. If a refund is required under applicable law or due to our own error, it will be processed to the original payment method within a reasonable time after review of the situation.</p>

      <h2>7. Defective or non-conforming product</h2>
      <p>If you receive a defective, damaged or non-conforming product, contact us immediately at <em>{siteConfig.contactEmail}</em> with photos of the issue. We will proceed with a replacement or full refund, including return shipping costs.</p>
      <p>The following legal warranties apply:</p>
      <ul>
        <li><strong>Quebec:</strong> legal warranty under the Consumer Protection Act</li>
        <li><strong>Canada:</strong> implied warranty of merchantable quality</li>
      </ul>

      <h2>8. Cancellation of an unshipped order</h2>
      <p>Cancellation requests are reviewed case by case before shipment. No cancellation is guaranteed once an order has been confirmed, especially if custom production or specific preparation has already started.</p>

      <h2>9. Contact</h2>
      <p>For any return-related questions: <em>{siteConfig.contactEmail}</em>.</p>
    </>
  )
}
