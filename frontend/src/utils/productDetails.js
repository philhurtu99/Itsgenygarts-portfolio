export function localizedProductDetail(product, key, lang = 'fr') {
  const primary = lang === 'en' ? 'En' : 'Fr'
  const fallback = primary === 'En' ? 'Fr' : 'En'
  return product?.[`${key}${primary}`] || product?.[`${key}${fallback}`] || ''
}
