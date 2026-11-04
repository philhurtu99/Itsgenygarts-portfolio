# Administration mobile du portfolio

Application Expo / React Native combinant l’administration web dans une WebView contrôlée, les notifications et les intégrations natives de vente en personne.

## Exploration locale

Depuis la racine du dépôt :

```bash
npm run install:mobile
npm run setup:local
npm run mobile:dev
```

Le backend et l’admin web doivent déjà être démarrés. `mobile-admin/.env` indique quelle copie utiliser. Sur un téléphone physique, remplacer `localhost` par l’adresse LAN de l’ordinateur, permettre les connexions LAN de l’API pour ce test et adapter les origines CORS.

Le helper `LAN_IP=<adresse-locale> npm run mobile:admin` démarre l’admin web accessible sur le réseau et Expo avec les URL de cette machine. Il ne démarre pas l’API.

## Fonctions présentes

- WebView limitée à l’origine et au chemin admin configurés.
- Stockage sécurisé et synchronisation de la session administrative.
- Consultation des produits, demandes, commandes et statistiques via l’API.
- Actions de stock, statuts, messages et paiements exposées par l’API.
- Notifications Expo sur appareil physique, après configuration d’un projet personnel.
- Stripe Terminal / Tap to Pay et gestion des erreurs de connexion, permissions et compatibilité.

## Build et notifications personnelles

Les identifiants d’application sont des exemples. Aucun propriétaire Expo/EAS, projet EAS réel, fichier Google réel ou entitlement de production n’est associé à cette copie.

Créer son propre projet Expo/EAS pour une build personnelle. Pour Android, télécharger le fichier `google-services.json` de son propre projet Firebase et déclarer son chemin dans la configuration Expo seulement lorsque cette intégration est voulue. Le fichier `google-services.example.json` illustre la structure, mais n’active aucun service. Le vrai fichier est ignoré par Git. Pour iOS, configurer ses propres identifiants, capacités et profils Apple.

Stripe Terminal et Tap to Pay demandent une build native et une configuration Stripe compatible; Expo Go ne fournit pas ce module natif. Les profils EAS fournis sont des modèles de développement/preview, sans profil de soumission en production.

Voir [la configuration générale](../docs/CONFIGURATION.md) et [le README du projet](../README.md).
