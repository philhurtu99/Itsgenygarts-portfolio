const messages = {
  nameRequired: { fr: 'Nom requis', en: 'Name required' },
  invalidPrice: { fr: 'Prix invalide', en: 'Invalid price' },
  nameCountriesRequired: { fr: 'Nom et pays/codes requis', en: 'Name and country/codes required' },
  allFieldsRequired: { fr: 'Tous les champs sont requis', en: 'All fields are required' },
  fillAllFields: { fr: 'Veuillez remplir tous les champs.', en: 'Please fill in all fields.' },
  invalidCredentials: { fr: 'Identifiants incorrects.', en: 'Incorrect credentials.' },
  genericErrorTitle: { fr: 'Une erreur est survenue', en: 'Something went wrong' },
  reloadToRetry: { fr: 'Rechargez la page pour réessayer.', en: 'Reload the page to try again.' },
  reload: { fr: 'Recharger', en: 'Reload' },
}

function currentLanguage() {
  const lang = localStorage.getItem('lang') || navigator.language?.slice(0, 2)
  return lang === 'en' ? 'en' : 'fr'
}

export function msg(key) {
  return messages[key]?.[currentLanguage()] || messages[key]?.fr || key
}
