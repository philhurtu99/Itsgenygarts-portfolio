export function productShouldLeaveCarts(product) {
  if (!product) return true;
  return Boolean(product.isDeleted)
    || Boolean(product.isDraft)
    || Boolean(product.soldOut)
    || Number(product.stockQuantity ?? 0) <= 0;
}

export async function removeProductFromAllCarts(prisma, product) {
  if (!product?.id || !productShouldLeaveCarts(product)) return;
  await prisma.cartItem.deleteMany({ where: { productId: product.id } });
}

export async function removeProductFromAllFavorites(prisma, product) {
  if (!product?.id || !productShouldLeaveCarts(product)) return;
  await prisma.favoriteItem.deleteMany({ where: { productId: product.id } });
}

export async function removeProductFromCustomerLists(prisma, product) {
  await removeProductFromAllCarts(prisma, product);
  await removeProductFromAllFavorites(prisma, product);
}
