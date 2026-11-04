export function localizedName(item, lang = 'fr') {
  if (!item) return ''
  if (lang === 'en') return item.nameEn || item.name || item.nameFr || ''
  return item.nameFr || item.name || item.nameEn || ''
}

export function localizedDescription(item, lang = 'fr') {
  if (!item) return ''
  if (lang === 'en') return item.descriptionEn || item.description || item.descriptionFr || ''
  return item.descriptionFr || item.description || item.descriptionEn || ''
}
