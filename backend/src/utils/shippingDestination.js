import { isEnglish } from './language.js';

// Temporary storefront shipping restriction; customs profiles remain available
// for other international destinations and can be reused when US shipping resumes.
export function assertShippingDestinationAllowed(country, language = 'fr') {
  const code = String(country || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  if (['US', 'USA', 'UNITEDSTATES', 'UNITEDSTATESOFAMERICA', 'ETATSUNIS'].includes(code)) {
    throw Object.assign(new Error(isEnglish(language)
      ? 'Shipping to the United States is temporarily unavailable.'
      : 'La livraison aux États-Unis est temporairement suspendue.'), { statusCode: 422 });
  }
}
