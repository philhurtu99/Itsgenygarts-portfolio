const messages = {
  'Le calcul des frais de livraison est indisponible pour le moment. Veuillez réessayer plus tard ou nous contacter.': {
    en: 'Shipping rates are currently unavailable. Please try again later or contact us.',
    fr: 'Le calcul des frais de livraison est indisponible pour le moment. Veuillez réessayer plus tard ou nous contacter.',
  },
  'Trop de tentatives. Réessayez dans 15 minutes.': {
    en: 'Too many attempts. Try again in 15 minutes.',
    fr: 'Trop de tentatives. Réessayez dans 15 minutes.',
  },
  'Trop de requêtes. Réessayez plus tard.': {
    en: 'Too many requests. Try again later.',
    fr: 'Trop de requêtes. Réessayez plus tard.',
  },
  'No token provided': { en: 'No token provided', fr: 'Aucun token fourni' },
  'Invalid or expired token': { en: 'Invalid or expired token', fr: 'Token invalide ou expiré' },
  'Données invalides': { en: 'Invalid data', fr: 'Données invalides' },
  'Nom trop court': { en: 'Name is too short', fr: 'Nom trop court' },
  'Nom trop long': { en: 'Name is too long', fr: 'Nom trop long' },
  'Email invalide': { en: 'Invalid email', fr: 'Email invalide' },
  'Mot de passe requis': { en: 'Password required', fr: 'Mot de passe requis' },
  'Token invalide': { en: 'Invalid token', fr: 'Token invalide' },
  'Mot de passe requis pour confirmer la suppression': {
    en: 'Password required to confirm deletion',
    fr: 'Mot de passe requis pour confirmer la suppression',
  },
  'Non authentifié': { en: 'Not authenticated', fr: 'Non authentifié' },
  'Un compte existe déjà avec cet email': {
    en: 'An account already exists with this email',
    fr: 'Un compte existe déjà avec cet email',
  },
  'Token manquant': { en: 'Missing token', fr: 'Token manquant' },
  'Token invalide ou déjà utilisé': {
    en: 'Invalid or already used token',
    fr: 'Token invalide ou déjà utilisé',
  },
  'Courriel confirmé avec succès': {
    en: 'Email confirmed successfully',
    fr: 'Courriel confirmé avec succès',
  },
  'Identifiants invalides': { en: 'Invalid credentials', fr: 'Identifiants invalides' },
  'Veuillez confirmer votre adresse courriel avant de vous connecter. Vérifiez votre boîte de réception.': {
    en: 'Please confirm your email address before signing in. Check your inbox.',
    fr: 'Veuillez confirmer votre adresse courriel avant de vous connecter. Vérifiez votre boîte de réception.',
  },
  'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.': {
    en: 'If an account exists with this email, a reset link has been sent.',
    fr: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
  },
  'Lien invalide ou expiré': { en: 'Invalid or expired link', fr: 'Lien invalide ou expiré' },
  'Mot de passe réinitialisé avec succès': {
    en: 'Password reset successfully',
    fr: 'Mot de passe réinitialisé avec succès',
  },
  'items requis': { en: 'Items are required', fr: 'Articles requis' },
  'items required': { en: 'Items are required', fr: 'Articles requis' },
  'Items are required': { en: 'Items are required', fr: 'Articles requis' },
  'Cart is empty': { en: 'Cart is empty', fr: 'Le panier est vide' },
  'Customer info required': { en: 'Customer information required', fr: 'Informations client requises' },
  'No valid products in cart': {
    en: 'No valid products in cart',
    fr: 'Aucun produit valide dans le panier',
  },
  'Produit invalide': { en: 'Invalid product', fr: 'Produit invalide' },
  'Produit introuvable': { en: 'Product not found', fr: 'Produit introuvable' },
  'Product not found': { en: 'Product not found', fr: 'Produit introuvable' },
  'Product deleted': { en: 'Product deleted', fr: 'Produit supprimé' },
  'Category not found': { en: 'Category not found', fr: 'Catégorie introuvable' },
  'Category deleted': { en: 'Category deleted', fr: 'Catégorie supprimée' },
  'Order not found': { en: 'Order not found', fr: 'Commande introuvable' },
  'Quote not found': { en: 'Quote not found', fr: 'Devis introuvable' },
  'Yarn not found': { en: 'Yarn not found', fr: 'Laine introuvable' },
  'Yarn category not found': { en: 'Yarn category not found', fr: 'Catégorie de laine introuvable' },
  'Yarn deleted': { en: 'Yarn deleted', fr: 'Laine supprimée' },
  'Yarn category deleted': { en: 'Yarn category deleted', fr: 'Catégorie de laine supprimée' },
  'Image not found': { en: 'Image not found', fr: 'Image introuvable' },
  'Image deleted': { en: 'Image deleted', fr: 'Image supprimée' },
  'No file provided': { en: 'No file provided', fr: 'Aucun fichier fourni' },
  'No file or image URL provided': {
    en: 'No file or image URL provided',
    fr: "Aucun fichier ou URL d'image fourni",
  },
  'Compte introuvable': { en: 'Account not found', fr: 'Compte introuvable' },
  'Commande introuvable': { en: 'Order not found', fr: 'Commande introuvable' },
  'Facture disponible uniquement pour les commandes payées': {
    en: 'Invoice available only for paid orders',
    fr: 'Facture disponible uniquement pour les commandes payées',
  },
  'Mot de passe incorrect': { en: 'Incorrect password', fr: 'Mot de passe incorrect' },
  'Compte supprimé avec succès': { en: 'Account deleted successfully', fr: 'Compte supprimé avec succès' },
  'Validation failed': { en: 'Validation failed', fr: 'Validation échouée' },
  'Missing required fields': { en: 'Missing required fields', fr: 'Champs obligatoires manquants' },
  'Champs obligatoires manquants': { en: 'Missing required fields', fr: 'Champs obligatoires manquants' },
  'Aucune image fournie': { en: 'No image provided', fr: 'Aucune image fournie' },
  'Note requise': { en: 'Note required', fr: 'Note requise' },
  'Objet et corps du message requis': {
    en: 'Subject and message body are required',
    fr: 'Objet et corps du message requis',
  },
  'Prix invalide': { en: 'Invalid price', fr: 'Prix invalide' },
  'Stripe non configuré': { en: 'Stripe is not configured', fr: 'Stripe non configuré' },
  "Définir un prix avant d'envoyer le lien de paiement": {
    en: 'Set a price before sending the payment link',
    fr: "Définir un prix avant d'envoyer le lien de paiement",
  },
  'name et code sont requis': { en: 'Name and code are required', fr: 'Nom et code requis' },
  'name and countries are required': {
    en: 'Name and countries are required',
    fr: 'Nom et pays requis',
  },
  'code, symbol, and rate are required': {
    en: 'Code, symbol, and rate are required',
    fr: 'Code, symbole et taux requis',
  },
  'Ce code existe déjà': { en: 'This code already exists', fr: 'Ce code existe déjà' },
  'Catégorie introuvable': { en: 'Category not found', fr: 'Catégorie introuvable' },
  'Client introuvable': { en: 'Customer not found', fr: 'Client introuvable' },
  'Devis introuvable': { en: 'Quote not found', fr: 'Devis introuvable' },
  'Élément introuvable': { en: 'Item not found', fr: 'Élément introuvable' },
  'Nom et catégorie requis': { en: 'Name and category are required', fr: 'Nom et catégorie requis' },
  'Référence supprimée': { en: 'Reference deleted', fr: 'Référence supprimée' },
  'Not authenticated': { en: 'Not authenticated', fr: 'Non authentifié' },
  'Email/username and password are required': {
    en: 'Email/username and password are required',
    fr: 'Email/nom d’utilisateur et mot de passe requis',
  },
  'Invalid credentials': { en: 'Invalid credentials', fr: 'Identifiants invalides' },
  'Username, email and password are required': {
    en: 'Username, email and password are required',
    fr: 'Nom d’utilisateur, email et mot de passe requis',
  },
  'Invalid status': { en: 'Invalid status', fr: 'Statut invalide' },
  'rates array required': { en: 'Rates array required', fr: 'Liste de tarifs requise' },
  'Stripe not configured': { en: 'Stripe is not configured', fr: 'Stripe non configuré' },
  'Internal server error': { en: 'Internal server error', fr: 'Erreur serveur interne' },
  'Sujet requis': { en: 'Subject required', fr: 'Sujet requis' },
  'Contenu requis': { en: 'Content required', fr: 'Contenu requis' },
  'Configuration SMTP manquante. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans le fichier .env': {
    en: 'Missing SMTP configuration. Add SMTP_HOST, SMTP_USER and SMTP_PASS to the .env file',
    fr: 'Configuration SMTP manquante. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans le fichier .env',
  },
};

function preferredLanguage(req) {
  const explicit = String(req.get('x-language') || req.query?.lang || '').toLowerCase();
  if (explicit.startsWith('en')) return 'en';
  if (explicit.startsWith('fr')) return 'fr';
  const accept = String(req.get('accept-language') || '').toLowerCase();
  if (accept.startsWith('en')) return 'en';
  if (accept.startsWith('fr')) return 'fr';
  return null;
}

export function localizeMessage(message, lang = 'fr') {
  if (typeof message !== 'string') return message;
  if (!lang) return message;
  const direct = messages[message];
  if (direct) return direct[lang] || direct.fr || message;

  const productIdMatch = message.match(/^Produit introuvable \(ID (.+)\)$/);
  if (productIdMatch) {
    return lang === 'en'
      ? `Product not found (ID ${productIdMatch[1]})`
      : message;
  }

  const customsIncompleteMatch = message.match(/^Les informations douanières sont incomplètes pour « (.+) »\.$/);
  if (customsIncompleteMatch) {
    return lang === 'en'
      ? `Customs information is incomplete for “${customsIncompleteMatch[1]}”.`
      : message;
  }

  const stockMatch = message.match(/^Stock insuffisant pour "(.+)". Disponible : (\d+), demandé : (\d+)$/);
  if (stockMatch) {
    return lang === 'en'
      ? `Insufficient stock for "${stockMatch[1]}". Available: ${stockMatch[2]}, requested: ${stockMatch[3]}`
      : message;
  }

  const invalidStatusMatch = message.match(/^Invalid status\. Must be one of: (.+)$/);
  if (invalidStatusMatch) {
    return lang === 'en'
      ? message
      : `Statut invalide. Valeurs acceptées : ${invalidStatusMatch[1]}`;
  }

  const invalidStatusFrMatch = message.match(/^Statut invalide\. Valeurs acceptées: (.+)$/);
  if (invalidStatusFrMatch) {
    return lang === 'en'
      ? `Invalid status. Accepted values: ${invalidStatusFrMatch[1]}`
      : message;
  }

  const emailMatch = message.match(/^Adresse courriel destinataire invalide: (.*)$/);
  if (emailMatch) {
    return lang === 'en'
      ? `Invalid recipient email address: ${emailMatch[1]}`
      : message;
  }

  return message;
}

function localizePayload(value, lang) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => localizePayload(item, lang));

  const next = { ...value };
  if (typeof next.message === 'string') next.message = localizeMessage(next.message, lang);
  if (typeof next.error === 'string') next.error = localizeMessage(next.error, lang);
  if (Array.isArray(next.errors)) next.errors = next.errors.map((item) => localizePayload(item, lang));
  return next;
}

export default function localizeResponses(req, res, next) {
  req.language = preferredLanguage(req);
  req.t = (message) => localizeMessage(message, req.language);

  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(localizePayload(body, req.language));
  next();
}
