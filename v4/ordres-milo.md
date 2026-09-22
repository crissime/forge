# Ordres Milo - cadrage equipe v4

Date: 2026-08-20.
Statut: XAPK 2.8.2 valide; donnees critiques et premiere formule extraites.

## Decisions verrouillees

- La v4 demarre en preview, pas en remplacement direct.
- Les profils existants restent utilisables sans ressaisie.
- Pas de migration DB globale au depart: les profils JSON actuels sont acceptes comme entree et adaptes a la volee.
- Un seul verdict officiel: `CombatVerdict`.
- UI, API et BIS ne recalculent pas et ne redefinissent pas `passed`.
- L'analyse statique du XAPK 2.8.2 est autorisee et devient la source locale
  primaire; aucun lancement, service distant ou contournement.
- Les scores de tri ne peuvent jamais transformer un verdict faux en verdict vrai.
- Le socle `v4-core` actuel ne porte pas encore un verdict fiable: il delegue
  au moteur existant qui double les valeurs ennemies `F1D`.

## Ordres par role

### Tess - simulateur

Objectif de cadrage:

- figer le contrat `CombatVerdict`;
- distinguer `cleared`, `dead`, `timeout`, et traiter explicitement les donnees invalides/manquantes;
- preparer les tests golden avant toute optimisation.

Sortie attendue:

- contrat final du verdict;
- liste des tests golden;
- liste des formules/donnees demandees a Oren;
- liste des morceaux v3 interdits comme source de verite.

Ordre apres analyse 2.8.2:

- ne plus appeler `evaluateProfileSnapshot` pour le verdict final;
- commencer le moteur pur par `F1D Raw / 100`, difficulte exponentielle et
  `WeaponInfo.IsRanged`;
- remplacer les delais fixes d'approche par le mouvement confirme dans le
  rapport `v4/analyse-xapk-2.8.2.md`.

Tests minimum:

- profil trop faible: mort vague 1;
- DPS fragile: tue vite mais meurt;
- tank faible DPS: vivant mais timeout;
- profil valide: toutes vagues videes;
- frontiere `time == maxSeconds`;
- determinisme meme seed/settings;
- combat mixed melee/ranged;
- meme verdict via simulateur direct, API et BIS.

### Oren - donnees

Objectif de cadrage:

- verifier les donnees locales avant APK;
- reparer la confiance source/hash;
- isoler les formules incertaines qui touchent le verdict.

Sortie attendue:

- rapport source/hash/confiance pour les donnees critiques;
- comparaison avec une source 1vcian/fm pinnee, pas `main`;
- liste des invariants data a tester;
- decision claire: APK necessaire ou non.

Ordre apres analyse 2.8.2:

- figer un snapshot v4 depuis `SharedGameConfig.mpa`;
- conserver hashes, timestamp, schema et provenance;
- conserver les 15 stats internes et marquer les 13 stats tirables;
- ne pas recopier les donnees dans les dossiers v2/v3.

Points rouges:

- manifest local: hashes a reverifier;
- `SkillMechanics.json`: source communautaire, pas config brute;
- incertains: regen, block, lifesteal exact, timing, approche melee, ciblage sorts, scaling ennemis, lignes secondaires.

### Lina - UX

Objectif de cadrage:

- faire un flux minimum centre joueur;
- cacher le bruit technique;
- afficher le verdict sans score arbitraire.

Flux minimum:

1. charger le profil existant automatiquement;
2. afficher un build reduit avec alertes;
3. choisir niveau, combat, normal/difficile;
4. recevoir `CombatVerdict`;
5. afficher decision, raison courte, prochaines actions.

A cacher par defaut:

- PvP;
- Comparer;
- BIS;
- details de calcul;
- objectifs `progress/damage/survival/balanced`;
- scores techniques;
- stats a zero;
- `idx`;
- scenarios internes v3.

Regle:

- le front n'agrege jamais attaque/PV/stats;
- le front n'interprete jamais `passed`;
- le front affiche seulement les donnees envoyees.

### Noor - API et profils

Objectif de cadrage:

- garantir les profils existants;
- garder le minimum d'endpoints;
- eviter les migrations prematurees.

Decisions:

- utiliser `Profile.normalized` et `rawProfile` comme sources existantes;
- adapter a la volee vers v4;
- ne pas migrer toute la DB avant contrat v4 stable;
- conserver auth/session actuelle.

Risques a traiter:

- profil local non connecte perdu au changement de PC;
- sauvegarde cloud en last-write-wins;
- store web actuel recalcule encore des donnees;
- profils incomplets ou anciens.

Tests exiges:

- profil v3 DB reel/anonymise;
- profil localStorage;
- import `forge-master-v2-profile`;
- profil 1vcian;
- profil manuel/guest;
- profils incomplets;
- round-trip cloud sur navigateur vide.

### Vega - BIS

Objectif de cadrage:

- attendre Tess;
- definir un schema BIS v4 qui stocke le verdict exact;
- generer un seul cas au debut.

Schema minimum:

- global: `schema`, `gameDataVersion`, `generatedAt`, `assumptions`, `cases`;
- par cas: `access`, `targetFight`, `winner`, `verdict`, `rankScore`, `candidateCount`, `method`;
- `verdict` est le `CombatVerdict` exact.

Invariants:

- BIS ne calcule jamais `passed`;
- BIS ne publie "passe" que si `winner.verdict.passed === true`;
- si aucun candidat ne passe, stocker meilleur echec, pas "BIS passant";
- aucun fallback v3 dans une sortie v4.

Premier cas propose:

- equipement age 4;
- pet Epic;
- monture Common;
- sorts Epic;
- pets/monture/sorts niveau 1;
- talents exclus;
- un combat cible defini par Tess.

## Infos a demander au proprietaire

Priorite haute:

- profils reels anonymises: recu dans `profile/`;
- un cas ou le jeu passe mais le simulateur dit non: en attente;
- un cas ou le simulateur dit oui mais le jeu ne passe pas: en attente;
- version exacte du jeu fournie: `2.8.2`;
- XAPK correspondant: recu et valide sous
  `Forge+Master_2.8.2_APKPure.xapk`;
- captures ou notes de tests manuels regen/block/lifesteal/sorts.

Priorite moyenne:

- problemes de compte/sauvegarde entre PC;
- profils avec pets/monture/sorts avances;
- retours mobile;
- combats cibles typiques que les joueurs veulent tester.

## Ordre d'execution

1. Oren: figer le snapshot 2.8.2 et ses invariants de provenance.
2. Tess: remplacer le calcul herite par le moteur pur et ses golden APK.
3. Noor: brancher les profils existants seulement quand le verdict Tess est stable.
4. Lina: flux preview minimal seulement apres endpoint stable.
5. Vega: premier cas BIS v4 seulement apres verdict stable.
