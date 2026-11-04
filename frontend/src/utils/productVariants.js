const VARIANT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SWATCH_FALLBACKS = ['#d9b9a5', '#8a9b82', '#d47f78', '#7d8ea8', '#dbc891']

export function variantSwatchColor(variant, index = 0) {
  return variant?.colorHex || variant?.color || SWATCH_FALLBACKS[index % SWATCH_FALLBACKS.length]
}

export function getAvailableVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  return variants.filter((variant) => !variant.status || variant.status === 'AVAILABLE').map((variant, index) => (
    variant.label
      ? variant
      : { ...variant, label: VARIANT_LABELS[index] || String(index + 1) }
  ))
}


export function getDisplayVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const showSold = product?.showSoldVariants && product.soldOut
    && Number(product.stockQuantity ?? product.stock ?? 0) <= 0 && variants.length > 0
    && variants.every((variant) => variant.status === 'SOLD')
  if (!showSold) return getAvailableVariants(product)
  return variants.map((variant, index) => ({ ...variant, label: variant.label || VARIANT_LABELS[index] || String(index + 1) }))
}

export function hasSelectableVariants(product) {
  return getDisplayVariants(product).length > 1
}

export function getVariantImages(product) {
  const variants = getDisplayVariants(product)
  const showVariantLabels = variants.length > 1
  const availableVariantIds = new Set(variants.map((variant) => variant.id))
  const labelByVariantId = new Map(variants.map((variant) => [variant.id, variant.label]))
  const productImages = (product?.images || [])
    .map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl || image.url || image.src || image,
      variantId: image.variantId || null,
      variantLabel: showVariantLabels && image.variantId ? (image.variantLabel || labelByVariantId.get(image.variantId) || null) : null,
    }))
    .filter((image) => typeof image.imageUrl === 'string')
    .filter((image) => !image.variantId || availableVariantIds.has(image.variantId))

  const imagesByVariantId = new Map()
  for (const image of productImages) {
    if (!image.variantId) continue
    const list = imagesByVariantId.get(image.variantId) || []
    list.push(image)
    imagesByVariantId.set(image.variantId, list)
  }

  const variantImages = variants.flatMap((variant) => {
    const images = imagesByVariantId.get(variant.id)
    if (images?.length) return images
    return (variant.images || []).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl || image.url || image.src || image,
      variantId: variant.id,
      variantLabel: showVariantLabels ? variant.label : null,
    }))
  }).filter((image) => typeof image.imageUrl === 'string')

  const generalImages = productImages.filter((image) => !image.variantId)
  const seen = new Set()
  return [...generalImages, ...variantImages].filter((image) => {
    const key = image.id != null ? `image:${image.id}` : `${image.variantId || 'general'}:${image.imageUrl}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getDisplayImages(product) {
  const images = getVariantImages(product)
  if (images.length > 0) return images
  const unavailableImageUrls = new Set([
    ...(product?.images || []).filter((image) => image.variantId).map((image) => image.imageUrl),
    ...(product?.variants || []).filter((variant) => variant.status && variant.status !== 'AVAILABLE')
      .flatMap((variant) => (variant.images || []).map((image) => image.imageUrl)),
  ])
  const fallback = [product?.mainImageUrl, product?.imageUrl].find((url) => url && !unavailableImageUrls.has(url))
  if (fallback) return [{ imageUrl: fallback, variantId: null, variantLabel: null }]
  return []
}

export function getDefaultVariant(product) {
  return getAvailableVariants(product)[0] || null
}

export function variantForImage(product, image) {
  if (!image?.variantId) return null
  return getDisplayVariants(product).find((variant) => variant.id === image.variantId) || null
}
