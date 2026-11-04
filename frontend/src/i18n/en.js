export default {
  // Navbar
  nav: {
    home: "Home",
    products: "Products",
    yarn: "Yarn",
    custom: "Custom",
    favorites: "Favorites",
    login: "Login",
    logout: "Logout",
    hello: "Hello",
    profile: "Profile",
    cart: "Cart",
    closeCart: "Close cart",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },

  common: { close: "Close", previousImage: "Previous photo", nextImage: "Next photo", photo: "Photo {number}", comingSoonAnimation: "Loading animation" },
  verification: {
    title: "Didn't receive your confirmation email?",
    resend: "Request another email",
    sending: "Requesting...",
    cooldown: "Try again in {seconds}s",
    wait: "Too many requests. Please wait before trying again.",
    error: "Your request could not be submitted. Please try again later.",
    requested: "Request received. Check your inbox and spam folder if your account is still awaiting confirmation. If nothing arrives, contact info@example.test. Expired accounts must be registered again after deletion.",
    initialFailure: "Your account was created, but the confirmation email could not be sent. Request another email below. You do not need to create another account.",
  },

  favorites: {
    title: "My favorites",
    subtitle: "Your saved favorites.",
    empty: "You don't have any favorites yet.",
    emptyDesc: "Save your favorite products so you can find them again easily.",
    browseProducts: "Browse products",
    add: "Add to Favorites",
    added: "Added to Favorites",
    remove: "Remove from Favorites",
  },

  footer: {
    other: "Other",
  },

  // Profile
  profile: {
    title: "My profile",
    hello: "Hello",
    tabInfo: "My information",
    tabOrders: "My orders",
    loading: "Loading...",
    accountInfo: "Account information",
    name: "Name",
    email: "Email",
    emailStatus: "Email status",
    verified: "Verified",
    notVerified: "Not verified",
    memberSince: "Member since",
    noOrders: "You haven't placed any orders yet.",
    browseProducts: "Browse products",
    typeOrder: "Order",
    typeCustom: "Custom",
    typeQuote: "Personalized quote",
    articles: "item(s)",
    quotePending: "Quote pending",
    downloadInvoice: "Download",
    downloading: "Downloading...",
    deleteAccount: "Delete account",
    deleteAccountDesc:
      "Deletion is permanent. Your personal data will be erased. Past orders will be kept only in anonymized form for accounting obligations.",
    deleteEmailNotice:
      "After your password is validated, you will receive an email. The account will be deleted only after you click the confirmation link.",
    deletePasswordLabel: "Current password",
    deleteConfirmWord: "DELETE",
    deleteConfirmLabel: 'Type "{word}" to confirm',
    sendDeleteEmail: "Send confirmation email",
    deleteRequestSending: "Sending...",
    deleteRequestSent: "A confirmation email has been sent to you.",
  },

  deleteAccountConfirm: {
    loading: "Deleting account...",
    missingToken: "Missing confirmation link.",
    successTitle: "Account deleted",
    successMessage: "Your account has been deleted successfully.",
    errorTitle: "Invalid link",
    errorMessage: "This deletion link is invalid or expired.",
  },

  // Home
  home: {
    heroTitle: "Handmade Crochet Creations",
    heroSubtitle:
      "Pieces crafted with love. Each piece is unique, handmade just for you.",
    viewAll: "View all products",
    orderCustom: "Order a custom piece",
    orderCustomComingSoon: "Custom · Coming soon",
    handmade: "Handmade",
    handmadeDesc: "Each piece crocheted by hand",
    customizable: "Customizable",
    customizableDesc: "Custom colors and sizes",
    shipping: "Shipping",
    shippingDesc: "Across Quebec and Canada",
    scroll: "Scroll",
    shippingNoticeLabel: "Shipping notice",
    usShippingNotice: "🇺🇲 We had to close shipping to the USA temporarily due to tariffs; thank you for your understanding.",
    featured: "Featured products",
    seeAll: "See all",
    ctaTitle: "Have a special idea in mind?",
    ctaSubtitle:
      "Order a fully customized piece to your taste: colors, size, style.",
    ctaCustom: "Custom order",
    ctaQuote: "Personalized quote",
    ctaCustomComingSoon: "Custom order · Coming soon",
    ctaQuoteComingSoon: "Personalized quote · Coming soon",
    loadError: "Unable to load products.",
    noProducts: "No products available at the moment.",
  },

  // Products
  products: {
    title: "Our products",
    all: "All",
    legacyCreations: "Past creations",
    loading: "Loading...",
    empty: "No products in this category.",
    noImage: "No image",
    enlargeImage: "Enlarge photo",
    soldOut: "Sold",
    inStock: "In stock",
    addToCart: "Add to cart",
    chooseVariation: "Choose variation",
    variation: "Variation",
    moreVariant: "+{count}",
    moreVariants: "+{count}",
    viewMoreVariants: "View additional variants: {count}",
    detailsTitle: "Piece details",
    sizeDetails: "Size",
    materials: "Materials",
    care: "Care",
    detailsComingSoon: "Details coming soon.",
    productType: "Piece type",
    madeByHand: "Craft",
    youMayAlsoLike: "You may also like",
    addedToCart: "Product added to cart!",
    priceOnRequest: "Price on request",
    perUnit: "/ unit",
    backToProducts: "← Back to products",
    stock: "Available stock",
    onlyLeft: "Only {n} left in stock",
  },

  yarn: {
    title: "Yarn",
    comingSoon: "Coming soon",
  },

  customComingSoon: {
    label: "Custom orders",
    title: "Coming soon",
    description: "Our custom-order service is being prepared. In the meantime, explore the handmade pieces currently available.",
    products: "Browse products",
  },

  // Cart
  cart: {
    title: "My cart",
    empty: "Your cart is empty",
    emptyDesc: "Add products to start your order.",
    viewProducts: "View products",
    remove: "Remove",
    summary: "Summary",
    total: "Total",
    checkout: "Proceed to checkout",
    continueShopping: "Continue shopping",
    maxStock: "Only one piece available",
  },

  // Checkout
  checkout: {
    backToCart: "← Back to cart",
    steps: ["Account", "Information", "Summary"],
    howToContinue: "How would you like to continue?",
    signIn: "Sign in",
    createAccount: "Create an account",
    or: "or",
    continueAsGuest: "Continue as guest",
    loggedAs: "Logged in as",
    continue: "Continue",
    back: "← Back",
    yourInfo: "Your information",
    shippingAddress: "Shipping address",
    searchAddress: "Search your address...",
    orFillManually: "Or fill in the fields manually below",
    continueToSummary: "Continue to summary",
    editInfo: "← Edit information",
    contact: "Contact information",
    items: "Items",
    subtotal: "Subtotal",
    shippingLabel: "Shipping",
    shippingOptions: "Shipping method",
    calculatingShipping: "Calculating shipping rates...",
    trackingIncluded: "Tracking included",
    withoutTracking: "No tracking",
    businessDays: "business days",
    shippingUnavailable: "Shipping cannot be calculated for this address.",
    usShippingPaused: "Shipping to the United States is temporarily unavailable.",
    amountPending: "Not yet calculated",
    importFeesNotice: "For deliveries outside Canada, import duties, taxes and customs clearance or brokerage fees are not included in your order total. You are responsible for paying these charges to the carrier or customs authorities when requested, which may be before customs clearance or delivery. Non-payment may delay delivery or cause the parcel to be returned. Your statutory consumer rights remain unaffected.",
    importFeesAcceptance: "I have read the notice and agree to pay any additional import charges that may be requested.",
    importFeesRequired: "Please read and accept the import fees notice before paying.",
    free: "Free",
    total: "Total",
    proceedToPayment: "Proceed to payment",
    merchantContact: "Merchant contact details",
    redirecting: "Redirecting...",
    stripeNote: "You will be redirected to Stripe for secure payment.",
    paymentCancelled: "Payment cancelled",
    paymentCancelledDesc:
      "Your payment has been cancelled. Your cart has been emptied.",
    cartEmpty: "Your cart is empty",
    confirmEmailThenSignIn:
      "Confirm your email address, then sign in to continue.",
    orderReceived: "Order received!",
    orderReceivedDesc: "Thank you for your order. We will contact you shortly.",
    backToProducts: "Back to products",
  },

  // Order Confirmation
  confirmation: {
    loading: "Loading your order...",
    thankYou: "Thank you for your order!",
    thankYouDesc:
      "Your payment has been processed successfully. You will receive a confirmation email shortly.",
    backToProducts: "Back to products",
    confirmed: "Order confirmed!",
    order: "Order",
    emailSent: "A confirmation email has been sent to",
    items: "Items",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    deliveryAddress: "Shipping",
    continueShopping: "Continue shopping",
  },

  // Login
  login: {
    title: "Sign in",
    noAccount: "Don't have an account?",
    register: "Sign up",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
    forgotPassword: "Forgot password?",
  },

  // Forgot password
  forgot: {
    title: "Forgot password",
    subtitle: "Enter your email to receive a reset link.",
    submit: "Send link",
    submitting: "Sending...",
    sent: "If an account exists with this email, a reset link has been sent. Check your inbox.",
    backToLogin: "← Back to sign in",
  },

  // Reset password
  reset: {
    title: "New password",
    newPassword: "New password",
    submit: "Reset password",
    submitting: "Resetting...",
    success: "Password reset successfully. Redirecting to sign in...",
    invalidLink: "Invalid or expired link",
    requestNew: "Request a new link",
  },

  // Register
  register: {
    title: "Create an account",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "email@example.com",
    password: "Password",
    confirmPassword: "Confirm password",
    newsletterConsent:
      "I would like to receive news and promotions by email (optional)",
    communicationLanguage: "Newsletter communication language",
    communicationLanguageHint:
      "Choose the language you prefer for newsletters and account emails.",
    languageFrench: "French",
    languageEnglish: "English",
    submit: "Create my account",
    submitting: "Creating...",
    verifyEmailTitle: "Check your email",
    verifyEmailSent: "A confirmation email has been sent to",
    verifyEmailInstruction:
      "Click the link in the email to activate your account.",
    verifyEmailFrom: "It comes from notifications@example.test.",
    goToLogin: "Go to sign in",
    rules: {
      minLength: "At least 8 characters",
      uppercase: "One uppercase letter",
      digit: "One digit",
      special: "One special character (!@#$...)",
    },
  },

  verify: {
    loading: "Verifying...",
    successTitle: "Email confirmed!",
    successMessage:
      "Your email address has been confirmed successfully. Account emails come from notifications@example.test.",
    errorTitle: "Error",
    missingToken: "Missing token.",
    invalidToken: "Invalid or expired token.",
    retryRegister: "Try signing up again",
  },

  quote: {
    title: "Quote request",
    subtitle:
      "Select the products you are interested in and enter your contact information.",
    products: "Products",
    estimatedTotal: "Estimated total",
    yourInfo: "Your information",
    notes: "Notes / Questions",
    notesPlaceholder: "Additional details...",
    submit: "Send quote",
    submitting: "Sending...",
    sentTitle: "Quote sent!",
    sentDesc:
      "Your quote request has been received. We will get back to you as soon as possible.",
    newQuote: "New quote",
  },

  faq: {
    title: "FAQ",
    kicker: "Frequently asked questions",
    subtitle: "Quick answers about orders, custom pieces, shipping, and care.",
    items: [
      {
        question: "Is each product unique?",
        answer:
          "Yes. Ready-to-ship products are unique pieces. If a piece is sold or becomes unavailable, it can no longer be ordered as an in-stock item.",
      },
      {
        question: "How does a custom order work?",
        answer:
          "You fill out the custom form with the type of piece, colors, size, and references you want. We then confirm the details, timeline, and price before production starts.",
      },
      {
        question:
          "What is the difference between a custom order and a personalized quote?",
        answer:
          "Custom orders are for existing models with options. Personalized quotes are better for freer ideas, specific inspiration, or requests that do not fit the existing categories.",
      },
      {
        question: "How long does preparation take?",
        answer:
          "Available pieces are prepared faster. Custom creations take more time depending on complexity, materials, and season. The timeline is confirmed before production.",
      },
      {
        question: "Where do you ship?",
        answer:
          "Shipping is available according to the zones configured in the shop. Available options and fees are shown at checkout based on your address.",
      },
      {
        question: "Can I return an order?",
        answer:
          "Ready-to-ship items can be reviewed under the return policy. Custom or personalized pieces are generally not returnable except in case of defect or an issue with the order.",
      },
      {
        question: "How should I care for my crochet piece?",
        answer:
          "Gentle washing is recommended, ideally by hand or on a delicate cycle in a laundry bag. Dry flat to preserve the shape. Avoid high heat.",
      },
      {
        question: "Will I receive an email confirmation?",
        answer:
          "Yes. You receive a confirmation email after an order, payment, or quote request, as long as your email address is valid.",
      },
    ],
  },

  // Custom Order
  custom: {
    title: "Custom order",
    subtitle: "Create your unique piece step by step.",
    customHelpLabel: "Custom order info",
    customHelpTitle: "Custom order",
    customHelpText:
      "Use this when you are choosing a piece type we already offer, then selecting its options, colors, and references. We confirm the details, timeline, and price before starting.",
    steps: ["Category", "Options", "Reference", "Colors", "Contact"],
    chooseCategory: "Choose a category",
    cantFind: "Can't find what you're looking for?",
    sendQuote: "Send a personalized quote",
    options: "Options",
    noOptions: "No options for this category.",
    colorStyle: "Color style",
    color: "Color",
    colorsMax5: "Colors (max 5)",
    colorTheme: "Color theme",
    colorThemePlaceholder: "e.g.: autumn, sunset, ocean...",
    mood: "Mood",
    modelRef: "Model reference",
    chooseRef: "Choose a reference",
    selected: "Selected",
    removeSelection: "Remove selection",
    modelOption: "Model option",
    choose: "-- Choose --",
    refPhotos: "Reference photos",
    optional: "optional",
    clickToChoose: "Click to choose images",
    yourInfo: "Your information",
    previous: "Previous",
    next: "Next",
    submit: "Submit order",
    submitting: "Sending...",
    successTitle: "Order submitted!",
    successDesc:
      "Your custom order has been received. We will contact you shortly.",
    orderNumber: "Order number",
    newOrder: "New order",
    sameAsRef: "Same as reference",
    solid: "Solid",
    multiple: "Multiple",
    gradient: "Gradient",
    rainbow: "Rainbow",
    pastel: "Pastel",
    bright: "Bright",
    dark: "Dark",
    addColor: "+ Color",
    quoteTitle: "Personalized quote",
    quoteSubtitle:
      "Describe your project and we will prepare a custom quote for you.",
    quoteHelpLabel: "Explain personalized quotes",
    quoteHelpTitle: "Personalized quote",
    quoteHelpText:
      "Use this for a freer idea, a specific inspiration, or a request that does not fit the listed categories. You describe the project, then we come back with a personalized estimate.",
    projectDesc: "Project description",
    projectPlaceholder:
      "Describe what you are looking for: type of piece, desired colors, inspiration, occasion...",
    quoteSent: "Quote sent!",
    quoteSentDesc:
      "Your quote request has been received. We will contact you shortly.",
    refNumber: "Reference number",
    sendQuoteBtn: "Send quote",
  },

  // Form labels (shared)
  form: {
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    city: "City",
    province: "Province/State",
    postalCode: "Postal code",
    country: "Country",
    countryCode: "ISO country code (2 letters)",
    select: "-- Select --",
    name: "Name",
    tel: "Phone",
    back: "Back",
  },

  // Validation errors
  errors: {
    nameRequired: "Name required",
    emailRequired: "Email required",
    emailInvalid: "Invalid email",
    passwordRequired: "Password required",
    passwordInvalid: "Password does not meet requirements",
    passwordMismatch: "Passwords do not match",
    addressRequired: "Address required",
    cityRequired: "City required",
    postalRequired: "Postal code required",
    countryRequired: "Country required",
    countryCodeInvalid: "Select a country or enter its 2-letter ISO code",
    phoneRequiredInternational: "A phone number is required for international shipping",
    provinceRequired: "Province required",
    categoryRequired: "Select a category",
    colorStyleRequired: "Select a color style",
    colorThemeRequired: "Theme is required",
    moodRequired: "Select a mood",
    descriptionRequired: "Description is required",
    itemsRequired: "Select at least one product",
  },

  // 404
  notFound: {
    title: "Page not found",
    desc: "The page you are looking for does not exist or has been moved.",
    home: "Back to home",
    products: "Browse products",
  },

  // Cookies banner
  cookies: {
    title: "Your cookie preferences",
    description:
      "We use cookies to make the site work. With your consent, we can also measure traffic and improve your experience.",
    learnMore: "Learn more",
    acceptAll: "Accept all",
    rejectAll: "Reject all",
    customize: "Customize",
    preferences: "Cookie preferences",
    essential: "Essential",
    essentialDesc:
      "Required for the site to work (cart, login, language). Always active.",
    analytics: "Analytics",
    analyticsDesc: "Help us understand how visitors use the site. Anonymous.",
    marketing: "Marketing",
    marketingDesc: "Personalize advertising and measure campaigns.",
    save: "Save my choices",
    back: "Back",
    managePreferences: "Manage my cookie preferences",
    changePreferences: "Change my preferences",
  },

  // Legal pages
  legal: {
    nav: "Legal information",
    lastUpdated: "Last updated",
    terms: "Terms of sale",
    privacy: "Privacy policy",
    cookies: "Cookie policy",
    mentions: "Legal notice",
    returns: "Return policy",
  },

  // Countries
  countries: {
    CA: "Canada",
    US: "United States",
    FR: "France",
    GB: "United Kingdom",
    OTHER: "Other",
  },

  // Canadian provinces
  provinces: {
    QC: "Quebec",
    ON: "Ontario",
    BC: "British Columbia",
    AB: "Alberta",
    MB: "Manitoba",
    SK: "Saskatchewan",
    NS: "Nova Scotia",
    NB: "New Brunswick",
    NL: "Newfoundland and Labrador",
    PE: "Prince Edward Island",
    NT: "Northwest Territories",
    YT: "Yukon",
    NU: "Nunavut",
  },
};
