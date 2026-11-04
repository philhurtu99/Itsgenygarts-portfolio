# Configuration de la démonstration

`npm run setup:local` crée les fichiers `.env` manquants et génère deux valeurs aléatoires dans `backend/.env` : le secret JWT et le mot de passe des comptes de démonstration. Les fichiers existants sont conservés. Aucun de ces fichiers n'est versionné.

| Paramètre | Valeur locale ou usage |
| --- | --- |
| `DATABASE_URL` | Base PostgreSQL dédiée `itsgenygarts_portfolio`, sur `127.0.0.1:55432`. |
| `JWT_SECRET` | Valeur aléatoire générée localement. |
| `ADMIN_SEED_EMAIL` | `admin@example.test`, compte administratif fictif. |
| `ADMIN_SEED_PASSWORD` | Généré localement; également utilisé pour le client fictif `client@example.test`. |
| `CORS_ORIGIN` | Boutique `http://localhost:3000` et admin `http://localhost:3002`. |
| `IMAGE_STORAGE=local` | Enregistre les nouveaux médias de la démonstration dans `backend/.local/`. |
| `BACKGROUND_JOBS_ENABLED=false` | Désactive les tâches automatiques pendant l'exploration locale. |
| `CURRENCY_RATE_AUTO_UPDATE=false` | Garde les taux de démonstration locaux. |
| `VITE_API_URL` | Adresse de l'API de cette copie, jamais celle de la boutique réelle. |

## Intégrations facultatives

Le catalogue, les comptes de démonstration, les favoris, le panier et une grande partie de l'administration peuvent être explorés avec la base locale. Les intégrations externes ne sont pas simulées silencieusement : les fonctions qui en dépendent demandent une configuration explicite.

| Intégration | Variables | Limite de la copie locale |
| --- | --- | --- |
| Stripe Checkout et webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Utiliser uniquement un compte et des clés de test pour une démonstration. |
| Stripe Terminal | Variables Stripe et `STRIPE_TERMINAL_*` | App native, matériel/appareil et configuration Stripe compatibles nécessaires. |
| Shippo | `SHIPPO_API_TOKEN`, origine d'expédition et réglages `SHIPPO_*` | Aucun tarif ou achat d'étiquette n'est lancé par le setup ou les seeds. Les fonctions réseau demandent leur propre configuration. |
| Cloudinary | `CLOUDINARY_*` | Facultatif pour le développement, qui utilise le stockage local. |
| Emails | `SMTP_*`, profils d'expéditeur et éventuellement `DKIM_*` | Aucun vrai serveur ni destinataire n'est fourni. Les comptes seedés permettent d'explorer l'authentification sans envoyer d'email. |
| Notifications mobiles | Projet Expo/EAS et Firebase/APNs personnels | Le projet mobile réel et son fichier Google ne sont pas inclus. |
| Sentry | `SENTRY_DSN`, `VITE_SENTRY_DSN` | Désactivé par défaut. |
| Mapbox | `VITE_MAPBOX_TOKEN` | Token navigateur à configurer selon le besoin. |

## Mobile

Le navigateur de l'ordinateur utilise `localhost`; un téléphone physique doit utiliser l'adresse LAN de cet ordinateur. Configurer `LAN_IP` puis lancer `npm run mobile:admin`. L'API doit être démarrée séparément et écouter sur le LAN choisi pour ce test. Conserver la démonstration sur un réseau de confiance.

Pour une build native personnelle, créer son propre projet Expo/EAS. Les identifiants Android/iOS de cette copie sont des exemples. Reconfigurer Firebase/APNs et les autorisations nécessaires aux notifications et à Stripe Terminal; ne pas réutiliser la configuration de production d'un autre projet.
