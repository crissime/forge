# Preparation batch BIS - Vega

2026-09-22. Preparation seulement; aucun batch massif ni BIS reel produit.
Perimetre Vega: `packages/v4-bis/` et ce document. Core: Tess. CLI: Milo.
References: `plan-calculateur-bis.md`, `simulateur.md`, contrats executables
de `packages/v4-core/src/index.ts`, `fees-2.9.0.md`.

## Contrat rapide pour Milo

Depuis une entree TypeScript/tsx, importer `searchBis` de
`../../packages/v4-bis/src/index.ts` pour un runner sous `v4/tools/`.
Le package est source-only, sans dependance ajoutee; son tsconfig verifie src
et test avec noEmit et sans rootDir, imports relatifs du core inclus.

```ts
const result = searchBis({
  context,                 // metadonnees structure-clonables du cas
  data,                    // V4GameDataInput: snapshot fige, fourni par le runner
  point,                   // FightPoint { age, combat, difficulty }
  options,                 // CombatVerdictOptions, options officielles inchangees
  candidates,              // Iterable<{ id: string, profile: NormalizedProfile, build?: unknown }>
  budget: { maxEvaluations: 36, maxTimeMs: 60_000 },
  exactCandidateCount: 36   // optionnel; compte EXACT de l'iterable, pas une estimation
});
```

`context` est generique et conserve sans interpretation. Le runner doit y figer:
cas/cible, versions et hashes de sources/donnees/constructeur, saison et preuves,
contraintes, hypotheses, niveaux, talents, nature synthetique/experimentale,
ordre d'enumeration, seed et statut de validation. `data` n'est pas duplique
dans la sortie: conserver le snapshot et son hash pour le replay. Il doit
rester immuable pendant l'iteration et les evaluations.

Le candidat conserve son objet complet (donc build et champs additionnels),
son profil effectivement evalue, et son verdict officiel integral. `build`
est optionnel car `{id, profile}` est accepte; si le build physique doit etre
trace, le fournir explicitement. Aucun identifiant d'objet n'est transforme
en statistique ici. Pas d'adaptation de profils ni de generateur d'equipement.
Les ids sont des chaines canoniques non vides et uniques dans le flux visite.
Leur comparaison est lexicographique JS, sans locale ni aleatoire.

Sortie:

- `ranked`: `{ candidate, verdict, relativeHealth }[]` dans l'ordre du classement.
- `excluded`: meme enveloppe pour `invalid_input`/`missing_data`, dans l'ordre
  d'evaluation; diagnostics complets conserves, jamais classes en defaites.
- `best`: premiere entree classee ou null; ne signifie pas forcement passage.
- `outcome`: `pass_found`, `no_pass_found` ou `no_valid_candidate`.
- `evaluatedCount`: tous les appels a evaluateCombatVerdict, diagnostics inclus.
- `exhaustive`: couverture de l'iterable fourni seulement, pas de l'espace legal
  du jeu ni preuve de completude des statistiques ou de fidelite du moteur.
- `stopReason`: `exhausted`, `evaluation_budget` ou `time_budget`.
- `context`, `point`, `options`, `budget`, `exactCandidateCount` (null si inconnu),
  `policy: "pve-pass-time-relative-hp-waves-damage-id-v1"`.

Politique: passages d'abord; temps croissant, PV restants relatifs decroissants,
puis id. Echecs valides: vagues nettoyees puis degats decroissants, puis id.
`passed` provient exclusivement de evaluateCombatVerdict. Un timeout de combat
reste un echec valide, distinct d'une interruption de recherche.

**Contrat core requis:** pour les passages, `verdict.metrics.playerMaxHealth`
doit contenir les PV maximum effectivement simules, finis et positifs. Le BIS
fait uniquement `remainingHealth / playerMaxHealth`. A la premiere lecture du
core ce champ PvE manquait; Tess l'a depuis ajoute. Sans lui, l'API leve
une erreur explicite de contrat, sans formule parallele ni ratio invente.

En 2.9.0, `profile.fairy` absent ou undefined est refuse avant tout appel moteur.
Utiliser null pour un scenario explicitement sans fee, sinon la selection core.
Le BIS ne transforme pas le warning de compatibilite fairy_state_unspecified
en verdict different: il refuse son propre input. Les autres versions et fixtures
ne subissent pas cette garde. Les warnings de coefficients communautaires sont
conserves et permis pour les essais experimentaux, jamais interpretes comme
une validation de saison ou de reference.

## Budget et replay

Budget de compte obligatoire, entier sur; zero est accepte. Un candidat invalide
consomme une evaluation. Sans compte exact, on ne tire pas un candidat de plus
au budget: un flux de N elements avec budget N reste donc non exhaustif.
Avec compte exact N atteint, un lookahead controle appelle next() une seule
fois pour prouver la fin, sans evaluation supplementaire. Un element en trop
leve une erreur de contrat (y compris compte zero sur flux non vide); une fin
observee trop tot aussi. Une declaration seule ne prouve jamais l'exhaustivite.
La fin naturelle avant budget prouve aussi la couverture. Si la borne temporelle
est deja atteinte, le lookahead n'est pas lance: resultat non exhaustif.

La borne temporelle optionnelle utilise une horloge monotone entre appels et
apres next(). Elle est cooperative: ni next(), ni un combat synchrone ne peuvent
etre interrompus. Elle peut depasser d'une evaluation/production, et un candidat
tire mais non evalue a l'expiration n'entre pas dans evaluatedCount. Pas de duree
murale dans le resultat deterministe; le runner mesure le cout separement.
Pour une reproduction bit-a-bit, utiliser le meme ordre, inputs, core et budget
de compte sans coupure temporelle. Une coupure temporelle peut changer la couverture.

Les candidats sont clones avant evaluation et avant d'avancer un producteur
reutilisant ses objets. Le contexte/cible/options sont aussi clones. Inputs
structure-clonables requis. Une erreur de producteur, id duplique ou contrat core
incomplet leve une exception, pas un resultat partiel estampille exhaustif.
Le flux est ferme sur interruption/erreur. Aucun cache, checkpoint, reprise,
worker, heuristique ou appel supplementaire de replay cache dans la recherche.
Memoire O(budget), tri O(budget log budget): acceptable pour le petit pilote.

Avant toute publication, le runner reevalue directement chaque retenu avec
`evaluateCombatVerdict(entry.candidate.profile, data, result.point, result.options)`
et compare l'integralite du verdict. Compter ces reevaluations dans le cout total.
Ne jamais traduire `no_pass_found` par une impossibilite du jeu.

## Runner de readiness et probe fees

Runner Milo observe: `v4/tools/prepare-bis-batch.mjs`. Depuis la racine:

```powershell
node --import tsx v4/tools/prepare-bis-batch.mjs
```

Il controle les snapshots 2.8.2/2.9.0, compile sans emission les trois packages,
lance leurs tests cibles et ses tests preflight, puis ecrit
`v4/generated/bis-preflight.json`. Codes: 2 pour gates bloquees, 0 pour
`ready_for_review`, 1 pour erreur d'execution. `batchStarted` reste false.
Cette commande appartient a Milo et n'a pas ete lancee par Vega, notamment
parce qu'elle ecrit hors du perimetre exclusif autorise ici. Un resultat technique
vert ne constitue pas une autorisation de batch long.

Probe annonce par Milo: 3 fees x 3 niveaux x 4 archetypes de statistiques = 36
profils SYNTHETIQUES, bases figees, snapshot 2.9.0. Fixer et tracer les trois
niveaux choisis et les quatre vecteurs de statistiques; ne pas leur inventer
d'equipement legal. Fournir exactCandidateCount 36 uniquement si tous les
36 profils sont effectivement fournis. Marquer context.synthetic=true,
context.experimental=true, et nommer l'espace "probe de sensibilite fees".
Le constructeur/core applique les fees pour chaque profil, jamais apres le tri.
Un temoin additionnel sans fee doit porter `fairy: null` explicitement; l'inclure
dans le compte exact s'il est fourni a la meme recherche.
Les commandes et le chemin du probe seront documentes apres creation effective
par Milo; ne pas confondre le runner readiness existant avec ce probe.

Ce probe teste le cablage, les interactions et le replay, pas l'accessibilite
des builds, l'optimum, les coefficients de tous les objets ni un batch valide.
Base figee et variantes de stats sont des hypotheses artificielles explicites.

## Scenario borne: full divin, mythique

Le premier pilote reel est fixe ainsi: huit equipements age 9 (nom joueur
"divin") niveau 100, trois familiers mythiques et une monture mythique, niveau
1 pour les familiers/monture/sorts, une fee niveau 20 active et sans bonus deja
inclus. L'APK expose `ItemBaseMaxLevel: 98`; le lien entre cette valeur interne
et le niveau 100 affiche doit etre calibre avant publication, sans modifier le
scenario utilisateur.

Les identifiants d'equipement ne sont pas enumeres: les donnees APK 2.9.0
confirment une base identique a age 9 pour tous les casques et, plus largement,
pour chaque emplacement non-arme. Les six armes ont aussi la meme attaque de
base; deux sont a distance et quatre sont melee. Le pilote utilise donc trois
styles: distance, melee et melee_plus_health. Le dernier est une allocation de
secondaires orientee PV, pas un objet supplementaire. Une enumeration complete
des identifiants est exclue.

Chaque porteur a deux lignes et interdit une statistique dupliquee sur lui. La
meme statistique reste autorisee sur deux porteurs distincts. Le pilote ne
choisit pas une valeur libre pour chacune des 24 lignes. Il genere des
allocations structurees et tracees:

1. Trois familles principales, une par fee: Mira (skillDamage/crit), Tira
   (skillCooldown/block/survie) et Lora (health/reflect/survie), plus une
   famille hybride declaree.
2. Pour chaque famille, les lignes utilisees sont posees aux bornes APK ou aux
   valeurs minimales qui atteignent un palier de fee. Les points testes sont
   avant palier, palier, puis plafond; aucune valeur intermediaire non justifiee
   n'est introduite.
3. Pour chaque famille, conserver quatre variantes de chassis: offensive,
   endurance, equilibree et une variante qui maximise le prerequis de la fee.
   Le choix des pets et de monture fait partie du chassis, pas d'un bonus ajoute
   apres coup.
4. Limite pilote: au plus 200 candidats legaux, avec `exactCandidateCount`,
   hash des donnees/regles et replay du classement complet. Ce nombre est un
   budget de mesure, jamais une preuve de BIS global.
5. Garder les meilleurs de chaque famille et leurs voisins de palier. Le lot
   suivant ne mute qu'un porteur ou une allocation a la fois autour de ces
   candidats; il mesure les gains et pertes avant toute extension du budget.

Cette borne donne un point de depart comparable et reproductible. Elle ne
pretend pas eliminer des objets ou des statistiques legalement: une famille ou
une restriction qui perd un passage dans les cas de controle est retiree.

### Observation terrain a reconstruire

Le 2026-09-22, l'utilisateur rapporte un profil presque full divin, monture et
familier(s) mythique(s), Mira, melee, oriente degats/crit: critChance,
skillDamage, attackSpeed, doubleChance et meleeDamage. Il atteint parfois le
contenu indique "difficile 2-5", selon la chance. Cette observation devient la
premiere graine de la famille `Mira-melee-crit`, pas une preuve de formule ni
un BIS publie: il manque les identifiants, niveaux exacts, lignes, familiers,
monture, sorts, talents et la cible normalisee `{age, combat, difficulty}`.

Pour cette famille, un passage sur une seule seed ne signifie pas "viable".
Le runner doit enregistrer un panel de seeds fixe et classer separement:
`reproductible` (passe le seuil fixe de seeds), `borderline` (passe parfois) et
`non_passing`. Les seuils et le nombre de seeds seront figes avant le premier
batch; ils ne doivent jamais etre ajustes apres avoir vu le gagnant.

Un screenshot fourni le meme jour est un repere visuel distinct, explicitement
non fiable pour les calculs: il affiche `Difficile 2-3`, Forge 31, puissance
1.03b, 60.5m degats totaux et 162m sante totale. L'equipement y est de niveaux
heterogenes (notamment 107, 104, 49, 19, 17, 6, 76 et 44), Mira niveau 14 et
les statistiques visibles incluent 61.4% crit, 358% degats critiques, 40.3%
vol de vie, 48.1% double chance, 163% meleeDamage, 80.9% attackSpeed et 57.8%
skillDamage. Il sert uniquement a donner l'ordre de grandeur du contenu vise;
ni ses totaux affiches ni ses lignes ne doivent alimenter le batch.

## Reduction: hypotheses a tester

1. Figer de petits espaces legaux avec constructeur partage verifie. Faire
   l'exhaustif officiel avant toute reduction et garder classement/verdicts.
   Les fixtures synthetiques actuelles ne remplacent pas cet oracle legal.
2. Comparer a budget identique une enumeration canonique, une allocation par
   strates puis, seulement si utile, des substitutions locales. Hypotheses:
   les strates evitent l'oubli de familles; les substitutions recouvrent une
   partie de l'optimum. Ni dominance des stats ni monotonie ne sont presumees.
3. Mesurer rappels des passages et des meilleurs candidats, ecart de temps/HP
   entre passages et ecart vagues/degats entre echecs, famille perdue, pire cas,
   evaluations et temps. Ne pas fondre passage/echec en un score compensable.
4. Regler sur un sous-ensemble puis tester des cas de controle gardes a part.
   Conserver les contre-exemples; retirer une reduction qui perd un passage
   ou depasse la tolerance fixee avec Milo avant la mesure.

Strates a couvrir avant extension (pas de produit cartesien massif initial):

| Axe | Cas representatifs et frontieres |
| --- | --- |
| Ages/cibles | Debut, milieu, fin et deblocages; melee, distance, mixte; vagues et difficultes explicites |
| Styles | Melee/distance; arme, sorts, survie/reflexion et hybrides permis |
| Raretes | Chaque rarete autorisee, transitions et nombres de lignes verifies |
| Fees | Mira/Tira/Lora selon acces; sans fee seulement comme controle declare |
| Niveaux | Pets/monture/sorts 1 en reference; autres niveaux = autres cas; niveaux de fee accessibles explicites |
| Seuils | Sous/au-dessus/exactement aux paliers de fee, plafonds, cadence et frontieres de passage/timeout |

Ne pas eliminer rangedDamage, monture non canonique, doublons de pets ou une
statistique supposee inutile sans regle du jeu verifiee. Toute restriction
heuristique est tracee comme reduction testee avec son domaine et ses pertes,
jamais presentee comme une exclusion legale.

## Interactions stats-fees et shortlist

Les trois conversions changent la valeur marginale des statistiques: Mira
skillDamage/critChance/critDamage, Tira skillCooldown/block/survie et cadence
des sorts, Lora health/reflectChance/degats recus. Tester les couples et les
hybrides avec pets, monture, talents et sets agreges, pas seulement des axes
isoles. Tester seuil-quantum, seuil, seuil+quantum selon la precision du core,
niveaux bas/max confirme, total cible sous/au-dessus du cap, bonus brut nul,
et un cas d'inversion de classement avec fee. Le BIS ne contient aucun de
ces coefficients ou formules: core + configuration de saison tracee uniquement.

Sur espace reduit, conserver une shortlist diverse (familles de style/fee,
strates rares, proximite des seuils et alternatives survivantes), pas seulement
les K quasi-doublons du premier archetype. Cette selection reste un travail
futur, absent de l'API minimale. Reevaluation directe officielle ensuite sur
la meme cible/options; seeds/panels supplementaires definissent des evaluations
distinctes et ne changent jamais un passed false en vrai. Les elites de chaque
strate et leurs voisins de seuil doivent rester auditables avec leurs profils.

## Prerequis et gating du cout

Bloquants avant candidats reels: reconstruction de toutes les bases et sources
applicables (equipement/lignes, pets, monture, talents fixes, sets/skins/autres
bonus), tables de coefficients/niveaux/raretes, deblocages et cumul, agregats
secondaires avant fee, plafonds, arrondis et absence de double comptage.
Changer des ids sur un profil aux totaux anciens est interdit. Le package BIS
ne verifie pas ces prerequis et ne peut pas rendre un profil incomplet fiable.
Tess/Oren doivent fournir les preuves et le constructeur; Noor preserve les
profils historiques. 2.8.2 reste active; 2.9.0 est candidate.

La formule native des fees est documentee, mais les coefficients de saison
restent communautaires sans confirmation en jeu. L'integration core des fees
ne suffit ni a valider leur saison ni a reconstruire tous les bonus. Tester
le classement sur profils artificiels est possible; annoncer un BIS complet
2.9.0 ne l'est pas tant que ces gates restent ouvertes.

Mesurer sur petits cas: temps de construction, de simulation, de copie/tri et
de replay, mediane/p95/max, diagnostics, memoire et evaluations par strate.
Projeter le cout total avec nombre exact/estime explicite, repetitions/seeds,
shortlist et replay inclus. Le pilote propose reste <=200 appels, 60 s souples;
ce n'est pas une garantie de qualite. Le probe 36 est un banc de cout synthetique,
pas une estimation suffisante du cout des vrais builds riches en sorts.

Gates: compilation/tests/replay; exhaustifs legaux et pertes de reduction sur
holdout; coefficients et agregation verifies; acces/saison; validation en jeu;
cout representatif mesure et enveloppe acceptee par Milo. Tout echec laisse
le statut experimental/bloque. N'ajouter reprise/cache/workers que sur besoin
mesure et autorisation ulterieure; aucun des trois n'est implemente ici.

## Verification ciblee Vega

```powershell
node node_modules/typescript/bin/tsc -p packages/v4-bis/tsconfig.json
node node_modules/vitest/vitest.mjs run packages/v4-bis/test --configLoader runner --no-cache
```

Tests: oracle officiel minuscule sur echecs/timeout, ordre complet sur verdicts
controles, invalid/missing, budgets y compris frontieres et temps, determinisme
et replay RNG, candidats/contextes non modifies et snapshots detaches, producteur
mutable, ids/compte invalides et etat fee 2.9.0 obligatoire. Le test de passage
reel rejoue le verdict et verifie la metrique playerMaxHealth; les tests de tri seul
utilisent des verdicts controles, pas une simulation concurrente.
Pas de build racine ni de bis:generate. Resultats finaux a consigner apres
stabilisation des modifications core en cours.
