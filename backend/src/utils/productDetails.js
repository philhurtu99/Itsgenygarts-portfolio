const TEXT_FIELDS = ['sizeFitFr', 'sizeFitEn', 'materialsFr', 'materialsEn', 'careFr', 'careEn'];

export function productDetailsFromBody(body) {
  const data = {};
  for (const key of TEXT_FIELDS) {
    if (!Object.hasOwn(body, key)) continue;
    if (body[key] == null || body[key] === '') {
      data[key] = null;
      continue;
    }
    if (typeof body[key] !== 'string') return { error: 'Les détails du produit doivent être du texte.' };
    const value = body[key].trim();
    if (value.length > 10000) {
      return { error: 'Le contenu des détails du produit est trop long.' };
    }
    data[key] = value || null;
  }
  return { data };
}
