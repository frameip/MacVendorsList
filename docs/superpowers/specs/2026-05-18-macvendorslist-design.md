# MacVendorsList — Design

Date : 2026-05-18
Repo : https://github.com/slynet76/MacVendorsList

## Objectif

Site web statique hébergé sur GitHub Pages permettant de coller un lot
d'adresses MAC et d'obtenir le constructeur (fabricant) de chacune.

## Approche retenue

Site statique vanilla (HTML/CSS/JS), aucune étape de build, déployé sur
GitHub Pages. Résolution **hybride** : base OUI IEEE locale embarquée en
priorité, fallback sur l'API `api.macvendors.com` pour les OUI inconnus.

## Architecture

Fichiers à la racine du repo :

- `index.html` — structure de la page
- `style.css` — mise en forme
- `app.js` — point d'entrée, câblage des événements et rendu
- `lib/parse.js` — fonctions pures : parsing, normalisation, extraction OUI
- `lib/resolve.js` — résolution hybride (lookup local + file d'attente API)
- `oui.json` — base OUI locale embarquée (préfixe 6 hex → nom constructeur)
- `scripts/build-oui.mjs` — script Node manuel régénérant `oui.json` depuis
  la base IEEE officielle
- `test/parse.test.mjs` — tests Node de la logique pure

## Flux de données

1. L'utilisateur colle des adresses dans une textarea. Séparateurs acceptés
   entre adresses : retour à la ligne, virgule, point-virgule, espace.
2. `lib/parse.js` normalise chaque entrée. Formats d'adresse acceptés :
   - `AA:BB:CC:DD:EE:FF` (deux-points)
   - `AA-BB-CC-DD-EE-FF` (tirets)
   - `AABB.CCDD.EEFF` (notation Cisco, points)
   - `AABBCCDDEEFF` (sans séparateur)
   - casse indifférente
   La normalisation produit l'adresse en majuscules avec deux-points et
   extrait l'OUI = 3 premiers octets (6 hex).
3. Résolution hybride dans `lib/resolve.js` :
   - Recherche de l'OUI dans `oui.json`.
   - Les OUI introuvables localement sont mis en file et interrogés sur
     `https://api.macvendors.com/{mac}`, throttlés à 1 requête/seconde.
   - Les résultats API sont mis en cache mémoire (par OUI) pour ne pas
     réinterroger un même préfixe dans la session.
4. Rendu d'un tableau **MAC | Constructeur | Source**. La colonne Source
   vaut `local`, `api` ou `inconnu`. Les lignes résolues via l'API
   apparaissent au fil de l'eau pendant que la file se vide.

## Sortie

- Bouton « Copier le tableau » → copie le contenu dans le presse-papier
  (format tabulé, collable dans un tableur).
- Bouton « Export CSV » → télécharge un fichier `.csv`.

## Gestion d'erreurs

- Adresse au format invalide → ligne conservée dans le tableau, colonne
  Constructeur = « format invalide », Source = `inconnu`. Le reste du lot
  n'est pas bloqué.
- Échec réseau ou rate-limit (HTTP 429) de l'API macvendors.com → ligne
  marquée Source = `inconnu`, et un message discret en haut du tableau
  invite à réessayer plus tard. Le throttling à 1 req/s limite ce risque.
- Aucune adresse valide saisie → message d'invite, pas de tableau.

## Base OUI locale

`scripts/build-oui.mjs` télécharge la base OUI officielle de l'IEEE
(`https://standards-oui.ieee.org/oui/oui.csv`) et génère `oui.json`, un
objet `{ "AABBCC": "Nom du constructeur" }`. Le fichier généré est commité
dans le repo. Régénération manuelle (pas d'automatisation pour l'instant).

## Tests

`test/parse.test.mjs` couvre la logique pure de `lib/parse.js` avec le
runner de test intégré de Node :

- normalisation des 4 formats d'adresse
- gestion de la casse
- extraction correcte de l'OUI
- détection des entrées invalides (longueur incorrecte, caractères non hex)
- découpage d'un bloc multi-adresses selon les séparateurs

## Déploiement

GitHub Pages servi depuis la branche par défaut, racine du repo. Le site
étant statique sans build, aucune GitHub Action n'est nécessaire.

## Hors périmètre (YAGNI)

- Rafraîchissement automatique de `oui.json` via GitHub Action.
- Persistance / historique des recherches.
- Backend ou proxy d'API.
