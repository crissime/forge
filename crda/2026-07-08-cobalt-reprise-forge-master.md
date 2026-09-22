# Compte rendu d'activite - Cobalt

Date: 2026-07-08
Agent: Cobalt
Projet: Forge Master

## But du fichier

Donner assez de contexte pour reprendre le sujet sans relire toute la conversation. Ce fichier resume ce que j'ai fait, l'etat observe du repo, les zones importantes et les points de vigilance.

## Etat observe du repo

Le projet a deux couches visibles:

- legacy racine: `src/App.jsx`, `server.js`, `styles.css`, `vite.config.js`;
- V2 cible: `apps/web`, `apps/api`, `packages/simulator`, `packages/game-data`, `prisma`.

Le `package.json` actuel decrit la V2:

- front public React/Vite dans `apps/web`;
- API Fastify dans `apps/api`;
- moteur pur dans `packages/simulator`;
- donnees de jeu versionnees dans `packages/game-data`;
- Postgres via Prisma.

Commandes utiles:

```bash
npm run dev:web
npm run dev:api
npm test
npm run build
npm run game-data:update
npm run migrate:legacy-users
```

Commandes legacy encore presentes:

```bash
npm run legacy:build
npm run legacy:start
```

## Travail effectue historiquement

J'ai d'abord travaille sur l'application legacy racine, avant l'arrivee/observation de la V2.

Changements principaux faits sur le legacy:

- refactor en React/Vite autour de `src/App.jsx`;
- serveur Node unique pour servir le front et les API legacy;
- sauvegarde utilisateur et sauvegarde automatique;
- import JSON depuis `1vcian/fm`;
- modelisation des objets par slot;
- modelisation des pets et de la monture;
- 2 lignes secondaires max par objet;
- talents d'objet appliques au slot concerne;
- talents pets/monture appliques aux cartes concernees;
- selection de 3 sorts joueur et adversaire;
- mode PvP et objectif equilibre PvE/PvP;
- recommandations de stats, talents, pets et objets;
- comparateur de drop legacy corrige pour comparer un objet complet plutot qu'une seule ligne;
- bouton legacy `Prendre ce drop` pour remplacer la piece selectionnee;
- documentation contexte dans `docs/`.

Fichiers legacy principalement touches:

- `src/App.jsx`;
- `styles.css`;
- `README.md`;
- `docs/00-index.md`;
- `docs/game-overview.md`;
- `docs/stats-and-builds.md`;
- `docs/simulator-context.md`;
- `docs/sources.md`.

## Documentation creee

Dossier `docs/`:

- `00-index.md`: entree de la documentation contexte;
- `game-overview.md`: explication du jeu;
- `stats-and-builds.md`: stats, objets, pets, monture, sorts, talents;
- `simulator-context.md`: decisions du simulateur et limites;
- `sources.md`: wiki, repo/site 1vcian, Reddit, Google Play, autres outils.

Sources principales citees:

- site `https://1vcian.me/fm/`;
- repo `https://github.com/1vcian/fm`;
- Forge Master Wiki Fandom;
- page `Sub stats and Builds`;
- subreddit `r/ForgeMasterUnofficial`;
- Google Play.

## Etat V2 important

La V2 semble etre devenue la cible principale. Ne pas continuer a ajouter de grosses features dans le legacy sans raison.

Fichiers V2 importants:

- `apps/web/src/features/compare/ComparePage.tsx`: comparateur de drop V2;
- `apps/web/src/features/pvp/PvpPage.tsx`: page PvP;
- `apps/web/src/features/talents/TalentsPage.tsx`: talents;
- `apps/web/src/features/simulation/BisPage.tsx`: BIS;
- `apps/web/src/store/workshop.ts`: profil et store front;
- `apps/web/src/api/client.ts`: appels API;
- `packages/simulator/src/index.ts`: moteur de simulation;
- `packages/simulator/test/simulator.test.ts`: tests moteur;
- `packages/game-data`: donnees JSON brutes et normalisees;
- `scripts/generate-simulated-bis.mjs`: generation BIS;
- `scripts/migrate-legacy-users.mjs`: migration anciens utilisateurs.

## Moteur simulateur V2

Exports publics reperes dans `packages/simulator/src/index.ts`:

- `manualProfile`;
- `normalizeOneVcianProfile`;
- `evaluateProfile`;
- `evaluateProfileSnapshot`;
- `evaluatePvp`;
- `compareDrop`;
- `combatProfile`.

Comportements reperes:

- reconstruction d'un profil depuis l'export `1vcian/fm`;
- calcul attaque/PV depuis objets, pets, monture et talents;
- duel PvP temporel;
- comparaison de drop sans mutation du profil source;
- support cible drop `equipment`, `pet`, `mount`;
- remplacement de la cible dans le profil simule;
- tests sur lignes secondaires a zero, PvP, drop compare, pets/monture.

## Comparateur de drop

Legacy:

- dernier comportement voulu par l'utilisateur: comparer une piece complete;
- choisir le type d'objet;
- renseigner attaque ou defense;
- renseigner une ou deux lignes secondaires;
- afficher la piece actuelle vs le nouveau drop;
- bouton `Prendre ce drop` remplace toute la piece.

V2:

- `apps/web/src/features/compare/ComparePage.tsx` gere deja `equipment`, `pet`, `mount`;
- les valeurs d'attaque/PV sont automatiques depuis les donnees de jeu;
- le formulaire actuel vu dans le repo semble gerer une seule stat secondaire via `form.stat` et `form.value`;
- si l'utilisateur redemande deux lignes secondaires en V2, le bon endroit est probablement `ComparePage.tsx` + `DropInput.secondaryStats`;
- le moteur accepte deja `secondaryStats` comme tableau, donc le changement front devrait etre petit.

## Points de vigilance

- Le repo a evolue: verifier avant chaque modification si la cible est legacy ou V2.
- Le legacy existe encore, mais la V2 est l'architecture cible dans `README.md`.
- Ne pas supprimer les gros fichiers de simulation non suivis sans demander: `simulatedBis*.json`, `tmp/`, `v4/`, logs `.bis-*`.
- `ComparePage.tsx` affiche quelques caracteres mal encodes dans le terminal (`Ã‚ge`, `Ã©quipÃ©`). Verifier l'encodage avant toute modification textuelle dans ce fichier.
- La doc legacy peut etre legerement en retard sur la V2. Prioriser `README.md` et le code V2 pour l'etat actuel.
- Les donnees de jeu viennent de `1vcian/fm`; garder les sources citees, ne pas copier de code communautaire sans verifier la licence.
- Le front public doit rester le seul service expose; API et Postgres internes.

## Tests et checks

Checks effectues lors des travaux legacy:

```bash
npm run check
```

Dans l'etat V2 actuel, les checks pertinents sont:

```bash
npm test
npm run build
```

Ce compte rendu est documentaire. Aucun check n'a ete relance uniquement pour sa creation.

## Prochaine reprise conseillee

1. Lire `README.md`.
2. Lire ce fichier et `crda/2026-07-08-ariane-forge-master.md`.
3. Identifier si la demande concerne legacy ou V2.
4. Pour une feature de simulation, commencer par `packages/simulator/src/index.ts` et son test.
5. Pour une feature UI, commencer par la page dans `apps/web/src/features`.
6. Garder le diff petit: la V2 a deja beaucoup de pieces, reutiliser avant d'ajouter.
