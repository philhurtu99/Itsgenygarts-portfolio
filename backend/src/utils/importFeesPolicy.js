import { isEnglish } from './language.js';

export const IMPORT_FEES_POLICY_VERSION = '2026-10-06-v1';

export function isInternationalDestination(country) {
  const code = String(country || '').trim().toUpperCase();
  return Boolean(code) && !['CA', 'CAN', 'CANADA'].includes(code);
}

export function importFeesPolicy(language) {
  const en = isEnglish(language);
  return {
    version: IMPORT_FEES_POLICY_VERSION,
    language: en ? 'en' : 'fr',
    notice: en
      ? 'For deliveries outside Canada, import duties, taxes and customs clearance or brokerage fees are not included in your order total. You are responsible for paying these charges to the carrier or customs authorities when requested, which may be before customs clearance or delivery. Non-payment may delay delivery or cause the parcel to be returned. Your statutory consumer rights remain unaffected.'
      : 'Pour les livraisons hors Canada, les droits de douane, taxes d\'importation et frais de dédouanement ou de courtage ne sont pas inclus dans le total de votre commande. Il vous revient de payer ces frais au transporteur ou aux autorités douanières lorsqu\'ils sont réclamés, parfois avant le dédouanement ou la livraison. Un non-paiement peut retarder la livraison ou entraîner le retour du colis. Vos droits légaux de consommateur demeurent applicables.',
  };
}

export function importFeesReminder(order, language) {
  if (!isInternationalDestination(order?.customerCountry)) return '';
  const incoterm = order?.shippingPackage?.customsDeclaration?.incoterm;
  if (incoterm && incoterm !== 'DDU') return '';
  // Legacy international orders get a notice, but never a fabricated acceptance.
  return order?.importFeesPolicyText || importFeesPolicy(language).notice;
}
