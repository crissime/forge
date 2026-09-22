# Phase 1 - verdict, donnees, profils

Date initiale: 2026-07-08. Mise a jour: 2026-08-27.

## Etat

Socle minimal implemente dans `packages/v4-core`.

Apres analyse du XAPK 2.8.2, le nouveau socle de calcul est actif dans
`packages/v4-core`. Les conversions fixes, les couches de stats, la cadence
d'attaque, la double attaque, les positions, les projectiles, les competences
confirmees et les deux generateurs aleatoires sont implementes sans delegation
au moteur existant. La preview publique, l'API et le BIS restent debranches
tant qu'ils n'appellent pas tous cette unique fonction de verdict.

Ce package reste isole: aucune UI, aucun endpoint API, aucun BIS v4, aucune modification des fichiers v3 existants.

Validations posees:

- contrat `CombatVerdict` code;
- refus explicite des combats sans donnees reelles (`missing_data`);
- refus des options qui divergent des clamps moteur;
- adapter profils existants vers une entree v4;
- tests golden initiaux sur verdict et profils.

## Verdict v4

Fonction publique:

```ts
evaluateCombatVerdict(profile, data, point, options): CombatVerdict
```

Entrees:

- `profile: NormalizedProfile`
- `data: GameDataBundle`
- `point: { age: number; combat: number; difficulty: "normal" | "hard" }`
- options: `maxSeconds`, `blockMode`, `seed`, `skillActivationPolicy`

Defauts:

- `maxSeconds = 900`
- `blockMode = "average"`
- `seed = null` en average
- `seed = 1337` si RNG demande sans seed
- `skillActivationPolicy = "auto_when_ready"`; un avertissement rend ce
  defaut visible pour les profils avec competences

Regles:

- `passed === true` seulement si `reason === "cleared"`.
- `dead` prioritaire sur `timeout`.
- `timeSeconds === maxSeconds` reste valide si le dernier ennemi est tue exactement a la limite.
- `missing_data` si les tables combat critiques manquent.
- Aucun fallback synthetique pour un verdict officiel.

## Tests golden minimum

- donnees manquantes: `missing_data`;
- profil trop faible: `dead`, vague 0;
- DPS fragile: tue au moins une cible mais finit `dead`;
- tank faible DPS: vivant mais `timeout`;
- profil valide: `cleared`, `passed: true`;
- frontiere temps inclusive;
- determinisme average/RNG seedee;
- mixed melee/ranged + meme verdict via simulateur direct, API preview et wrapper BIS.

## Donnees

Donnees locales suffisantes pour cadrer:

- 15 stats internes, dont 13 stats secondaires tirables;
- 18 sorts;
- 235 noeuds tech;
- 232 bases objets;
- 25 pets;
- 15 montures;
- 210 combats;
- 618 vagues;
- 72 ennemis;
- 11 scalings age;
- refs ennemis/armes resolues.

Point a reparer avant verrou v4:

- `manifest.sourceRef` pointe sur `main`, pas sur un commit;
- les hashes manifest ne matchent pas les fichiers raw pretty-printes;
- `SkillMechanics.json` reste une source communautaire/curated.

Decision APK mise a jour:

- XAPK 2.8.2 valide et analyse statiquement;
- formule PV/degats ennemis confirmee;
- erreur `0.02` du moteur actuel demontree, conversion exacte `Raw / 100`;
- modele de mouvement reel confirme, delais fixes d'approche rejetes;
- rapport: `v4/analyse-xapk-2.8.2.md`.

## Profils

Formats recus:

- `profile/*.forge-master.json`: 14 exports `forge-master-v2-profile`;
- `profile/profiles.prod.raw.json`: 14 lignes type Prisma, toutes avec `normalized`;
- `profile/index.json`: metadata seulement;
- `profile/users.prod.map.json`: mapping utilisateur, a exclure des fixtures.

Contrat d'adaptation futur:

```ts
type V4ProfileEntry = {
  schema: "forge-master-v4-profile-entry-v1";
  sourceKind: "db-normalized" | "db-rawProfile" | "export-v2" | "localStorage-v3" | "1vcian" | "manual";
  dataVersion: string;
  name: string;
  profile: NormalizedProfile;
  decisionComplete: boolean;
  missing: string[];
  audit: AuditIssue[];
};
```

Regles:

- garder le format v3 comme entree;
- adapter a la volee;
- pas de migration DB globale;
- profils incomplets acceptes si le simulateur peut evaluer avec zero pour les pieces absentes;
- anonymiser avant tout commit de fixture.

## Implementation actuelle

Fichiers:

- `packages/v4-core/src/index.ts`
- `packages/v4-core/test/v4-core.test.ts`

Exports publics initiaux:

- `evaluateCombatVerdict(profile, data, point, options)`
- `adaptProfileToV4(input, sourceKind?)`
- types `FightPoint`, `CombatVerdict`, `CombatVerdictOptions`, `V4ProfileEntry`

Nouveaux modules purs:

- `fd6.ts`: arithmetique fixe `F6D`/`F64`;
- `stat-resolver.ts`: couches et conditions de stats;
- `battle-data.ts`: construction des vagues depuis le snapshot APK;
- `attack-machine.ts`: windup, cooldown, double attaque et resolution des coups;
- `random-pcg.ts`: RNG seedee identique au jeu;
- `pseudo-random.ts`: dispersion deterministe des projectiles de competence;
- `combat-profile.ts`: adaptation des totaux des profils existants vers les
  stats de combat v4.
- `combat-engine.ts`: moteur spatial pur, vagues, mouvement, attaques et
  projectiles;
- `skill-data.ts`: niveaux, formules et gate des competences actives.

Donnees:

- `packages/v4-game-data/data/2.8.2`: 22 tables wire et 12 tables normalisees;
- reconstruction XAPK et hashes valides;
- 478 lignes comparees avec l'oracle, 2 lignes APK-only;
- 11 profils recuperes sont directement simulables au niveau arme;
- 3 profils incomplets restent importables mais n'ont aucune arme a inventer.
- 11 profils recuperes sont simulables avec leurs competences actuelles;
- les 6 profils auparavant bloques par `Shuriken` sont maintenant evalues;
- 3 exports restent incomplets car aucune arme n'est presente dans leur source;
- les 14 exports appartiennent a 5 utilisateurs: 4 ont au moins un profil
  complet; le dernier conserve tout son profil et n'a que l'arme a completer.

Verification locale:

- `npx tsc -p packages/v4-core/tsconfig.json`
- `npm test -w packages/v4-core` - 61 tests
- `npm test -w packages/v4-game-data` - 2 tests
- `npm run build -w packages/v4-core`

Controles equipe:

- Tess: contrat verdict coherent, risques suivants: API/BIS/UI doivent tous passer par `v4-core`, PV brut encore approxime via pourcentage moteur.
- Oren: XAPK 2.8.2 extrait statiquement; tables, formules et mecanismes des 18
  competences consignes avec gate `missing_data` conserve.
- Noor: 14 exports + 14 lignes DB acceptes; test sweep ajoute.

## Prochaine etape

1. ajouter des cas observes dans le jeu des qu'ils sont disponibles;
2. comparer les resultats aux prochaines mesures ou videos obtenues en jeu;
3. traiter la piece arme manquante comme une completion ciblee, pas une
   recreation de profil;
4. anonymiser les fixtures profils avant commit durable;
5. brancher l'endpoint preview sur l'unique `evaluateCombatVerdict`;
6. ouvrir UX preview puis BIS v4.
