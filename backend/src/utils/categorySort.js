import { normalizeLanguage } from './language.js';

function categorySortLabel(category, lang = 'fr') {
  const normalizedLang = normalizeLanguage(lang, 'fr');
  const label = normalizedLang === 'en'
    ? category?.nameEn || category?.name || category?.nameFr
    : category?.nameFr || category?.name || category?.nameEn;
  return String(label || '').trim();
}

export function sortCategoriesAlphabetically(categories = [], lang = 'fr') {
  const locale = normalizeLanguage(lang, 'fr') === 'en' ? 'en-CA' : 'fr-CA';
  return [...categories].sort((a, b) => {
    const nameSort = categorySortLabel(a, lang).localeCompare(categorySortLabel(b, lang), locale, {
      sensitivity: 'base',
      numeric: true,
    });
    if (nameSort !== 0) return nameSort;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });
}
