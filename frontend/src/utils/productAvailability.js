export function isProductUnavailable(product) {
  if (!product) return true

  const stock = Number(product.stockQuantity ?? product.stock ?? 0)
  return Boolean(product.isDeleted) || Boolean(product.isDraft) || Boolean(product.soldOut) || stock <= 0
}

export function sortProductsByAvailability(products, compare = () => 0) {
  return [...products].sort((a, b) => (
    Number(isProductUnavailable(a)) - Number(isProductUnavailable(b)) || compare(a, b)
  ))
}

export function canAddUniqueProductToCart(product, items = []) {
  if (isProductUnavailable(product)) return false

  const productId = product.id || product._id
  const variants = Array.isArray(product.variants) ? product.variants : []
  const selectedVariantId = product.selectedVariantId || product.productVariantId || (variants.length === 1 ? variants[0].id : null)
  if (variants.length > 1 && !selectedVariantId) return false

  return !items.some((item) => item.id === productId && (item.productVariantId || null) === (selectedVariantId || null))
}
