# Etat des lieux v3

Date du point: 2026-07-08.

## Structure actuelle

Le depot est un monorepo npm:

- `apps/web`: front React/Vite.
- `apps/api`: API Fastify.
- `packages/simulator`: moteur de normalisation, combat, PvP, drop compare.
- `packages/game-data`: donnees normalisees depuis les JSON du jeu.
- `scripts/generate-simulated-bis.mjs`: generation BIS.
- `prisma`: stockage comptes/profils.
- `docs`: notes de contexte.

Il existe aussi une ancienne app racine (`src`, `server.js`, `styles.css`) et plusieurs sorties generees `simulatedBis*`.

## Flux de calcul actuel

1. Le front stocke le profil dans `apps/web/src/store/workshop.ts`.
2. Le front recalcule attaque, PV, stats secondaires et talents avant l'appel API.
3. L'API appelle `evaluateProfile`, `evaluatePvp` ou `compareDrop` dans `packages/simulator`.
4. Le moteur recanonise aussi le profil avant de simuler.
5. Le generateur BIS appelle `evaluateProfileSnapshot`, puis applique sa propre logique de `frontier`, `reach` et `battleReach`.
6. L'ecran simulation affiche `gauntlet.success` comme verdict principal.
7. L'ecran BIS affiche des donnees pregenerees lues via `/api/bis/latest`.

## Problemes reperes

### Verdicts contradictoires

Les chemins ne disent pas tous la meme chose:

- `SimulationPage.tsx` affiche "passe" si le scenario `gauntlet` reussit.
- `reachFor` dans le generateur accepte un point si au moins 2 scenarios sur 3 reussissent.
- `battleReachFor` accepte seulement si le `gauntlet` reussit.
- `bisGuide.ts` affiche a la fois `reach` et `battleReach`.

Effet possible: un cas peut etre remonte comme reussi par le BIS alors que le simulateur de combat cible dit non.

### Fichiers BIS multiples

Fichiers observes:

- `apps/web/src/features/simulation/simulatedBis.json`
  - schema `forge-master-exhaustive-bis-v1`
  - genere le 2026-07-01
  - companion/spell level 100
  - 486 cas: `progress`, `damage`, `survival`
  - 277 cas ou `reach` et `battleReach` different
- `simulatedBis.json`
  - non suivi par git
  - genere le 2026-07-02
  - companion/spell level 1
  - 162 cas: objectif `reach` seulement
  - 77 cas ou `reach` et `battleReach` different
- `simulatedBis.v3-new.json`
  - non suivi par git
  - companion/spell level 100
  - 486 cas

L'API lit par defaut `/data/forge-master/simulatedBis.json`, sauf override `FM_BIS_FILE`. Le front appelle `/api/bis/latest`.

### Calcul du profil duplique

Le store front recalcule deja:

- stats secondaires;
- bonus talents;
- attaque/PV equipe/pets/monture;
- equipement fallback.

Puis le moteur recalcule encore via `canonicalizeProfile`. C'est une source de drift.

### Optimisation BIS et simulation melangees

`scripts/generate-simulated-bis.mjs` fait plusieurs jobs a la fois:

- enumeration des cas;
- regles d'acces;
- choix candidats;
- beam search / stats;
- validation de reach;
- format de sortie.

Ca rend difficile de savoir quel morceau ment quand le retour est faux.

## Ce qu'il faut garder

- Donnees normalisees dans `packages/game-data`.
- Liste des stats et mapping `SecondaryStatLibrary`.
- Reconstruction des items/pets/monture depuis les donnees.
- Tests existants utiles comme exemples de comportement.
- Idee du combat temporel avec vagues, sorts, regen, lifesteal, block.

## Ce qu'il faut changer en v4

- Une seule fonction publique pour dire si un combat passe.
- Plus de "2 scenarios sur 3" pour annoncer qu'un combat cible passe.
- Pas de recalcul combat dans le front.
- Une seule sortie BIS courante, avec schema v4.
- Tests golden: le meme cas doit donner le meme verdict dans simulateur, BIS et API.
