export const VARIANT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function variantLabel(index) {
  return VARIANT_LABELS[index] || '';
}

export function availableVariants(product) {
  return (product?.variants || [])
    .filter((variant) => variant.status === 'AVAILABLE')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
}

export function variantsWithLabels(variants = []) {
  return variants
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
    .map((variant, index) => ({
      ...variant,
      label: variantLabel(index),
      images: (variant.images || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id),
    }));
}

export function imageWithVariantLabels(images = [], variants = []) {
  const labelByVariantId = new Map(variants.map((variant) => [variant.id, variant.label]));
  return images
    .sort((a, b) => Number(Boolean(a.variantId)) - Number(Boolean(b.variantId)) || (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)
    .map((image) => ({
      ...image,
      variantLabel: image.variantId ? labelByVariantId.get(image.variantId) || null : null,
    }));
}

export function isSimpleProduct(product, variants = product?.variants || []) {
  return variants.length <= 1 && (product?.images || []).every(
    image => !image.variantId || image.variantId === variants[0]?.id
  );
}

export function primaryProductImageUrl(product, variants = product?.variants || [], simpleProduct = isSimpleProduct(product)) {
  if (simpleProduct) {
    const first = [...(product?.images || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)[0];
    if (first) return first.imageUrl;
  }
  const presentation = (product?.images || []).filter((image) => !image.variantId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)[0];
  return presentation?.imageUrl || variants[0]?.images?.[0]?.imageUrl || product?.mainImageUrl || null;
}

export function normalizeProductVariants(product) {
  if (!product) return product;
  const { variants = [], images = [], reservations = [], ...data } = product;
  const purchasableVariants = availableVariants({ variants });
  const showSoldVariants = Boolean(product.showSoldVariants && variants.length
    && Number(product.stockQuantity) <= 0 && variants.every((variant) => variant.status === 'SOLD'));
  const labeledVariants = variantsWithLabels(showSoldVariants ? variants : purchasableVariants);
  const visibleVariantIds = new Set(labeledVariants.map((variant) => variant.id));
  // A sole internal stock variant is a simple product, not a choice of variations.
  const simpleProduct = isSimpleProduct(product, variants);
  const visibleImages = images.filter((image) => simpleProduct || !image.variantId || visibleVariantIds.has(image.variantId));
  const hiddenCover = images.some((image) => image.imageUrl === product.mainImageUrl && image.variantId && !visibleVariantIds.has(image.variantId))
    && !visibleImages.some((image) => image.imageUrl === product.mainImageUrl);
  const hasVariants = variants.length > 0 || images.some((image) => image.variantId);
  const reserved = reservations.reduce((sum, reservation) => sum + Number(reservation.quantity || 0), 0);
  const availableStock = hasVariants
    ? purchasableVariants.length
    : Math.max(0, Number(product.stockQuantity ?? 0) - reserved);

  return {
    ...data,
    mainImageUrl: primaryProductImageUrl({ ...product, images: visibleImages, mainImageUrl: hiddenCover ? null : product.mainImageUrl }, simpleProduct ? variants : labeledVariants, simpleProduct),
    images: imageWithVariantLabels(simpleProduct
      ? visibleImages.map(image => ({ ...image, variantId: null, variantLabel: null }))
      : visibleImages, labeledVariants),
    variants: labeledVariants,
    showSoldVariants,
    stockQuantity: availableStock,
    soldOut: Boolean(product.soldOut) || availableStock <= 0,
  };
}

export async function syncProductVariants(tx, productId, stockQuantity) {
  const stock = Number(stockQuantity);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('Stock invalide');
  }
  if (stock > VARIANT_LABELS.length) {
    throw new Error(`Maximum ${VARIANT_LABELS.length} variations par produit`);
  }

  const variants = await tx.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (stock <= 0) {
    await tx.productVariant.updateMany({
      where: { productId, status: { in: ['AVAILABLE', 'RESERVED'] } },
      data: { status: 'SOLD' },
    });
    return [];
  }

  const active = variants.filter((variant) => variant.status !== 'SOLD');
  if (active.length < stock) {
    const soldToRestore = variants
      .filter((variant) => variant.status === 'SOLD')
      .slice(0, stock - active.length);
    if (soldToRestore.length) {
      await tx.productVariant.updateMany({
        where: { id: { in: soldToRestore.map((variant) => variant.id) } },
        data: { status: 'AVAILABLE' },
      });
    }

    const maxSort = variants.reduce((max, variant) => Math.max(max, variant.sortOrder ?? 0), -1);
    const createCount = stock - active.length - soldToRestore.length;
    for (let i = 0; i < createCount; i += 1) {
      await tx.productVariant.create({
        data: {
          productId,
          status: 'AVAILABLE',
          sortOrder: maxSort + 1 + i,
        },
      });
    }
  } else if (active.length > stock) {
    const toArchive = active
      .filter((variant) => variant.status === 'AVAILABLE')
      .slice(stock - active.length);
    const archiveCount = active.length - stock;
    const archiveIds = toArchive.slice(0, archiveCount).map((variant) => variant.id);
    if (archiveIds.length < archiveCount) {
      throw new Error('Impossible de réduire le stock: certaines variations sont réservées');
    }
    await tx.productVariant.updateMany({
      where: { id: { in: archiveIds } },
      data: { status: 'SOLD' },
    });
  }

  return tx.productVariant.findMany({
    where: { productId, status: { not: 'SOLD' } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}
