export function trimOptional(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

export function bilingualData(body, { fallbackNameRequired = true } = {}) {
  const nameFr = trimOptional(body.nameFr ?? body.name);
  const nameEn = trimOptional(body.nameEn);
  const descriptionFr = trimOptional(body.descriptionFr ?? body.description);
  const descriptionEn = trimOptional(body.descriptionEn);
  const name = nameFr || nameEn || (fallbackNameRequired ? '' : undefined);
  const description = descriptionFr || descriptionEn || '';

  return {
    ...(name !== undefined && { name }),
    nameFr,
    nameEn,
    description,
    descriptionFr,
    descriptionEn,
  };
}
