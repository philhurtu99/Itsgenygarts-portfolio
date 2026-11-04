export function normalizeLanguage(value, fallback = 'en') {
  const lang = String(value || '').trim().toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('fr')) return 'fr';
  return fallback;
}

export function languageFromRequest(req, fallback = 'en') {
  return normalizeLanguage(
    req?.body?.customerLanguage
      || req?.body?.preferredLanguage
      || req?.get?.('x-language')
      || req?.query?.lang
      || req?.body?.language
      || req?.get?.('accept-language'),
    fallback,
  );
}

export function languageOf(record, fallback = 'en') {
  return normalizeLanguage(record?.customerLanguage || record?.preferredLanguage || record?.language, fallback);
}

export function isEnglish(lang) {
  return normalizeLanguage(lang) === 'en';
}

export async function languageForEmail(prisma, email, req, fallback = 'en') {
  const explicit = req?.body?.customerLanguage || req?.body?.preferredLanguage || req?.body?.language;
  if (explicit) return normalizeLanguage(explicit, fallback);

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !prisma) return fallback;

  try {
    const [customer, order, customOrder, personalizedQuote, quoteRequest] = await Promise.all([
      prisma.customer?.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { preferredLanguage: true },
      }),
      prisma.order?.findFirst({
        where: { customerEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        select: { customerLanguage: true },
      }),
      prisma.customOrder?.findFirst({
        where: { customerEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        orderBy: { createdAtUtc: 'desc' },
        select: { customerLanguage: true },
      }),
      prisma.personalizedQuote?.findFirst({
        where: { customerEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        orderBy: { createdAtUtc: 'desc' },
        select: { customerLanguage: true },
      }),
      prisma.quoteRequest?.findFirst({
        where: { customerEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        select: { customerLanguage: true },
      }),
    ]);

    return languageOf(customer, languageOf(order, languageOf(customOrder, languageOf(personalizedQuote, languageOf(quoteRequest, fallback)))));
  } catch {
    return fallback;
  }
}
