# Configuration Shippo

Shippo fournit les tarifs de livraison au checkout et permet a l'admin d'acheter
et de telecharger les etiquettes une a la fois.

## Variables serveur

La livraison vers les États-Unis est temporairement suspendue. Le pays est désactivé dans les formulaires publics, et le serveur refuse les nouveaux tarifs, checkouts, demandes sur mesure/devis et achats d’étiquettes vers les USA avant tout appel au transporteur ou réservation de stock. Les anciens documents d’expédition restent consultables. Le blocage se trouve dans `backend/src/utils/shippingDestination.js` et `frontend/src/utils/address.js` ; les profils douaniers restent disponibles pour les autres destinations hors Canada.

```env
SHIPPO_API_TOKEN="shippo_test_xxx"
SHIPPO_ALLOW_TEST_RATES="true"
SHIPPO_CARRIER="ups"
SHIPPO_CARRIER_ACCOUNT_IDS=""
SHIPPING_ORIGIN_NAME="Itsgenygarts"
SHIPPING_ORIGIN_COMPANY="Itsgenygarts"
SHIPPING_ORIGIN_ADDRESS=""
SHIPPING_ORIGIN_CITY="Laval"
SHIPPING_ORIGIN_PROVINCE="QC"
SHIPPING_ORIGIN_COUNTRY="CA"
SHIPPING_ORIGIN_POSTAL_CODE=""
SHIPPING_ORIGIN_PHONE=""
SHIPPING_ORIGIN_EMAIL="info@example.test"
SHIPPING_CUSTOMS_SIGNER=""
```

`SHIPPO_CARRIER_ACCOUNT_IDS` reste vide normalement. Le backend selectionne
automatiquement le compte UPS correspondant au Canada.

Pour les envois hors Canada, `SHIPPING_CUSTOMS_SIGNER` doit contenir le nom
legal de la personne qui certifie la declaration douaniere. Le backend joint
automatiquement la declaration de marchandise aux tarifs Shippo. Une fois
l'etiquette achetee, la facture commerciale est telechargeable dans la commande
admin. Dans chaque produit/laine, la section Douanes permet d'entrer une
description anglaise precise, le poids net sans emballage, le pays de fabrication
et le code HS/HTS adapte a l'article. Ne pas utiliser l'adresse d'expedition pour
deduire le pays de fabrication. Le code global `SHIPPING_CUSTOMS_TARIFF_NUMBER`
n'est plus utilise. Les articles existants restent disponibles au Canada, mais
les tarifs internationaux sont bloques tant que ces champs ne sont pas remplis.
`SHIPPING_ORIGIN_PHONE` ainsi que le telephone du client sont obligatoires pour
les envois internationaux.

## Test local

### Profils douaniers et formulaire admin

L'interface demande le type d'article, son poids net et son pays de fabrication.
Pour les bandanas/foulards plats au crochet, bonnets et sacs a main avec exterieur
textile, des profils internationaux HS a six chiffres remplissent la description
anglaise et le code sans demander de pourcentages de fibres. La description indique
honnetement une composition non precisee. Ces profils n'ont aucun code HTS USA;
les livraisons aux USA restent bloquees. Les anciens profils detailles et les
donnees manuelles existantes sont conserves. Les pelotes vendues seules conservent
leurs profils specifiques, car leur classification depend du type de fil.

La categorie peut enregistrer le profil et le pays de fabrication par defaut.
Le formulaire reprend ces reglages, avec personnalisation par article. Le devis
exige une classification enregistree sur l'article; un melange ne recoit jamais
automatiquement une description affirmant une matiere pure. Le poids
net reel reste indispensable et n'est jamais deduit du poids emballe.
Appliquer la migration additive `20261008040000_add_category_customs_origin`.

Produits et laines utilisent quatre etapes : Informations, Photos, Expedition,
Publication. La navigation conserve les champs et les photos en cours; le bouton
de sauvegarde finale valide l'ensemble. L'edition des photos et variations d'un
article existant garde son fonctionnement immediat, meme avant la sauvegarde finale.

Dans Expedition, un profil preconfigure remplit la description anglaise et les
codes douaniers. Pour les profils internationaux simples, choisir le type suffit;
les anciens profils detailles gardent la confirmation de leurs caracteristiques.
Le pays des produits est celui ou l'article a ete fabrique; le pays d'une pelote
vendue seule reste celui du fil. Aucun pays n'est deduit de l'adresse du vendeur.
L'article peut etre enregistre avant de connaitre son poids/pays, mais le devis
international reste bloque tant que ces donnees manquent. Aucun profil n'est attribue aux
anciens articles. Les donnees manuelles existantes sont conservees.

Les profils sont limites : bonnet adulte 100 % acrylique sans tresse, sac a main
avec exterieur synthetique, peluche animale jouet pour 3 a 12 ans, et fil de fibres
discontinues 100 % acrylique pour vente au detail (hors chenille/fantaisie).
Voir les criteres et references CBP dans `backend/src/utils/customsProfiles.js`.
Ces references concernent des articles comparables, pas une decision douaniere
contraignante pour le catalogue Itsgenygarts. Confirmer la classification des
articles reels avant la production; ajouter un profil confirme pour les autres
matieres/usages plutot que reutiliser un code approximatif.

Le serveur utilise le code HS a six chiffres pour les destinations internationales
autorisees. Les anciens codes HTS restent conserves et les nouveaux profils
internationaux ne peuvent pas etre utilises pour les USA. Les donnees manuelles restent
inchangees. Un profil inconnu bloque le devis international au lieu d'etre devine.
Appliquer la migration additive `20261006160000_add_customs_profile_key` avant
de demarrer ce backend. Le formulaire ne declenche aucun appel de tarif Shippo.

### Frais d'importation a la charge du destinataire

L'integration reste en DDU, sans calcul ni collecte des droits de douane dans
Stripe. Au checkout hors Canada, le client doit cocher une case non preselectionnee.
Le serveur exige `importFeesAccepted=true` et la version actuelle fournie par
`calculate-shipping`. Il enregistre dans la commande la date serveur, la version,
la langue et le texte exact de l'avertissement, sans collecte d'adresse IP.
Un changement du panier, de l'adresse, du service ou de la langue demande une
nouvelle acceptation. Le texte est rappele dans les courriels de confirmation
et d'expedition, et figure dans les conditions de vente. Les commandes canadiennes
et les ventes POS ne recoivent pas ce consentement douanier.

Cette acceptation ne modifie pas le contrat du transporteur : UPS peut reclamer
des frais a l'expediteur si le destinataire ne paie pas. Ne pas promettre une
exoneration totale ni appliquer automatiquement des retenues de remboursement.
Pour les USA, confirmer le fonctionnement Pre-Entry DDU du compte reel avant
l'activation en production; une etiquette de test ne prouve pas cette prise en charge.
Sources : [Shippo](https://support.goshippo.com/hc/en-us/articles/203004889-Understanding-Customs-Declarations)
et [UPS](https://www.ups.com/us/en/shipping/international-shipping/import-fees).
Appliquer la migration additive `20261006133000_add_import_fees_consent` avant
de demarrer le nouveau backend. Aucune donnee ni ancienne commande n'est supprimee.

```bash
cd backend
npm run test:shippo
# Un seul tarif USA en mode test, sans achat d'etiquette
npm run test:shippo -- --usa
# Etiquette et facture commerciale, uniquement avec une cle de TEST
npm run test:shippo -- --usa --label
```

Une cle `shippo_test_...` retourne des tarifs et des etiquettes de test qui ne
sont pas utilisables pour une vraie expedition. En production, utiliser une cle
`shippo_live_...` et garder `SHIPPO_ALLOW_TEST_RATES=false`.

## Achat d'etiquette incertain

Le verrou d'achat n'expire pas automatiquement. Une panne reseau, une reponse
illisible ou une transaction en attente ne doit jamais provoquer un second achat.
La reference Shippo est sauvegardee des qu'elle est connue, avant les details de
l'etiquette. Le bouton "Verifier l'etiquette existante" effectue uniquement une
lecture de la transaction. Si sa reference n'a pas ete recue, consulter Shippo et
entrer son ID dans la commande. La reference, le tarif et le numero de commande
sont verifies avant de rattacher l'etiquette. Un refus definitif de Shippo libere
le verrou; une incertitude reste bloquee pour verification manuelle.

La facture commerciale n'est pas la facture client. Pour UPS, verifier les
instructions douanieres du transporteur et la mention EDI sur l'etiquette avant
de conclure que l'envoi des documents a ete effectue electroniquement.


La composition demandée est celle du produit fini et doit tenir compte de tous
les fils utilisés, quels que soient leurs fournisseurs. Aucun fournisseur n'est
imposé et aucune composition n'est déduite de la catégorie commerciale. Les
mélanges inconnus restent « à vérifier » et peuvent être sauvegardés sans profil
ni code douanier. Les ventes au Canada restent possibles ; l'expédition
internationale nécessite des données complètes. Les profils proposés sont
limités à leur portée confirmée par le propriétaire, notamment 100 % coton,
acrylique, laine ou alpaga pour les foulards plats. La migration additive
`20261008040000_add_category_customs_origin` ajoute seulement des colonnes
optionnelles d'origine aux catégories existantes, sans changer leurs noms ni
les produits du catalogue.
