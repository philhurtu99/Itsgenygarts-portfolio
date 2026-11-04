import { describe, it, expect } from '@jest/globals';
import { importFeesPolicy, importFeesReminder, isInternationalDestination } from '../../src/utils/importFeesPolicy.js';
import en from '../../../frontend/src/i18n/en.js';
import fr from '../../../frontend/src/i18n/fr.js';

describe('import fees policy', () => {
  it.each(['CA', ' ca ', 'Canada', 'CAN', null, ''])('does not treat %s as international', (country) => {
    expect(isInternationalDestination(country)).toBe(false);
  });

  it.each(['US', 'FR', 'GB'])('treats %s as international', (country) => {
    expect(isInternationalDestination(country)).toBe(true);
  });

  it.each([['en', en], ['fr', fr]])('keeps the %s checkout text identical to the stored policy', (lang, translations) => {
    expect(importFeesPolicy(lang).notice).toBe(translations.checkout.importFeesNotice);
  });

  it('reuses the text actually accepted instead of a future policy', () => {
    expect(importFeesReminder({ customerCountry: 'US', importFeesPolicyText: 'Accepted older notice' }, 'en')).toBe('Accepted older notice');
  });

  it('reminds legacy international customers without claiming acceptance', () => {
    expect(importFeesReminder({ customerCountry: 'FR' }, 'fr')).toBe(importFeesPolicy('fr').notice);
  });

  it('does not show recipient charges for DDP or domestic orders', () => {
    expect(importFeesReminder({ customerCountry: 'US', shippingPackage: { customsDeclaration: { incoterm: 'DDP' } } }, 'en')).toBe('');
    expect(importFeesReminder({ customerCountry: 'CA' }, 'en')).toBe('');
  });
});
