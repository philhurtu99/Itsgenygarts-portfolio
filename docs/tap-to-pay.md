# Tap to Pay / Mode marché

Le mode marché dans l'admin web peut:

- enregistrer une vente en personne payée manuellement;
- générer un lien Stripe Checkout avec frais de livraison fixes;
- préparer une transaction Tap to Pay avec un `PaymentIntent` Terminal;
- synchroniser ou annuler une transaction Tap to Pay préparée.

Limite importante: Stripe Tap to Pay ne peut pas lire une carte depuis une page web.
Le paiement NFC doit être collecté dans une app mobile native iOS, Android ou React Native avec le Stripe Terminal SDK.

Endpoints utiles pour l'app mobile:

- `POST /api/admin/products/terminal/connection-token`
  - retourne `{ secret }` pour initialiser Stripe Terminal.
- `POST /api/admin/products/:id/tap-to-pay-intent`
  - réserve le produit, crée une commande `PENDING` et retourne `{ clientSecret, paymentIntentId, orderId }`.
- `POST /api/admin/products/terminal/payment-intents/:paymentIntentId/sync`
  - si le paiement est `succeeded`, marque la commande `PAID`, commit le stock et envoie les courriels.
- `POST /api/admin/products/terminal/payment-intents/:paymentIntentId/cancel`
  - annule le PaymentIntent non payé, supprime la commande pending et libère le stock.

Pour iPhone, il faut aussi l'entitlement Apple Tap to Pay avant publication.
