# Forge Master - Simulateur de stats

Application web pour comparer les caracteristiques Forge Master, tester des drops et estimer une chance PvP contre un adversaire.

## V2 - architecture cible

La V2 vit a cote de l'ancienne application et separe clairement:

- `apps/web`: front React/Vite expose publiquement;
- `apps/api`: API Fastify privee, proxifiee par le front sur `/api`;
- `packages/simulator`: moteur pur de normalisation et simulation;
- `packages/game-data`: donnees JSON versionnees et script de mise a jour;
- `prisma`: schema Postgres et migrations.

Le front reste le seul service a exposer publiquement. L'API et Postgres doivent rester internes au reseau Docker/Kubernetes.

## Lancer la V2 en local

```bash
npm install
npm run game-data:update
docker compose up --build
```

Puis ouvrir `http://127.0.0.1:3002` pour la V2 Docker Compose.

Pour developper sans Docker, lance Postgres et configure:

```bash
$env:DATABASE_URL="postgresql://forge:forge@127.0.0.1:5432/forge_master?schema=public"
npx prisma migrate deploy
npm run dev:api
npm run dev:web
```

## Donnees de jeu

Les donnees ne copient pas de code communautaire. Le script `npm run game-data:update` recupere uniquement les JSON necessaires depuis `1vcian/fm`, les stocke sous `packages/game-data/data/<version>/raw`, puis produit `normalized.json` et `manifest.json` avec hash et source.

Version par defaut: `2026_05_23_14_08`.

## Migration depuis l'ancien stockage JSON

Apres avoir configure `DATABASE_URL` et lance les migrations:

```bash
npm run migrate:legacy-users
```

Le script lit `data/users.json`, conserve les `salt`/`passwordHash`, et cree des profils Postgres a partir des profils existants.

## Tests V2

```bash
npm test
npm run build
```

Les tests couvrent actuellement le moteur: mapping des 13 sous-stats, arrays exacts des sorts, arbres de talents importes, reconstruction d'un profil, PvP et comparaison de drop.

## Lancer en local

```bash
npm install
npm run build
npm start
```

Puis ouvrir `http://127.0.0.1:3000`.

Pour developper le front avec rechargement rapide:

```bash
npm run dev
```

Le front est une SPA React/Vite servie par `apps/web/server.mjs`. En production, ce serveur expose le front et proxifie `/api` vers le service API interne.

## Documentation contexte

Les notes de contexte sont dans [docs/00-index.md](./docs/00-index.md):

- explication du jeu;
- stats et builds;
- decisions du simulateur;
- sources communautaires et liens utiles.

## Comptes

Le serveur propose:

- creation de compte;
- connexion/deconnexion;
- mot de passe hashe avec `scrypt`;
- cookie de session `HttpOnly`;
- sauvegarde du profil cote serveur.

L'application garde aussi un brouillon automatique dans le navigateur. A chaque modification, le profil est sauvegarde localement; si l'utilisateur est connecte, une sauvegarde serveur automatique est aussi envoyee avec un leger delai. Le bouton `Sauver` reste disponible pour forcer une sauvegarde immediate.

Le stockage cible de la V2 est Postgres via `DATABASE_URL`. En Kubernetes, garde l'API et Postgres internes; seul le service web doit recevoir l'ingress public.

## Import 1vcian/fm

Le but de cette appli est de completer l'excellent outil `1vcian/fm`, pas de le remplacer. Le flux conseille:

1. Construire ou maintenir le profil complet dans `1vcian/fm`.
2. Exporter le profil en JSON depuis son outil.
3. Importer ce JSON ici.
4. Utiliser cette appli pour le PvP, les comparaisons de drop et les recommandations de stats.

L'import lit actuellement:

- les items par slot avec leur attaque, defense et sous-stats;
- les pets actifs avec leur attaque, defense et sous-stats;
- la monture active avec son attaque, sa sante et ses sous-stats;
- les noeuds des arbres de talents `Power` et `Skills / Pets`;
- les 3 sorts equipes et leur niveau;
- le niveau de forge.

Les sous-stats sont converties depuis les identifiants `SecondaryStatLibrary` comme `DamageMulti`, `HealthRegen`, `CriticalChance`, etc. Quand un item, un pet ou une monture est reconnu, ses lignes restent attachees a sa carte pour eviter le double comptage. Les stats manuelles servent seulement de rattrapage pour les lignes que l'import ne sait pas rattacher a un objet precis.

Chaque carte d'objet affiche 2 lignes secondaires maximum, comme dans le jeu. L'optimiseur utilise donc automatiquement 16 lignes d'equipement: 8 slots fois 2 lignes.

Les valeurs importees gardent les decimales. Par exemple `0.0375` devient `3.75%`, sans arrondi a l'inferieur.

Les arbres de talents sont affiches comme des noeuds selectionnables avec niveau 0-5. Les noeuds non-combat restent visibles pour la progression de l'arbre, mais seuls les bonus combat utiles au simulateur changent le score: degats, PV, sorts, pets et monture.

## Recommandations

- `Prochaines lignes rentables`: simule l'ajout d'une ligne max de chaque stat et classe le gain.
- `Objets a regarder`: indique les slots, pets ou monture qui n'ont pas encore les stats prioritaires et qui meritent donc d'etre compares au prochain drop.
- `Bonus pets a chercher`: meme logique, mais formulee comme une stat a chercher sur un pet, car un bon pet peut se garder sans remplacer une piece d'equipement.
- `Trades possibles`: simule la perte d'une ligne max d'une stat contre le gain d'une ligne max d'une autre stat.
- `Arbres de talents`: classe les prochains noeuds disponibles selon leur gain sur l'objectif actuel.

En PvP, le classement utilise le gain de chance de victoire contre l'adversaire renseigne. En PvE, il utilise le gain du score objectif. En mode `Equilibre PvE/PvP`, il combine la progression PvE et la chance PvP, et garde les stats adversaire visibles.

## Repères BIS

L'écran `Simuler` contient des objectifs `Best in slot` séparés du niveau PvE. Le joueur coche les âges d'équipement et les raretés de pets, monture ou sorts auxquels il a réellement accès. Le meilleur palier coché devient la cible et reste sauvegardé localement.

Le bouton `Depuis mon profil` préremplit ces accès à partir des objets, compagnons et sorts équipés. Les paliers affichés, dont `Moderne` à `Multiverse` avec des compagnons et sorts `Épiques`, sont des repères de progression modifiables et non des règles de déblocage officielles extraites des fichiers du jeu.

Le duel PvP utilise le meme moteur temporel que les combats PvE:

- adversaire importe, construit manuellement ou copie depuis le profil joueur;
- armes, regen, lifesteal, block, sorts, buffs, multi-coups et cooldowns des deux profils;
- multiplicateurs de PV PvP officiels pour les pets, la monture et les buffs de sorts;
- limite de match issue de `PvpBaseConfig`;
- recommandations mesurees en points de chance contre cet adversaire.

## Modele

Le calcul est une approximation parametrique:

- `Damage`, `Ranged Damage` et `Melee Damage` multiplient les degats de base.
- `Attack Speed`, `Double Chance`, `Crit Chance` et `Crit Damage` multiplient le DPS attendu.
- Le multiplicateur de crit part de 120%, puis ajoute `Crit Damage`.
- `Double Chance`, `Crit Chance`, `Block` et `Cooldown` sont plafonnes dans le calcul.
- Les sorts sont selectionnes parmi les 18 sorts de `SkillLibrary`, 3 par rarete.
- Le joueur et l'adversaire peuvent cocher 3 sorts chacun, avec leur niveau.
- `Skill Damage` augmente les degats/protections des sorts, et `Skill Cooldown` reduit leur cooldown.
- Les buffs ajoutent temporairement attaque et PV max; les sorts offensifs respectent leur delai, leur nombre d'impacts et leur intervalle.
- Les sorts de zone frappent chaque ennemi encore vivant. Les sorts monocibles changent de cible apres une mort.
- Les vagues sont simulees dans le temps: cooldowns, impacts restants, pauses, overkill et baisse des degats ennemis sont conserves.
- Les talents d'items s'appliquent au slot correspondant: arme sur l'attaque de l'arme, casque sur la defense du casque, etc. Les talents pets et monture s'appliquent a l'attaque/sante de leurs cartes, tandis que les talents sorts restent des bonus globaux de simulation.
- `Lifesteal` transforme le DPS d'arme estime en soin par seconde.
- `Health Regen` est modele comme un pourcentage des PV max par seconde.
- `Block` reduit les degats recus en PvP.

Les valeurs de sorts utilisent les 100 valeurs exactes de `SkillLibrary` 2026-05-23. Les mecaniques de ciblage et d'impacts sont stockees dans notre JSON versionne `SkillMechanics.json`, avec source et niveau de confiance.

## Docker

```bash
docker compose up --build
```

## Kubernetes

La v2 se deploie en trois services internes: `web`, `api`, `postgres`. Seul `forge-master-web` doit etre expose publiquement.

Exemple avec Postgres embarque:

```bash
kubectl apply -k k8s
```

Avant production, remplace les valeurs `change-me` dans `k8s/api.yaml` et `k8s/postgres.yaml`.

Pour une base Postgres externe, applique un secret adapte depuis `k8s/external-database.secret.example.yaml`, puis deploie `api.yaml` et `web.yaml` sans `postgres.yaml`.

Pour l'exposition publique, adapte `k8s/ingress.example.yaml` avec ton domaine, ton ingress class et ton issuer TLS. L'ingress doit pointer uniquement vers `forge-master-web`.

## Sources communautaires consultees

- Forge Master Wiki, `Sub stats and Builds`: caps de sous-stats et builds recommandes.
- ForgeMaster Helper / `1vcian/fm`: configs de sorts, format de profil exporte et reference communautaire.
- Reddit `r/ForgeMasterUnofficial`: discussions sur la meta et les limites du simulateur communautaire.
