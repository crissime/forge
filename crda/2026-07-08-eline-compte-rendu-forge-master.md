# Compte rendu d'activite - Forge Master

Date: 2026-07-08  
Redacteur choisi: Eline  
Depot local: `C:\Users\jekte\OneDrive\Documents\forge master`  
Branche observee: `test`

## Resume court

Le travail a surtout porte sur le simulateur de combat et la generation BIS.

Objectif utilisateur: obtenir un BIS utile pour avancer en PvE, pas seulement un build fort en DPS ou en survie theorique. Le resultat important est le passage d'une logique `progress/damage/survival` a un objectif BIS `reach`: choisir le build qui va le plus loin en ordre reel de progression.

Etat actuel important:

- Le generateur supporte `FM_BIS_OBJECTIVES=reach`.
- Les pets, monture et sorts BIS sont maintenant niveau 1 par defaut.
- Les doublons de pets sont autorises.
- Le run `reach` genere sur VM a produit un `simulatedBis.json` racine non suivi par git: 162 cas, objectif `reach`, companion/spell level 1.
- Le JSON encore integre dans `apps/web/src/features/simulation/simulatedBis.json` est ancien: 486 cas, objectifs `progress/damage/survival`, companion/spell level 100.
- Le dossier `v4/` contient un cadrage de refonte propre pour supprimer les contradictions de verdict.

## Nom choisi

J'ai choisi le nom **Eline** pour signer les comptes rendus: le role ici est surtout de garder le fil entre les choix de simulation, les runs BIS, les erreurs de generation et les deploiements.

## Commits recents utiles

Derniers commits vus le 2026-07-08:

```text
0370ef6 simplify v3 build and simulation UX
13d6dee preserve zero secondary lines in compare
a598b8c add reach bis objective
320fa8e serve bis data outside web bundle
0c829e5 set bis companion levels to one
a0464ac clarify bis progression reach
d4666b9 show bis battle reach
4d3236f deploy bis v3
```

Le commit cle pour le nouveau run est:

```text
a598b8c add reach bis objective
```

## Fichiers non suivis a ne pas ignorer

Etat Git local au moment du compte rendu:

```text
?? simulatedBis.json
?? simulatedBis.v3-new.json
?? tmp/
?? v4/
```

Details:

- `simulatedBis.json`
  - non suivi par git;
  - genere le 2026-07-02;
  - schema `forge-master-exhaustive-bis-v1`;
  - objectifs: `["reach"]`;
  - companionLevel: 1;
  - spellLevel: 1;
  - 162 cas;
  - c'est probablement le fichier BIS reach a integrer ensuite.
- `simulatedBis.v3-new.json`
  - non suivi par git;
  - ancien run v3 niveau 100;
  - ne pas reintegrer tel quel pour le BIS actuel.
- `tmp/`
  - contient des runs de test locaux;
  - ne pas deployer.
- `v4/`
  - notes de cadrage d'une future refonte plus propre;
  - non suivi par git au moment du compte rendu.

Commande de verification du fichier root:

```bash
node -e "const d=require('./simulatedBis.json'); console.log(Object.keys(d.cases).length, d.assumptions.objectives, d.assumptions.companionLevel, d.assumptions.spellLevel)"
```

Resultat attendu pour le run reach:

```text
162 [ 'reach' ] 1 1
```

## Decisions metier prises

### BIS = avance max

La separation `progress`, `damage`, `survival` donnait des resultats difficiles a interpreter. Exemple vu:

- le build `survival` pouvait aller plus loin que `progress`;
- le build DPS etait souvent trop fragile;
- le joueur veut surtout savoir quel build fait passer le plus de combats.

Decision: ajouter un objectif `reach`.

`reach` signifie:

1. classer les candidats par dernier combat passe en ordre reel;
2. utiliser le combat gauntlet comme verdict principal;
3. garder les scores `progress/damage/survival` comme heuristiques ou audit, pas comme verite finale du BIS.

### Pets, monture et sorts niveau 1 pour BIS

Le joueur a precise que monter pets/monture/sorts est trop lourd et ne doit pas etre une obligation pour les joueurs.

Decision:

- objets BIS au niveau max item config;
- pets BIS niveau 1;
- monture BIS niveau 1;
- sorts BIS niveau 1;
- talents exclus du BIS exhaustif, mais toujours simulables dans un profil manuel.

### Doublons de pets autorises

Au depart, le generateur evitait les doublons de modele pet. C'etait faux pour le jeu.

Decision:

- autoriser `Saber Tooth + Saber Tooth + Saber Tooth`;
- les tests couvrent ce cas.

### Checkpoint JSONL avec shards

Avec `FM_BIS_CASE_SHARDS=2`, le checkpoint contient deux lignes par cas:

```text
4|Epic|Common|Epic|reach#1-2
4|Epic|Common|Epic|reach#2-2
```

C'est normal.

Le fichier a integrer n'est pas le `.jsonl`, mais le JSON final:

```text
apps/web/src/features/simulation/simulatedBis.json
```

ou le fichier cible donne dans `FM_BIS_OUTPUT`.

## Changements techniques principaux

### `scripts/generate-simulated-bis.mjs`

Ajouts / corrections:

- `FM_BIS_OBJECTIVES` permet de choisir les objectifs generes.
- Alias objectifs:
  - `dps` -> `damage`;
  - `survie` -> `survival`;
  - `max`, `avance`, `reach` -> `reach`.
- `FM_BIS_REACH_VERIFY_TOP_N` verifie les meilleurs finalistes en reach.
- `FM_BIS_COMPANION_LEVEL` et `FM_BIS_SPELL_LEVEL` existent, defaut `1`.
- `bestPetTriples` autorise les doublons.
- `reach` utilise une heuristique rapide pour trier, puis verifie les finalistes en ordre reel complet.
- Pour `reach`, les beams de stats sont unionnes depuis les anciens objectifs `progress`, `survival`, `damage`, pour ne pas perdre les builds sustain.

Limite volontaire:

- Tous les candidats ne sont pas verifies en ordre reel complet.
- Seuls les meilleurs finalistes sont verifies, par defaut top 100.
- Monter `FM_BIS_REACH_VERIFY_TOP_N` si on veut etre plus parano.
- Utiliser `FM_BIS_EXHAUSTIVE_STATS=1` si on veut toutes les repartitions de stats, mais ce sera beaucoup plus long.

### `apps/web/src/features/simulation/bisGuide.ts`

Ajouts / corrections:

- Lit le schema courant seulement si `companionLevel=1` et `spellLevel=1`.
- Refuse d'afficher un BIS ancien niveau 100 comme une verite.
- Prefere la cle `...|reach` si elle existe.
- Affiche `objectif avance max` pour `reach`.
- Garde fallback sur les anciens objectifs si le JSON ne contient pas encore `reach`.

### Tests

Tests ajoutes ou verifies:

- `packages/simulator/test/bis-generator.test.ts`
  - generation reach minimale;
  - pets niveau 1;
  - monture niveau 1;
  - sorts niveau 1;
  - doublons de pets autorises;
  - stat rules controlees.
- `apps/web/src/features/simulation/bisGuide.test.ts`
  - le guide prefere `reach` si le BIS objectif-specifique a ete retire;
  - le BIS ancien est masque si les assumptions ne sont pas niveau 1.

Commande de test utilisee:

```bash
npm test -- --run packages/simulator/test/bis-generator.test.ts apps/web/src/features/simulation/bisGuide.test.ts
```

Resultat local observe:

```text
2 test files passed
20 tests passed
```

Build web verifie:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run build -w apps/web
```

## Commandes de run BIS

### Smoke test Linux rapide

Important: sur Linux, ne pas utiliser la syntaxe PowerShell `$env:`.

```bash
FM_BIS_OBJECTIVES=reach \
FM_BIS_CASES='4|Epic|Common|Epic|reach' \
FM_BIS_BEAM=2 \
FM_BIS_WORKERS=1 \
FM_BIS_MAX_WORKERS=1 \
FM_BIS_CHOICE_LIMIT=1 \
FM_BIS_STAT_ALLOCATIONS=2 \
FM_BIS_CASE_SHARDS=1 \
FM_BIS_OUTPUT=tmp/reach-smoke.json \
npm run bis:generate
```

Attendu dans les logs:

```text
BIS 4|Epic|Common|Epic|reach: ...
```

Attendu dans le JSON:

```json
"objectives": ["reach"]
```

### Gros run VM Linux

Commande conseillee:

```bash
export FM_BIS_OBJECTIVES=reach
export FM_BIS_BEAM=16
export FM_BIS_WORKERS=40
export FM_BIS_MAX_WORKERS=40
export FM_BIS_CASE_SHARDS=2
export FM_BIS_REACH_VERIFY_TOP_N=100
export FM_BIS_CHECKPOINT=apps/web/src/features/simulation/simulatedBis.reach.checkpoint.jsonl
export FM_BIS_OUTPUT=simulatedBis.json

env | grep FM_BIS
npm run bis:generate
```

Notes:

- `FM_BIS_MAX_WORKERS` est obligatoire pour depasser le cap defaut a 9.
- `FM_BIS_CASE_SHARDS=2` produit 324 lignes checkpoint pour 162 cas finaux.
- Le checkpoint `.jsonl` est pour la reprise, pas pour l'integration.
- Si la VM montre 90% CPU sur ses vCPU, le run exploite bien les coeurs, meme si Proxmox affiche moins cote hote.

### Resume

Si le run a ete coupe et que le checkpoint est sain:

```bash
export FM_BIS_RESUME=1
npm run bis:generate
```

Attention: reprendre avec les memes variables `FM_BIS_OBJECTIVES`, `FM_BIS_CASE_SHARDS`, `FM_BIS_OUTPUT`, `FM_BIS_CHECKPOINT`.

## Resultats observes

### Test local reach beam 16

Cas:

```text
4|Epic|Common|Epic|reach
```

Resultat observe apres verification:

```text
candidates: 64946
battleReach: 9-2 normal
weapon: ranged
stats:
  Lifesteal 5 = 100%
  Attack Speed 4 = 160%
  Double Chance 2 = 40%
  Damage 1 = 15%
pets:
  Saber Tooth Damage lvl1
  Saber Tooth Damage lvl1
  Saber Tooth Damage lvl1
```

Ce resultat confirme que l'objectif `reach` retrouve le build sustain qui allait plus loin que le build `progress`.

### Run VM fini

Fichier recu/observe localement:

```text
simulatedBis.json
```

Proprietes:

```text
generatedAt: 2026-07-02T03:02:14.384Z
objectives: reach
companionLevel: 1
spellLevel: 1
caseCount: 162
```

Ce fichier semble etre le candidat a integrer.

## Points de confusion resolus

### Pourquoi le run affichait `survival`

Cause: la VM n'avait pas encore le commit `a598b8c`, ou les variables Linux n'etaient pas passees.

Symptome:

```text
4|Rare|Common|Legendary|survival
```

ou dans JSON:

```json
"objectives": ["progress", "damage", "survival"]
```

Correction:

```bash
git pull origin test
export FM_BIS_OBJECTIVES=reach
```

### Pourquoi `Wrote 0 BIS case(s)`

Cause probable: code ancien sans objectif `reach`. Le filtre `FM_BIS_CASES='...|reach'` ne matchait aucun job, car le generateur ne creait que `progress/damage/survival`.

Correction: pull du commit `a598b8c`.

### Pourquoi le checkpoint semblait tout doubler

Cause: `FM_BIS_CASE_SHARDS=2`.

Le `.jsonl` a 2 lignes par cas. Le JSON final doit avoir 162 cas.

Verifier:

```bash
node -e "const d=require('./simulatedBis.json'); console.log(Object.keys(d.cases).length, d.assumptions.objectives)"
```

Attendu:

```text
162 [ 'reach' ]
```

## Deploiement deja effectue avant ce point

Deploiements/operations notes dans l'historique:

- Tag/image web `3.1.0` utilisee.
- `k8s/web.yaml` a ete mis a jour plusieurs fois avec des digests Docker.
- Dernier etat connu avant le run reach: web et API etaient deployes dans namespace `forge`.
- Le web avait ete modifie pour ne pas afficher les vieux BIS niveau 100 comme valides.

Avant un nouveau deploiement, verifier:

```bash
git status --short
npm test
npm run build -w apps/web
```

Puis reconstruire/pousser l'image web si le front ou le BIS integre change.

## Etape d'integration recommandee

1. Verifier le fichier racine:

```bash
node -e "const d=require('./simulatedBis.json'); console.log(Object.keys(d.cases).length, d.assumptions)"
```

2. Remplacer le BIS servi par l'application.

Deux chemins possibles selon l'architecture retenue:

- Si le front bundlait encore le JSON:

```bash
cp simulatedBis.json apps/web/src/features/simulation/simulatedBis.json
```

- Si l'API sert le fichier via `/api/bis/latest`, placer le JSON au chemin configure par `FM_BIS_FILE` ou `/data/forge-master/simulatedBis.json`.

3. Relancer:

```bash
npm test -- --run packages/simulator/test/bis-generator.test.ts apps/web/src/features/simulation/bisGuide.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npm run build -w apps/web
```

4. Verifier dans l'UI que la note BIS indique:

```text
objectif avance max
pets/monture niveau 1, sorts niveau 1
```

## Cadrage v4 existant

Le dossier `v4/` contient deja:

```text
v4/README.md
v4/etat-des-lieux.md
v4/architecture.md
v4/simulateur.md
v4/sources.md
```

Point cle de ces notes: la v3 garde des contradictions entre plusieurs notions de reussite:

- `reachFor`: accepte 2 scenarios sur 3;
- `battleReachFor`: exige le gauntlet;
- ecran simulation: affiche le gauntlet comme verdict principal.

La v4 propose une seule source de verite:

```text
un CombatVerdict binaire partage par UI, API, BIS et tests
```

Ce cadrage est sain. Ne pas ajouter une grosse nouvelle abstraction v3 si le but est vraiment de repartir proprement.

## Risques connus

1. `reach` n'est pas un exhaustif mathematique complet si `FM_BIS_EXHAUSTIVE_STATS` n'est pas active.
   - Il utilise beam + union des anciens objectifs + verification top finalistes.
   - C'est un compromis pratique.

2. `reach` et `battleReach` peuvent differer.
   - Pour l'affichage joueur, `battleReach` est le max lineaire utile.
   - `reach` garde l'ancien score 2/3 scenarios, a ne pas vendre comme verdict.

3. Les combats ne sont pas monotones.
   - Un build peut passer un combat plus haut et echouer un combat plus bas.
   - C'est pour cela que les gagnants `reach` sont verifies en ordre reel.

4. Le checkpoint peut contenir des doublons de lignes apres plusieurs reprises.
   - Normalement le script lit le dernier resultat par `checkpointKey`.
   - Ne jamais integrer le `.jsonl`.

5. Le cap workers par defaut est 9.
   - Toujours definir `FM_BIS_WORKERS` et `FM_BIS_MAX_WORKERS`.

6. Syntaxe variables d'environnement:
   - Windows PowerShell: `$env:FM_BIS_OBJECTIVES='reach'`
   - Linux bash: `export FM_BIS_OBJECTIVES=reach`

## Reprise conseillee

Si quelqu'un reprend le sujet, le plus court chemin est:

1. Lire ce fichier.
2. Verifier `simulatedBis.json` racine.
3. Integrer ce JSON dans le chemin vraiment servi par l'app.
4. Lancer les tests cibles.
5. Build web.
6. Deployer.
7. Ensuite seulement, decider si la v4 doit remplacer la v3.

Commande de diagnostic rapide:

```bash
git status --short
node -e "const d=require('./simulatedBis.json'); console.log(Object.keys(d.cases).length, d.assumptions.objectives, d.assumptions.companionLevel, d.assumptions.spellLevel)"
node -e "const d=require('./apps/web/src/features/simulation/simulatedBis.json'); console.log(Object.keys(d.cases).length, d.assumptions.objectives, d.assumptions.companionLevel, d.assumptions.spellLevel)"
```

Etat attendu avant integration:

```text
root simulatedBis.json: 162, reach, 1, 1
apps/web simulatedBis.json: ancien 486, progress/damage/survival, 100, 100
```

Etat attendu apres integration:

```text
apps/web simulatedBis.json: 162, reach, 1, 1
```
