// Category names suggest a question, never a classification or a country.
const FAMILIES = [
  ['flat-scarf', ['bandana', 'bandanas', 'foulard', 'foulards', 'scarf', 'scarves']],
  ['adult-hat', ['tuque', 'tuques', 'bonnet', 'bonnets', 'chapeau', 'chapeaux', 'hat', 'hats']],
  ['handbag', ['sac', 'sacs', 'bag', 'bags', 'sac a main', 'sacs a main']],
  ['pullover', ['cardigan', 'cardigans', 'chandail', 'chandails', 'pull', 'pulls', 'sweater', 'sweaters']],
  ['top', ['petit top', 'petits tops', 'top', 'tops']],
  ['headband', ['cache oreille', 'cache oreilles', 'cache-oreille', 'cache-oreilles', 'bandeau', 'bandeaux']],
  ['crocheted-footwear', ['botte', 'bottes', 'pantoufle', 'pantoufles', 'boot', 'boots', 'slipper', 'slippers']],
  ['painting', ['art', 'peinture', 'peintures', 'painting', 'paintings']],
  ['animal-toy', ['amigurumi', 'amigurumis', 'peluche', 'peluches']],
]

export function suggestedCustomsType(category) {
  const names = [category?.nameFr, category?.name, category?.nameEn].filter(Boolean)
    .map((name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' '))
  const matches = FAMILIES.filter(([, aliases]) => names.some((name) => aliases.includes(name)))
  if (matches.length !== 1) return ''
  return matches[0][0]
}

export const UNCLASSIFIED_TYPES = [
  ['pullover', 'Cardigan / chandail au crochet'],
  ['top', 'Petit haut au crochet'],
  ['headband', 'Bandeau / cache-oreilles au crochet'],
]
