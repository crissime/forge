# Architecture v4 cible

Version minimale proposee. Pas de couche "au cas ou".

## Modules

```text
v4/
  README.md
  etat-des-lieux.md
  architecture.md
  simulateur.md
  sources.md
  src/
    game-data/
    sim/
    bis/
    api/
    web/
```

Le dossier `src/` n'est pas encore cree: on attend de valider le contrat du simulateur.

## Responsabilites

### `game-data`

- Charger les JSON de jeu.
- Normaliser les stats, sorts, items, pets, montures, ennemis.
- Exposer des donnees immuables et versionnees.

### `sim`

- Normaliser un profil.
- Construire un profil combat.
- Simuler un combat cible.
- Retourner un verdict stable.

Le module `sim` ne connait pas l'UI, l'API, le BIS ou la persistence.

### `bis`

- Enumerer les candidats accessibles.
- Appeler `sim` pour chaque candidat.
- Trier les candidats avec un score.
- Stocker le verdict exact du meilleur candidat.

Le module `bis` n'a pas sa propre definition de "passe".

### `api`

- Valider les payloads.
- Charger les donnees v4.
- Appeler `sim` et `bis`.
- Retourner les resultats.
- Lire les profils existants et les migrer a la volee si la structure v4 change.

### `web`

- Editer/importer un profil.
- Envoyer le profil a l'API.
- Afficher les resultats.

Le web ne recalcule pas les stats finales de combat.

## Compatibilite profils

Contrainte non negociable: aucun utilisateur deja present ne doit refaire son profil.

Deux options seulement:

- garder le format profil actuel comme format d'entree v4;
- ou fournir un migrateur automatique `v3 -> v4`, teste sur des profils reels/anonymises.

La v4 peut changer les modules internes, pas perdre les donnees utilisateur.

## Flux unique

```text
profil brut
  -> normalizeProfile()
  -> buildCombatProfile()
  -> simulateFight()
  -> passVerdict()
  -> API/UI/BIS
```

## Donnees generees v4

Un fichier BIS v4 doit contenir au minimum:

```json
{
  "schema": "forge-master-v4-bis-v1",
  "gameDataVersion": "2026_05_23_14_08",
  "generatedAt": "ISO date",
  "assumptions": {
    "equipmentLevel": 98,
    "companionLevel": 1,
    "spellLevel": 1,
    "verdictRule": "target_fight_all_waves_cleared"
  },
  "cases": {}
}
```

## Tests minimum

- Un test du verdict: un profil qui passe et un profil qui echoue sur le meme combat.
- Un test BIS: le cas genere contient exactement le verdict donne par `sim`.
- Un test API: `/evaluate` et `/bis` ne divergent pas sur le meme profil/cas.
