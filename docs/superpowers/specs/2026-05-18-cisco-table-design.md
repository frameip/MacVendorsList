# MacVendorsList — Mode Tableau Cisco

Date : 2026-05-18
Repo : https://github.com/frameip/MacVendorsList

## Objectif

Étendre le site pour accepter en entrée la sortie brute d'un `show mac
address-table` Cisco, en plus du mode liste de MAC simple existant.
Le format est auto-détecté — aucun choix manuel de l'utilisateur.

## Format d'entrée Cisco

```
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 All    0100.0ccc.cccc    STATIC      CPU
   1    04d5.90d0.f034    DYNAMIC     Po2
  93    0009.0f09.0003    DYNAMIC     Gi2/0/45
Total Mac Addresses for this criterion: 104
```

Colonnes : VLAN (numérique ou `All`), MAC (format Cisco `XXXX.XXXX.XXXX`),
Type (`STATIC` / `DYNAMIC`), Port (ex. `Gi1/0/6`, `Po2`, `CPU`).

## Détection automatique

`detectFormat(text)` dans `lib/parse.js` :
- Renvoie `'cisco'` si le texte contient une ligne correspondant à
  `/vlan\s+mac\s+address\s+type\s+ports/i`.
- Renvoie `'simple'` sinon.

## Nouvelles fonctions dans lib/parse.js

### `detectFormat(text) → 'cisco' | 'simple'`

Scan ligne par ligne, retourne `'cisco'` dès qu'une ligne matche
le pattern d'en-tête, sinon `'simple'`.

### `parseCiscoTable(text) → Array<{vlan, rawMac, type, port}>`

Ligne par ligne :
- Ignore l'en-tête (`/vlan\s+mac\s+address/i`).
- Ignore les séparateurs (`/^[\s\-]+$/`).
- Ignore les totaux (`/^total/i`).
- Parse les lignes de données avec le regex :
  `/^\s*(\S+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\S+)\s+(\S+)/i`
  → `{ vlan, rawMac, type, port }`.
- Les lignes qui ne matchent pas sont ignorées silencieusement.

`rawMac` est ensuite normalisé via `normalizeMAC()` existant.

## Modifications de app.js

Au clic sur "Identifier" :

1. Détecter le format : `detectFormat(input.value)`.
2. **Mode `simple`** : comportement actuel inchangé.
3. **Mode `cisco`** :
   - Appeler `parseCiscoTable(input.value)` → tableau de lignes.
   - Pour chaque ligne, normaliser `rawMac` → `mac` (ou `null` si invalide).
   - Passer les entries `{raw: rawMac, mac}` à `resolveAll()`.
   - Fusionner les résultats de `resolveAll` avec les métadonnées Cisco
     (`vlan`, `type`, `port`) pour construire les lignes de rendu.
4. Rendre le tableau avec les colonnes adaptées au mode.

## Tableau de résultats

### Mode `simple` (inchangé)
| Adresse MAC | Constructeur | Source |

### Mode `cisco`
| VLAN | Adresse MAC | Type | Port | Constructeur | Source |

Les `<th>` du tableau sont injectés dynamiquement par `app.js` selon le
mode détecté. Le `<tbody>` est rendu de la même façon qu'en mode simple.

## Placeholder du textarea

Le placeholder est mis à jour pour montrer les deux formats acceptés :

```
Mode liste :          Mode tableau Cisco :
AA:BB:CC:DD:EE:FF     Vlan  Mac Address        Type     Ports
AA-BB-CC-DD-EE-FF     ----  -----------        ----     -----
AABB.CCDD.EEFF          93  0009.0f09.0003  DYNAMIC  Gi2/0/45
```

## Gestion d'erreurs

- Ligne Cisco avec MAC invalide : la ligne est incluse dans le tableau
  avec Constructeur = `format invalide`, Source = `invalid`.
- Lignes non reconnues (séparateurs, en-tête, totaux) : ignorées
  silencieusement, pas d'affichage dans le tableau.
- Mode simple : comportement existant inchangé.

## Tests (test/parse.test.mjs)

Nouveaux cas à ajouter :

- `detectFormat` : renvoie `'cisco'` sur un bloc avec en-tête Cisco.
- `detectFormat` : renvoie `'simple'` sur une liste de MAC seules.
- `parseCiscoTable` : parse une ligne VLAN numérique correctement.
- `parseCiscoTable` : parse une ligne VLAN `All` correctement.
- `parseCiscoTable` : ignore les séparateurs (`----`).
- `parseCiscoTable` : ignore la ligne `Total Mac Addresses`.
- `parseCiscoTable` : ignore l'en-tête.
- `parseCiscoTable` : retourne un tableau vide sur entrée vide.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `lib/parse.js` | +`detectFormat`, +`parseCiscoTable` |
| `app.js` | détection format, rendu conditionnel des colonnes |
| `index.html` | placeholder mis à jour, `<thead>` vidé (rempli par JS) |
| `test/parse.test.mjs` | +8 nouveaux cas |

## Hors périmètre (YAGNI)

- Filtrage par VLAN ou port.
- Tri des colonnes.
- Support d'autres constructeurs de switch (HP, Juniper…).
- Export CSV avec colonnes Cisco (possible mais non demandé).
