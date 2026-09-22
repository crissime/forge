# Compte rendu d'activite - Ariane

Date: 2026-07-08
Agent: Ariane
Projet: Forge Master
Branche observee: `test`
HEAD observe: `0370ef6 simplify v3 build and simulation UX`

## Pourquoi ce fichier existe

Ce fichier sert de relais si quelqu'un reprend le sujet. Il resume les decisions, les changements faits, les commandes utiles et les points de vigilance autour du simulateur, du comparateur et des BIS.

## Etat court

- Le moteur de combat est maintenant la source principale pour juger la progression.
- `progress` score le combat cible via le scenario `gauntlet` quand des scenarios sont fournis.
- Le comparateur envoie les scenarios choisis dans l'UI a l'API, donc il compare sur le combat selectionne.
- Le correctif des lignes secondaires a `0` est conserve: une ligne choisie a zero remplace bien l'ancienne ligne.
- Les BIS actuels doivent rester bases sur pets, monture et sorts niveau 1, parce que les monter est trop couteux pour les joueurs.
- Pas de deploiement prod demande/fait sur le dernier changement `progress`/comparateur.

## Etat Git au moment du rapport

Dernier commit visible:

```text
0370ef6 simplify v3 build and simulation UX
```

Fichiers non suivis visibles avant creation de ce rapport:

```text
simulatedBis.json
simulatedBis.v3-new.json
tmp/
v4/
```

Ne pas supprimer ces fichiers sans verifier avec le proprietaire: ils peuvent contenir des resultats de generation BIS ou des sorties de travail.

## Moteur simulateur

Fichiers principaux:

- `packages/simulator/src/index.ts`
- `packages/simulator/test/simulator.test.ts`

Exports publics a garder compatibles:

- `manualProfile`
- `normalizeOneVcianProfile`
- `evaluateProfile`
- `evaluateProfileSnapshot`
- `evaluatePvp`
- `compareDrop`
- `combatProfile`

Comportements importants deja implementes:

- Recalcul attaque/PV depuis objets, pets, monture, talents et `game-data` quand le modele est reconnu.
- Buckets confirmes:
  - Arme: `Damage + Melee/Ranged Damage` dans le meme bucket.
  - Sorts: `Damage + Skill Damage` dans le meme bucket.
  - `Attack Speed`, `Double Chance`, critique sont des multiplicateurs separes.
  - `Lifesteal` se calcule sur le DPS arme, pas sur les sorts.
  - `Regen` est une regeneration continue de PV/s.
  - `Block` existe en mode RNG seedable ou moyenne.
- Timeline PvE/PvP:
  - cooldowns,
  - buffs,
  - multi-hit,
  - AOE,
  - RNG block,
  - vagues reelles depuis les donnees de combat.
- Deplacement avant combat:
  - entre les vagues, le joueur regen pendant la pause/deplacement,
  - melee contre ennemis distance: delai d'approche avant DPS arme joueur,
  - melee contre melee: delai d'approche plus court,
  - pendant l'approche mixte, seuls les degats distance ennemis tapent d'abord, puis toute la vague tape apres contact.

Dernier changement moteur important:

- `scoreCombat(..., "progress", scenarios)` retourne maintenant le score `gauntlet` si les scenarios existent.
- Sans scenario, le fallback historique reste la pour compatibilite interne.
- `compareDrop(...)` accepte maintenant `fightDuration` et `scenarioSettings`, puis appelle `evaluateProfile(...)` avec ces memes reglages pour le profil actuel et le candidat.

## Comparateur

Fichiers principaux:

- `apps/web/src/features/compare/ComparePage.tsx`
- `apps/web/src/api/client.ts`
- `apps/api/src/server.ts`

Changements faits:

- `ComparePage` lit `scenarios` depuis le store.
- `api.compare(profile, objective, drop, scenarios)` envoie `scenarios` et `fightDuration: 60`.
- `/api/simulations/drop-compare` accepte `scenarios` et les passe a `compareDrop`.
- En objectif PvP cote UI moderne, le comparateur force encore `progress`, comme avant.

Point de vigilance:

- `apps/web/src/legacy/LegacyApp.tsx` poste encore sur `/api/simulations/drop-compare` sans scenarios. C'est acceptable pour le legacy grace au fallback, mais ce n'est pas le flux moderne a utiliser pour verifier les builds.

## BIS

Fichier principal:

- `scripts/generate-simulated-bis.mjs`

Fichier servi par l'API:

- par defaut API: `/data/forge-master/simulatedBis.json`
- override possible: `FM_BIS_FILE`

Schema attendu par l'API:

- `schema: "forge-master-exhaustive-bis-v1"`
- `assumptions.companionLevel === 1`
- `assumptions.spellLevel === 1`
- `cases` doit etre un objet

Si le fichier manque ou ne correspond pas, `/api/bis/latest` repond comme BIS indisponible/generation en cours. C'est volontaire pour eviter d'afficher une fausse info.

Decisions BIS importantes:

- Les pets peuvent etre equipes plusieurs fois. Le generateur autorise les triples avec doublons.
- Les BIS doivent utiliser pets/monture/sorts niveau 1.
- Les talents ne font pas partie de l'espace BIS; ils restent editables/simulables dans le profil.
- Le mode pratique actuel n'est pas le full brut initial. Il utilise une selection canonique pour rendre les runs faisables:
  - age equipement selectionne,
  - un objet canonique par slot non-arme,
  - variants arme melee/hybride/distance,
  - pets selon le mode choisi,
  - une monture canonique,
  - trio de sorts retenu pour la rarete,
  - stats secondaires optimisees par beam + swaps locaux, sauf si `FM_BIS_EXHAUSTIVE_STATS=1`.

Regles d'accessibilite encodees actuellement:

- Age 4/5: normal attendu pet Epic, monture Common, sort Epic, avec fenetre +/-1 rarete.
- Age 6/7: normal attendu pet Legendary, monture Rare, sort Legendary, avec fenetre +/-1 rarete.
- Age 8/9: pet Legendary a Mythic, monture Epic a Mythic, sort Legendary a Mythic.

Regles de stats controlees si `FM_BIS_CONTROLLED=1` ou `FM_BIS_STAT_RULES=controlled`:

- `rangedDamage` est retire.
- `cooldown > 0` exige `skillDamage > 0`.
- `doubleChance > 0` exige `attackSpeed > 0`.
- `critDamage > 0` exige `critChance > 0`.
- `lifesteal > 0` exige au moins une stat DPS arme: `damage`, `meleeDamage`, `attackSpeed`, `doubleChance`, `critChance`.

Options BIS utiles:

```powershell
$env:FM_BIS_OUTPUT='simulatedBis.json'
$env:FM_BIS_CHECKPOINT='.bis-v4.checkpoint.jsonl'
$env:FM_BIS_RESUME='1'
$env:FM_BIS_WORKERS='24'
$env:FM_BIS_MAX_WORKERS='24'
$env:FM_BIS_BEAM='16'
$env:FM_BIS_CONTROLLED='1'
$env:FM_BIS_OBJECTIVES='reach,progress,damage,survival'
npm run bis:generate
```

Pour un test cible:

```powershell
$env:FM_BIS_CASES='5|Epic|Common|Epic|progress'
$env:FM_BIS_OUTPUT='bis-beam16-5-epic-common-epic-progress.json'
$env:FM_BIS_CHECKPOINT='.bis-one-case.checkpoint.jsonl'
$env:FM_BIS_RESUME='1'
$env:FM_BIS_WORKERS='9'
$env:FM_BIS_BEAM='16'
$env:FM_BIS_CONTROLLED='1'
npm run bis:generate
```

Pour reduire la fin de run avec un seul worker qui traine, utiliser des shards:

```powershell
$env:FM_BIS_CASE_SHARDS='8'
```

Pour tester toutes les allocations de stats secondaires exactes:

```powershell
$env:FM_BIS_EXHAUSTIVE_STATS='1'
```

Attention: cette option peut exploser le temps de calcul.

## Build et scripts

Root `package.json`:

- `npm run build` lance aussi `node scripts/generate-simulated-bis.mjs`.
- Donc pour compiler sans regenerer les BIS, utiliser les builds workspace separes.

Commandes de validation recentes:

```powershell
npm test -- --run packages/simulator/test/simulator.test.ts
npm run build -w packages/simulator
npm run build -w apps/api
$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run build -w apps/web
```

Derniere validation connue:

- tests simulateur cibles: 22/22 OK,
- build simulateur: OK,
- build API: OK,
- build web: OK avec `NODE_OPTIONS=--max-old-space-size=8192`.

## Historique de problemes traites

- Docker build relancait le calcul BIS via le script root `build`; solution pratique: build les workspaces separement quand on ne veut pas regenerer.
- Docker/Vite avait deja plante avec `Aborted (core dumped)`; le build web passe avec plus de memoire Node.
- Les premiers BIS utilisaient pets/sorts niveau 100, ce qui etait irrealisable pour les joueurs. La cible est maintenant niveau 1.
- Les premiers BIS interdisaient les doublons pets; c'etait faux. Les doublons sont maintenant acceptes.
- Le front affichait un reach estime du BIS qui ne correspondait pas a la simulation manuelle si les niveaux pets/sorts etaient differents. La decision est de garder BIS a niveau 1.
- Le comparateur pouvait juger deux items equivalents si la stat secondaire candidate etait choisie a `0`; corrige en gardant la ligne a zero comme une vraie ligne.
- `progress` etait trop abstrait et ressemblait a un mix DPS/survie; corrige pour suivre le combat cible via `gauntlet`.

## Ce qu'il faut verifier avant une prochaine prod

1. S'assurer que le fichier BIS a le bon schema et `companionLevel/spellLevel` a 1.
2. Verifier une combinaison connue dans l'UI, par exemple `5|Epic|Common|Epic|progress`.
3. Tester le comparateur sur deux niveaux differents et confirmer que le score change avec le combat selectionne.
4. Relancer les commandes de validation ci-dessus.
5. Ne pas utiliser `npm run build` si le but est seulement de compiler sans BIS.
6. Ne pas redeployer sans instruction explicite du proprietaire.

## Fichiers a connaitre

- `packages/simulator/src/index.ts`: moteur de combat, score, compareDrop.
- `packages/simulator/test/simulator.test.ts`: tests moteur et comparateur.
- `scripts/generate-simulated-bis.mjs`: generation BIS.
- `apps/api/src/server.ts`: endpoints evaluate, drop-compare, bis/latest.
- `apps/web/src/api/client.ts`: client API front.
- `apps/web/src/features/compare/ComparePage.tsx`: comparateur moderne.
- `apps/web/src/features/simulation/BisPage.tsx`: affichage BIS moderne.
- `apps/web/src/store/workshop.ts`: store scenarios/profil/BIS.
- `apps/web/src/types.ts`: types front dont scenarios et BIS access.

## Reprise rapide

Si quelqu'un reprend:

1. Lire ce fichier.
2. Faire `git status --short`.
3. Ne pas supprimer les JSON BIS non suivis sans demande.
4. Lancer la suite cible simulateur.
5. Tester le comparateur dans l'UI moderne, pas le legacy.
6. Pour BIS, commencer par un seul case avec `FM_BIS_CASES`, puis seulement ensuite lancer le gros run.
