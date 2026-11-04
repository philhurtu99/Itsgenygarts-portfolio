export async function getLocalPreviewProducts() {
  if (!import.meta.env.DEV) return []

  try {
    const response = await fetch('/local-preview-products.json', { cache: 'no-store' })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function getLocalPreviewCategories(products) {
  const categories = new Map()

  products.forEach((product) => {
    const category = product?.category
    if (!category) return

    if (typeof category === 'string') {
      if (!categories.has(category)) {
        categories.set(category, {
          id: `local-preview-category-${categories.size + 1}`,
          name: category,
          nameFr: category,
          nameEn: category,
        })
      }
      return
    }

    const key = category.id || category._id || category.name
    if (key && !categories.has(key)) categories.set(key, category)
  })

  return [...categories.values()]
}
