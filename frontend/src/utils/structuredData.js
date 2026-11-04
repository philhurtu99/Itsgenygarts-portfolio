import { siteConfig } from '../config/site.js'

function absoluteUrl(path) {
  if (!path) return siteConfig.siteUrl
  if (typeof path === 'object') {
    return absoluteUrl(path.imageUrl || path.url || path.src || path.mainImageUrl)
  }
  if (typeof path !== 'string') return siteConfig.siteUrl
  if (/^https?:\/\//i.test(path)) return path
  return `${siteConfig.siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function productSchema(product, { currency = 'CAD' } = {}) {
  if (!product) return null

  const images = (product.images?.length ? product.images : product.mainImageUrl ? [product.mainImageUrl] : product.imageUrl ? [product.imageUrl] : [])
    .map(absoluteUrl)
    .filter(Boolean)

  const unavailable =
    product.status === 'SOLD' ||
    product.status === 'RESERVED' ||
    product.isSold === true ||
    (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: images.length ? images : undefined,
    sku: product.sku || String(product.id),
    brand: { '@type': 'Brand', name: siteConfig.businessName },
    url: absoluteUrl(`/products/${product.id}`),
  }

  const category = typeof product.category === 'object' ? product.category?.name : product.category
  if (category) schema.category = category

  if (product.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: Number(product.price).toFixed(2),
      priceCurrency: currency,
      availability: unavailable
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: absoluteUrl(`/products/${product.id}`),
      seller: { '@type': 'Organization', name: siteConfig.businessName },
    }
  }

  return schema
}

export function breadcrumbSchema(items) {
  if (!items?.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  }
}
