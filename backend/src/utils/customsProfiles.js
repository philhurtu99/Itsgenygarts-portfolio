// Narrow reference profiles, not a blanket classification for a shop category.
// Keep the scope and source when adding a profile; never infer one from a name.
export const CUSTOMS_PROFILES = [
  {
    key: 'cotton-handbag', kind: 'product', name: 'Sac à main · extérieur 100 % coton',
    articleType: 'handbag', articleLabel: 'Sac à main', material: 'cotton', materialLabel: 'Extérieur 100 % coton',
    scope: 'Sac à main pour effets personnels, extérieur 100 % coton au crochet ou tricot, sans cuir, ni velours ou touffes. Hors sacs de voyage et cabas de courses.',
    description: 'Hand crocheted handbag with outer surface of 100 percent cotton, not pile or tufted',
    hsCode: '420222', usHtsCode: '4202224500',
    source: 'https://hts.usitc.gov/search?query=4202.22.45.00', reviewedOn: '2026-10-07',
  },
  ...[['wool', 'laine', 'wool'], ['alpaca', 'alpaga', 'alpaca']].map(([material, label, english]) => ({
    key: `${material}-crocheted-scarf`, kind: 'product', name: `Bandana ou foulard au crochet · 100 % ${label}`,
    articleType: 'flat-scarf', articleLabel: 'Bandana ou foulard plat au crochet ou tricot', material, materialLabel: `100 % ${label}`,
    scope: `Bandana ou foulard plat au crochet ou tricot, 100 % ${label}, à nouer autour de la tête ou du cou. Hors bonnets, bandeaux, articles tissés et accessoires pour animaux.`,
    description: `Hand crocheted flat scarf of 100 percent ${english}`,
    hsCode: '611710', usHtsCode: '6117101000',
    source: 'https://hts.usitc.gov/search?query=6117.10.10.00', reviewedOn: '2026-10-07',
  })),
  {
    key: 'acrylic-adult-hat', kind: 'product', name: 'Bonnet adulte · 100 % acrylique',
    articleType: 'adult-hat', articleLabel: 'Bonnet adulte au crochet ou tricot', material: 'acrylic', materialLabel: '100 % acrylique',
    scope: 'Bonnet au crochet ou tricot, 100 % acrylique, sans tresse.',
    description: 'Hand crocheted adult hat of 100 percent acrylic, not in part of braid',
    hsCode: '650500', usHtsCode: '6505006090',
    source: 'https://rulings.cbp.gov/ruling/N272045', reviewedOn: '2026-10-06',
  },
  {
    key: 'synthetic-handbag', kind: 'product', name: 'Sac à main · extérieur synthétique',
    articleType: 'handbag', articleLabel: 'Sac à main', material: 'synthetic', materialLabel: 'Extérieur entièrement synthétique',
    scope: 'Sac à main pour effets personnels, extérieur entièrement en fibres synthétiques, sans cuir.',
    description: 'Hand crocheted handbag with outer surface of man-made textile fibers',
    hsCode: '420222', usHtsCode: '4202228100',
    source: 'https://rulings.cbp.gov/ruling/N355349', reviewedOn: '2026-10-06',
  },
  {
    key: 'stuffed-animal-age-3-12', kind: 'product', name: 'Peluche animale · jouet 3 à 12 ans',
    articleType: 'animal-toy', articleLabel: 'Peluche animale · jouet pour les 3 à 12 ans',
    scope: 'Animal ou créature rembourré, sans électronique, conçu comme jouet pour les 3 à 12 ans. Hors coussins et décorations.',
    description: 'Hand crocheted stuffed animal toy, no electronics, intended for ages 3 to 12',
    hsCode: '950300', usHtsCode: '9503000073',
    source: 'https://rulings.cbp.gov/ruling/N353570', reviewedOn: '2026-10-06',
  },
  {
    key: 'original-hand-painted-art', kind: 'product', name: 'Peinture originale · réalisée à la main',
    articleType: 'painting', articleLabel: 'Peinture originale entièrement faite à la main',
    scope: 'Peinture originale entièrement réalisée à la main, de moins de 100 ans. Hors impressions, reproductions imprimées, objets manufacturés décorés et collages.',
    description: 'Original contemporary painting executed entirely by hand',
    hsCode: '970191', usHtsCode: '9701910000',
    source: 'https://rulings.cbp.gov/ruling/N350618', reviewedOn: '2026-10-06',
  },
  {
    key: 'acrylic-retail-yarn', kind: 'yarn', name: 'Fil à tricoter · 100 % acrylique',
    articleType: 'retail-yarn', articleLabel: 'Fil à tricoter en pelote', material: 'acrylic', materialLabel: '100 % acrylique',
    scope: 'Fil de fibres discontinues 100 % acrylique, en pelote pour vente au détail. Hors chenille, fil fantaisie et fil à coudre.',
    description: '100 percent acrylic staple fiber knitting yarn, put up for retail sale',
    hsCode: '551110', usHtsCode: '5511100030',
    source: 'https://rulings.cbp.gov/ruling/N340540', reviewedOn: '2026-10-06',
  },
  {
    key: 'cotton-crocheted-scarf', kind: 'product', name: 'Bandana ou foulard au crochet · 100 % coton',
    articleType: 'flat-scarf', articleLabel: 'Bandana ou foulard plat au crochet ou tricot', material: 'cotton', materialLabel: '100 % coton',
    scope: 'Bandana ou foulard plat au crochet ou tricot, 100 % coton, à nouer autour de la tête ou du cou. Hors bonnets, bandeaux, articles tissés et accessoires pour animaux.',
    description: 'Hand crocheted flat scarf of 100 percent cotton',
    hsCode: '611710', usHtsCode: '6117106010',
    source: 'https://hts.usitc.gov/search?query=6117.10.60.10', reviewedOn: '2026-10-07',
  },
  {
    key: 'acrylic-crocheted-scarf', kind: 'product', name: 'Bandana ou foulard au crochet · 100 % acrylique',
    articleType: 'flat-scarf', articleLabel: 'Bandana ou foulard plat au crochet ou tricot', material: 'acrylic', materialLabel: '100 % acrylique',
    scope: 'Bandana ou foulard plat au crochet ou tricot, 100 % acrylique, à nouer autour de la tête ou du cou. Hors bonnets, bandeaux, articles tissés et accessoires pour animaux.',
    description: 'Hand crocheted flat scarf of 100 percent acrylic',
    hsCode: '611710', usHtsCode: '6117102030',
    source: 'https://hts.usitc.gov/search?query=6117.10.20.30', reviewedOn: '2026-10-07',
  },
  // Six-digit HS profiles do not assert a fibre composition or US classification.
  // Existing detailed profiles stay available for previously saved articles.
  {
    key: 'international-crocheted-scarf', kind: 'product', internationalOnly: true,
    name: 'Bandana ou foulard au crochet', articleType: 'flat-scarf',
    articleLabel: 'Bandana / foulard au crochet',
    suggestionQuestion: 'Un foulard plat à nouer autour de la tête ou du cou, pour une personne ?',
    scope: 'Foulard plat à nouer autour de la tête ou du cou. Hors bonnets, bandeaux et accessoires pour animaux.',
    description: 'Hand crocheted textile bandana or flat scarf, fibre composition unspecified',
    hsCode: '611710', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch61-eng.html', reviewedOn: '2026-10-08',
  },
  {
    key: 'international-crocheted-hat', kind: 'product', internationalOnly: true,
    name: 'Bonnet au crochet', articleType: 'adult-hat', articleLabel: 'Bonnet adulte au crochet',
    suggestionQuestion: 'Un bonnet ou chapeau en textile au crochet ou tricot, sans assemblage de bandes ?',
    scope: 'Bonnet en textile au crochet ou tricot. Hors casques et chapeaux assemblés à partir de bandes.',
    description: 'Hand crocheted textile adult hat, fibre composition unspecified',
    hsCode: '650500', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch65-eng.html', reviewedOn: '2026-10-08',
  },
  {
    key: 'international-textile-handbag', kind: 'product', internationalOnly: true,
    name: 'Sac à main au crochet', articleType: 'handbag', articleLabel: 'Sac à main au crochet',
    suggestionQuestion: 'Un sac à main pour effets personnels, avec un extérieur en textile, plutôt qu’un cabas de courses ou un sac de voyage ?',
    scope: 'Sac à main pour effets personnels avec extérieur en textile. Hors sacs de voyage, cabas de courses et extérieur en cuir.',
    description: 'Hand crocheted textile handbag for personal belongings, fibre composition unspecified',
    hsCode: '420222', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch42-eng.html', reviewedOn: '2026-10-08',
  },
  ...[
    ['rubber-plastic', 'Caoutchouc ou plastique', 'rubber or plastics', '640419'],
    ['leather', 'Cuir ou cuir reconstitué', 'leather or composition leather', '640420'],
  ].map(([material, materialLabel, english, hsCode]) => ({
    key: `international-crocheted-footwear-${material}`, kind: 'product', internationalOnly: true,
    requiresConfirmation: true,
    name: `Chaussures au crochet · semelle ${materialLabel.toLowerCase()}`,
    articleType: 'crocheted-footwear', articleLabel: 'Bottes / pantoufles au crochet',
    suggestionQuestion: 'Le dessus est en textile au crochet ou tricot, avec une semelle extérieure ajoutée ?',
    material, materialLabel, materialQuestion: 'Matière de la semelle extérieure',
    scope: 'Dessus en textile au crochet ou tricot, avec semelle extérieure ajoutée. Chaussures ordinaires, hors sport, chaussures orthopédiques et articles de protection. La matière choisie est celle qui occupe le plus de surface au contact du sol.',
    description: `Crocheted textile footwear, outer soles of ${english}, not sports footwear`,
    hsCode, usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch64-eng.html', reviewedOn: '2026-10-08',
  })),
  {
    key: 'international-crocheted-headband', kind: 'product', internationalOnly: true,
    name: 'Bandeau ou cache-oreilles au crochet', articleType: 'headband', articleLabel: 'Bandeau / cache-oreilles au crochet',
    suggestionQuestion: 'Un bandeau en textile au crochet ou tricot qui entoure la tête, sans armature ?',
    scope: 'Bandeau en textile au crochet ou tricot porté autour de la tête. Hors bonnets, foulards tubulaires, cache-oreilles avec armature et accessoires pour animaux.',
    description: 'Hand crocheted textile headband or ear warmer band, fibre composition unspecified',
    hsCode: '611780', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch61-eng.html', reviewedOn: '2026-10-08',
  },
  {
    key: 'international-wool-blend-pullover', kind: 'product', internationalOnly: true,
    name: 'Cardigan ou chandail · mélange à dominante laine', articleType: 'pullover', articleLabel: 'Cardigan / chandail au crochet',
    suggestionQuestion: 'Un pull ou cardigan au crochet ou tricot, hors vêtements pour bébés, dont la laine de mouton représente plus de la moitié du textile ?',
    scope: 'Pull ou cardigan au crochet ou tricot, laine de mouton majoritaire en poids. Mélange accepté, sans déclarer 100 % laine. Hors vêtements pour bébés de taille jusqu’à 86 cm, manteaux, débardeurs, tissus enduits et vêtements de protection.',
    description: 'Hand crocheted pullover or cardigan of wool-predominant textile blend, not for babies',
    hsCode: '611011', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch61-eng.html', reviewedOn: '2026-10-08',
  },
  {
    key: 'international-crocheted-stuffed-toy', kind: 'product', internationalOnly: true,
    name: 'Amigurumi · jouet rembourré au crochet', articleType: 'animal-toy', articleLabel: 'Amigurumi · jouet rembourré au crochet',
    suggestionQuestion: 'Un jouet rembourré au crochet, sans électronique, plutôt qu’un coussin ou une décoration ?',
    scope: 'Jouet rembourré au crochet, sans électronique. Animaux et personnages compris. Hors coussins, objets purement décoratifs et décorations de fête.',
    description: 'Hand crocheted stuffed toy, no electronics',
    hsCode: '950300', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch95-eng.html', reviewedOn: '2026-10-08',
  },
  {
    key: 'international-original-painting', kind: 'product', internationalOnly: true,
    name: 'Peinture originale entièrement faite à la main', articleType: 'painting', articleLabel: 'Peinture originale entièrement faite à la main',
    suggestionQuestion: 'Une peinture originale entièrement faite à la main, de moins de 100 ans ?',
    scope: 'Peinture originale entièrement réalisée à la main, de moins de 100 ans. Hors impressions, reproductions imprimées, collages et objets manufacturés décorés.',
    description: 'Original contemporary painting executed entirely by hand',
    hsCode: '970191', usHtsCode: null,
    source: 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch97-eng.html', reviewedOn: '2026-10-08',
  },
];

export function getCustomsProfile(key) {
  return CUSTOMS_PROFILES.find((profile) => profile.key === key) || null;
}

export function profileCustomsFields(key, kind) {
  const profile = getCustomsProfile(key);
  if (!profile || (kind && profile.kind !== kind)) return null;
  return { customsProfileKey: profile.key, customsDescription: profile.description, customsHsCode: profile.hsCode };
}
