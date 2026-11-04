export default {
  common: { close: "Fermer", previousImage: "Photo précédente", nextImage: "Photo suivante", photo: "Photo {number}", comingSoonAnimation: "Animation de chargement" },
  verification: {
    title: "Courriel de confirmation non reçu ?",
    resend: "Demander un autre courriel",
    sending: "Demande en cours...",
    cooldown: "Réessayer dans {seconds} s",
    wait: "Trop de demandes. Patientez avant de réessayer.",
    error: "Impossible de transmettre la demande. Réessayez plus tard.",
    requested: "Demande reçue. Vérifiez votre boîte de réception et vos indésirables si votre compte attend encore une confirmation. Si rien n'arrive, contactez info@example.test. Un compte expiré doit être recréé après sa suppression.",
    initialFailure: "Votre compte a été créé, mais le courriel de confirmation n'a pas pu être envoyé. Demandez un autre courriel ci-dessous, sans créer un nouveau compte.",
  },
  // Navbar
  nav: {
    home: "Accueil",
    products: "Produits",
    yarn: "Laines",
    custom: "Sur mesure",
    favorites: "Favoris",
    login: "Connexion",
    logout: "Déconnexion",
    hello: "Bonjour",
    profile: "Profil",
    cart: "Panier",
    closeCart: "Fermer le panier",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },

  favorites: {
    title: "Mes favoris",
    subtitle: "Vos coups de coeur sauvegardés.",
    empty: "Vous n'avez pas encore de favoris.",
    emptyDesc:
      "Gardez vos produits préférés de côté pour les retrouver facilement.",
    browseProducts: "Découvrir les produits",
    add: "Ajouter aux favoris",
    added: "Ajouté aux favoris",
    remove: "Retirer des favoris",
  },

  footer: {
    other: "Autre",
  },

  // Profile
  profile: {
    title: "Mon profil",
    hello: "Bonjour",
    tabInfo: "Mes informations",
    tabOrders: "Mes commandes",
    loading: "Chargement...",
    accountInfo: "Informations du compte",
    name: "Nom",
    email: "Courriel",
    emailStatus: "Statut du courriel",
    verified: "Vérifié",
    notVerified: "Non vérifié",
    memberSince: "Membre depuis",
    noOrders: "Vous n'avez encore passé aucune commande.",
    browseProducts: "Découvrir les produits",
    typeOrder: "Commande",
    typeCustom: "Sur mesure",
    typeQuote: "Devis personnalisé",
    articles: "article(s)",
    quotePending: "Devis en cours",
    downloadInvoice: "Télécharger",
    downloading: "Téléchargement...",
    deleteAccount: "Supprimer le compte",
    deleteAccountDesc:
      "La suppression est définitive. Vos données personnelles seront effacées. Vos commandes passées seront conservées de façon anonymisée pour les obligations comptables.",
    deleteEmailNotice:
      "Après validation du mot de passe, vous recevrez un courriel. Le compte sera supprimé seulement après avoir cliqué le lien de confirmation.",
    deletePasswordLabel: "Mot de passe actuel",
    deleteConfirmWord: "SUPPRIMER",
    deleteConfirmLabel: 'Tapez "{word}" pour confirmer',
    sendDeleteEmail: "Envoyer le courriel de confirmation",
    deleteRequestSending: "Envoi...",
    deleteRequestSent: "Un courriel de confirmation vous a été envoyé.",
  },

  deleteAccountConfirm: {
    loading: "Suppression du compte...",
    missingToken: "Lien de confirmation manquant.",
    successTitle: "Compte supprimé",
    successMessage: "Votre compte a été supprimé avec succès.",
    errorTitle: "Lien invalide",
    errorMessage: "Ce lien de suppression est invalide ou expiré.",
  },

  // Home
  home: {
    heroTitle: "Créations Crochet Artisanales",
    heroSubtitle:
      "Pièces sur mesure confectionnés avec amour. Chaque pièce est unique, réalisée à la main pour vous.",
    viewAll: "Voir tous les produits",
    orderCustom: "Commander un custom",
    orderCustomComingSoon: "Sur mesure · À venir",
    handmade: "Fait main",
    handmadeDesc: "Chaque pièce crochetée à la main",
    customizable: "Personnalisable",
    customizableDesc: "Couleurs et tailles sur mesure",
    shipping: "Livraison",
    shippingDesc: "Partout au Québec et au Canada",
    scroll: "Défiler",
    shippingNoticeLabel: "Avis de livraison",
    usShippingNotice: "🇺🇲 Nous avons dû suspendre temporairement les livraisons aux États-Unis en raison des droits de douane. Merci de votre compréhension.",
    featured: "Produits en vedette",
    seeAll: "Voir tout",
    ctaTitle: "Une idée spéciale en tête ?",
    ctaSubtitle:
      "Commandez une pièce entièrement personnalisée selon vos goûts : couleurs, taille, style.",
    ctaCustom: "Commande sur mesure",
    ctaQuote: "Devis personnalisé",
    ctaCustomComingSoon: "Commande sur mesure · À venir",
    ctaQuoteComingSoon: "Devis personnalisé · À venir",
    loadError: "Impossible de charger les produits.",
    noProducts: "Aucun produit disponible pour l'instant.",
  },

  // Products
  products: {
    title: "Nos produits",
    all: "Tous",
    legacyCreations: "Anciennes créations",
    loading: "Chargement...",
    empty: "Aucun produit dans cette catégorie.",
    noImage: "Pas d'image",
    enlargeImage: "Agrandir la photo",
    soldOut: "Vendu",
    inStock: "En stock",
    addToCart: "Ajouter au panier",
    chooseVariation: "Choisir la variation",
    variation: "Variation",
    moreVariant: "+{count}",
    moreVariants: "+{count}",
    viewMoreVariants: "Voir les autres variantes : {count}",
    detailsTitle: "Détails de la pièce",
    sizeDetails: "Taille",
    materials: "Matériaux",
    care: "Entretien",
    detailsComingSoon: "Informations à venir.",
    productType: "Type de pièce",
    madeByHand: "Réalisation",
    youMayAlsoLike: "Vous pourriez aussi aimer",
    addedToCart: "Produit ajouté au panier !",
    priceOnRequest: "Prix sur demande",
    perUnit: "/ unité",
    backToProducts: "← Retour aux produits",
    stock: "Stock disponible",
    onlyLeft: "Seulement {n} en stock",
  },

  yarn: {
    title: "Laines",
    comingSoon: "À venir",
  },

  customComingSoon: {
    label: "Sur mesure",
    title: "À venir",
    description: "Le service de commandes sur mesure est en préparation. Entre-temps, découvrez les créations actuellement disponibles.",
    products: "Voir les produits",
  },

  // Cart
  cart: {
    title: "Mon panier",
    empty: "Votre panier est vide",
    emptyDesc: "Ajoutez des produits pour commencer votre commande.",
    viewProducts: "Voir les produits",
    remove: "Retirer",
    summary: "Résumé",
    total: "Total",
    checkout: "Passer la commande",
    continueShopping: "Continuer mes achats",
    maxStock: "Une seule pièce disponible",
  },

  // Checkout
  checkout: {
    backToCart: "← Retour au panier",
    steps: ["Compte", "Informations", "Résumé"],
    // Step Account
    howToContinue: "Comment souhaitez-vous continuer ?",
    signIn: "Se connecter",
    createAccount: "Créer un compte",
    or: "ou",
    continueAsGuest: "Continuer en tant qu'invité",
    loggedAs: "Connecté en tant que",
    continue: "Continuer",
    back: "← Retour",
    // Step Address
    yourInfo: "Vos coordonnées",
    shippingAddress: "Adresse de livraison",
    searchAddress: "Rechercher votre adresse...",
    orFillManually: "Ou remplissez les champs manuellement ci-dessous",
    continueToSummary: "Continuer vers le résumé",
    // Step Review
    editInfo: "← Modifier les informations",
    contact: "Coordonnées",
    items: "Articles",
    subtotal: "Sous-total",
    shippingLabel: "Livraison",
    shippingOptions: "Mode de livraison",
    calculatingShipping: "Calcul des tarifs de livraison...",
    trackingIncluded: "Suivi inclus",
    withoutTracking: "Sans suivi",
    businessDays: "jours ouvrables",
    shippingUnavailable: "Impossible de calculer la livraison pour cette adresse.",
    usShippingPaused: "La livraison aux États-Unis est temporairement suspendue.",
    amountPending: "À calculer",
    importFeesNotice: "Pour les livraisons hors Canada, les droits de douane, taxes d'importation et frais de dédouanement ou de courtage ne sont pas inclus dans le total de votre commande. Il vous revient de payer ces frais au transporteur ou aux autorités douanières lorsqu'ils sont réclamés, parfois avant le dédouanement ou la livraison. Un non-paiement peut retarder la livraison ou entraîner le retour du colis. Vos droits légaux de consommateur demeurent applicables.",
    importFeesAcceptance: "J'ai lu l'avertissement et j'accepte de payer les frais d'importation supplémentaires qui pourraient être réclamés.",
    importFeesRequired: "Veuillez lire et accepter l'avertissement sur les frais d'importation avant de payer.",
    free: "Gratuit",
    total: "Total",
    proceedToPayment: "Procéder au paiement",
    merchantContact: "Coordonnées du commerçant",
    redirecting: "Redirection...",
    stripeNote: "Vous serez redirigé vers Stripe pour le paiement sécurisé.",
    // Cancelled
    paymentCancelled: "Paiement annulé",
    paymentCancelledDesc:
      "Votre paiement a été annulé. Votre panier a été vidé.",
    cartEmpty: "Votre panier est vide",
    confirmEmailThenSignIn:
      "Confirmez votre adresse, puis connectez-vous pour continuer.",
    // Success (no stripe)
    orderReceived: "Commande reçue !",
    orderReceivedDesc:
      "Merci pour votre commande. Nous vous contacterons sous peu.",
    backToProducts: "Retour aux produits",
  },

  // Order Confirmation
  confirmation: {
    loading: "Chargement de votre commande...",
    thankYou: "Merci pour votre commande !",
    thankYouDesc:
      "Votre paiement a été traité avec succès. Vous recevrez un courriel de confirmation sous peu.",
    backToProducts: "Retour aux produits",
    confirmed: "Commande confirmée !",
    order: "Commande",
    emailSent: "Un courriel de confirmation a été envoyé à",
    items: "Articles",
    subtotal: "Sous-total",
    shipping: "Livraison",
    total: "Total",
    deliveryAddress: "Livraison",
    continueShopping: "Continuer mes achats",
  },

  // Login
  login: {
    title: "Se connecter",
    noAccount: "Pas encore de compte ?",
    register: "S'inscrire",
    email: "Email",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion...",
    forgotPassword: "Mot de passe oublié ?",
  },

  // Forgot password
  forgot: {
    title: "Mot de passe oublié",
    subtitle:
      "Entrez votre courriel pour recevoir un lien de réinitialisation.",
    submit: "Envoyer le lien",
    submitting: "Envoi...",
    sent: "Si un compte existe avec cet email, un lien de réinitialisation vient de vous être envoyé. Vérifiez votre boîte de réception.",
    backToLogin: "← Retour à la connexion",
  },

  // Reset password
  reset: {
    title: "Nouveau mot de passe",
    newPassword: "Nouveau mot de passe",
    submit: "Réinitialiser",
    submitting: "Réinitialisation...",
    success:
      "Mot de passe réinitialisé avec succès. Redirection vers la connexion...",
    invalidLink: "Lien invalide ou expiré",
    requestNew: "Demander un nouveau lien",
  },

  // Register
  register: {
    title: "Créer un compte",
    hasAccount: "Déjà un compte ?",
    signIn: "Se connecter",
    fullName: "Nom complet",
    fullNamePlaceholder: "Votre nom",
    email: "Email",
    emailPlaceholder: "email@exemple.com",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    newsletterConsent:
      "Je souhaite recevoir des nouvelles et promotions par courriel (optionnel)",
    communicationLanguage: "Langue des communications infolettres",
    communicationLanguageHint:
      "Choisissez la langue souhaitée pour les infolettres et les courriels de compte.",
    languageFrench: "Français",
    languageEnglish: "Anglais",
    submit: "Créer mon compte",
    submitting: "Création...",
    verifyEmailTitle: "Vérifiez votre courriel",
    verifyEmailSent: "Un courriel de confirmation a été envoyé à",
    verifyEmailInstruction:
      "Cliquez sur le lien dans le courriel pour activer votre compte.",
    verifyEmailFrom: "Il provient de notifications@example.test.",
    goToLogin: "Aller à la connexion",
    rules: {
      minLength: "Au moins 8 caractères",
      uppercase: "Une lettre majuscule",
      digit: "Un chiffre",
      special: "Un caractère spécial (!@#$...)",
    },
  },

  verify: {
    loading: "Vérification en cours...",
    successTitle: "Courriel confirmé !",
    successMessage:
      "Votre adresse courriel a été confirmée avec succès. Les courriels de compte proviennent de notifications@example.test.",
    errorTitle: "Erreur",
    missingToken: "Token manquant.",
    invalidToken: "Token invalide ou expiré.",
    retryRegister: "Réessayer l'inscription",
  },

  quote: {
    title: "Demande de devis",
    subtitle:
      "Sélectionnez les produits qui vous intéressent et renseignez vos coordonnées.",
    products: "Produits",
    estimatedTotal: "Total estimatif",
    yourInfo: "Vos coordonnées",
    notes: "Notes / Questions",
    notesPlaceholder: "Précisions supplémentaires...",
    submit: "Envoyer le devis",
    submitting: "Envoi...",
    sentTitle: "Devis envoyé !",
    sentDesc:
      "Votre demande de devis a été reçue. Nous vous répondrons dans les meilleurs délais.",
    newQuote: "Nouveau devis",
  },

  faq: {
    title: "FAQ",
    kicker: "Questions fréquentes",
    subtitle:
      "Réponses rapides sur les commandes, les pièces sur mesure, la livraison et l’entretien.",
    items: [
      {
        question: "Est-ce que chaque produit est unique ?",
        answer:
          "Oui. Les produits prêts à vendre sont des pièces uniques. Si une pièce est vendue ou devient indisponible, elle ne peut plus être commandée comme article en stock.",
      },
      {
        question: "Comment fonctionne une commande sur mesure ?",
        answer:
          "Vous remplissez le formulaire sur mesure avec le type de pièce, les couleurs, la taille et les références souhaitées. Nous confirmons ensuite les détails, le délai et le prix avant de lancer la création.",
      },
      {
        question:
          "Quelle est la différence entre commande sur mesure et devis personnalisé ?",
        answer:
          "La commande sur mesure sert aux modèles déjà proposés avec des options. Le devis personnalisé est préférable pour une idée plus libre, une inspiration précise ou une demande qui ne correspond pas aux catégories existantes.",
      },
      {
        question: "Quels sont les délais de préparation ?",
        answer:
          "Les pièces déjà disponibles sont préparées plus rapidement. Les créations sur mesure demandent plus de temps selon la complexité, les matériaux et la période. Le délai est confirmé avant la production.",
      },
      {
        question: "Où livrez-vous ?",
        answer:
          "La livraison est offerte selon les zones configurées dans la boutique. Les frais et options disponibles sont affichés au moment du paiement selon votre adresse.",
      },
      {
        question: "Puis-je retourner une commande ?",
        answer:
          "Les articles prêts à vendre peuvent être évalués selon la politique de retour. Les pièces sur mesure ou personnalisées ne sont généralement pas retournables, sauf en cas de défaut ou de problème avec la commande.",
      },
      {
        question: "Comment entretenir ma pièce au crochet ?",
        answer:
          "Lavage doux recommandé, idéalement à la main ou au cycle délicat dans un filet. Séchez à plat pour préserver la forme. Évitez la chaleur élevée.",
      },
      {
        question: "Est-ce que je reçois une confirmation par courriel ?",
        answer:
          "Oui. Vous recevez un courriel de confirmation après une commande, un paiement ou une demande de devis, à condition que votre adresse courriel soit valide.",
      },
    ],
  },

  // Custom Order
  custom: {
    title: "Commande sur mesure",
    subtitle: "Créez votre pièce unique étape par étape.",
    customHelpLabel: "Expliquer la commande sur mesure",
    customHelpTitle: "Commande sur mesure",
    customHelpText:
      "À utiliser quand vous choisissez un type de pièce déjà proposé, puis ses options, couleurs et références. Nous validons ensuite les détails, le délai et le prix avant de commencer.",
    steps: ["Catégorie", "Options", "Référence", "Couleurs", "Coordonnées"],
    chooseCategory: "Choisissez une catégorie",
    cantFind: "Vous ne trouvez pas ce que vous voulez ?",
    sendQuote: "Envoyer un devis personnalisé",
    options: "Options",
    noOptions: "Aucune option pour cette catégorie.",
    colorStyle: "Style de couleur",
    color: "Couleur",
    colorsMax5: "Couleurs (max 5)",
    colorTheme: "Thème de couleur",
    colorThemePlaceholder: "ex: automne, coucher de soleil, océan...",
    mood: "Ambiance",
    modelRef: "Référence de modèle",
    chooseRef: "Choisir une référence",
    selected: "Sélectionné",
    removeSelection: "Retirer la sélection",
    modelOption: "Option de modèle",
    choose: "-- Choisir --",
    refPhotos: "Photos de référence",
    optional: "optionnel",
    clickToChoose: "Cliquez pour choisir des images",
    yourInfo: "Vos coordonnées",
    previous: "Précédent",
    next: "Suivant",
    submit: "Envoyer la commande",
    submitting: "Envoi...",
    successTitle: "Commande envoyée !",
    successDesc:
      "Votre commande sur mesure a été reçue. Nous vous contacterons sous peu.",
    orderNumber: "Numéro de commande",
    newOrder: "Nouvelle commande",
    sameAsRef: "Identique à la référence",
    solid: "Uni",
    multiple: "Multiple",
    gradient: "Dégradé",
    rainbow: "Arc-en-ciel",
    pastel: "Pastel",
    bright: "Vif",
    dark: "Sombre",
    addColor: "+ Couleur",
    // Devis
    quoteTitle: "Devis personnalisé",
    quoteSubtitle:
      "Décrivez votre projet et nous vous préparerons un devis sur mesure.",
    quoteHelpLabel: "Expliquer le devis personnalisé",
    quoteHelpTitle: "Devis personnalisé",
    quoteHelpText:
      "À utiliser pour une idée plus libre, une inspiration précise ou une demande qui ne rentre pas dans les catégories. Vous décrivez le projet, puis nous revenons avec une estimation personnalisée.",
    projectDesc: "Description de votre projet",
    projectPlaceholder:
      "Décrivez ce que vous recherchez : type de pièce, couleurs souhaitées, inspiration, occasion...",
    quoteSent: "Devis envoyé !",
    quoteSentDesc:
      "Votre demande de devis a été reçue. Nous vous contacterons sous peu.",
    refNumber: "Numéro de référence",
    sendQuoteBtn: "Envoyer le devis",
  },

  // Form labels (shared)
  form: {
    fullName: "Nom complet",
    email: "Email",
    phone: "Téléphone",
    address: "Adresse",
    city: "Ville",
    province: "Province/État",
    postalCode: "Code postal",
    country: "Pays",
    countryCode: "Code pays ISO (2 lettres)",
    select: "-- Sélectionner --",
    name: "Nom",
    tel: "Tél",
    back: "Retour",
  },

  // Validation errors
  errors: {
    nameRequired: "Nom requis",
    emailRequired: "Email requis",
    emailInvalid: "Email invalide",
    passwordRequired: "Mot de passe requis",
    passwordInvalid: "Le mot de passe ne respecte pas les exigences",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    addressRequired: "Adresse requise",
    cityRequired: "Ville requise",
    postalRequired: "Code postal requis",
    countryRequired: "Pays requis",
    countryCodeInvalid: "Sélectionnez un pays ou entrez son code ISO à 2 lettres",
    phoneRequiredInternational: "Le téléphone est requis pour une livraison internationale",
    provinceRequired: "Province requise",
    categoryRequired: "Sélectionnez une catégorie",
    colorStyleRequired: "Sélectionnez un style de couleur",
    colorThemeRequired: "Le thème est requis",
    moodRequired: "Sélectionnez une ambiance",
    descriptionRequired: "La description est requise",
    itemsRequired: "Sélectionnez au moins un produit",
  },

  // 404
  notFound: {
    title: "Page introuvable",
    desc: "La page que vous cherchez n'existe pas ou a été déplacée.",
    home: "Retour à l'accueil",
    products: "Voir les produits",
  },

  // Cookies banner
  cookies: {
    title: "Vos préférences cookies",
    description:
      "Nous utilisons des cookies pour le bon fonctionnement du site. Avec votre accord, nous pourrons aussi mesurer l'audience et améliorer votre expérience.",
    learnMore: "En savoir plus",
    acceptAll: "Tout accepter",
    rejectAll: "Tout refuser",
    customize: "Personnaliser",
    preferences: "Préférences cookies",
    essential: "Essentiels",
    essentialDesc:
      "Nécessaires au fonctionnement du site (panier, connexion, langue). Toujours actifs.",
    analytics: "Analytiques",
    analyticsDesc:
      "Nous aident à comprendre comment les visiteurs utilisent le site. Anonymes.",
    marketing: "Marketing",
    marketingDesc:
      "Permettent de personnaliser la publicité et mesurer les campagnes.",
    save: "Enregistrer mes choix",
    back: "Retour",
    managePreferences: "Gérer mes préférences cookies",
    changePreferences: "Modifier mes préférences",
  },

  // Legal pages
  legal: {
    nav: "Informations légales",
    lastUpdated: "Dernière mise à jour",
    terms: "Conditions générales de vente",
    privacy: "Politique de confidentialité",
    cookies: "Politique des cookies",
    mentions: "Mentions légales",
    returns: "Politique de retour",
  },

  // Countries
  countries: {
    CA: "Canada",
    US: "États-Unis",
    FR: "France",
    GB: "Royaume-Uni",
    OTHER: "Autre",
  },

  // Canadian provinces
  provinces: {
    QC: "Québec",
    ON: "Ontario",
    BC: "Colombie-Britannique",
    AB: "Alberta",
    MB: "Manitoba",
    SK: "Saskatchewan",
    NS: "Nouvelle-Écosse",
    NB: "Nouveau-Brunswick",
    NL: "Terre-Neuve-et-Labrador",
    PE: "Île-du-Prince-Édouard",
    NT: "Territoires du Nord-Ouest",
    YT: "Yukon",
    NU: "Nunavut",
  },
};
