import { suggestedCustomsType } from '../../src/utils/customsSuggestions.js';

it.each([
  ['Bandana', 'flat-scarf'], ['Tuque', 'adult-hat'], ['Chapeau', 'adult-hat'], ['Sacs', 'handbag'],
  ['Cardigan', 'pullover'], ['Chandail', 'pullover'], ['Petit top', 'top'], ['Cache-oreilles', 'headband'],
  ['Bottes', 'crocheted-footwear'], ['Amigurumi', 'animal-toy'], ['Art', 'painting'],
])('suggests a question for %s using the existing category name', (nameFr, type) => {
  expect(suggestedCustomsType({ nameFr })).toBe(type);
});

it('does not guess from marketing substrings or conflicting bilingual names', () => {
  expect(suggestedCustomsType({ nameFr: 'Accessoires de mode' })).toBe('');
  expect(suggestedCustomsType({ nameFr: 'Chapeaux pour animaux' })).toBe('');
  expect(suggestedCustomsType({ nameFr: 'Bandanas', nameEn: 'Hats' })).toBe('');
});
