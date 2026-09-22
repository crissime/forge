# Compte rendu d'activite - Dune

Date: 2026-07-08
Agent: Dune
Projet: Forge Master

## Pourquoi ce fichier existe

Ce fichier trace uniquement mon activite sur cette reprise, sans modifier le compte rendu d'Ariane.

## Activite faite

1. Verification du plugin Ponytail:
   - Ponytail detecte et utilisable.
   - Version observee dans le cache: `4.8.4`.
   - Modes disponibles observes: aide, review, audit, debt, gain.

2. Review franche du code en mode Ponytail:
   - objectif: trouver ce qui peut etre supprime ou simplifie;
   - pas de correction appliquee au code produit;
   - review basee sur inspection fichier, pas sur diff Git fiable.

3. Creation puis correction du suivi CRDA:
   - erreur initiale: j'ai ajoute ma review dans le fichier d'Ariane puis je l'ai renomme;
   - correction: fichier d'Ariane restaure sous `crda/2026-07-08-ariane-forge-master.md`;
   - ce fichier Dune est maintenant separe.

## Blocage Git observe

Une tentative de `git status` / `git diff` a ete bloquee par Git:

```text
detected dubious ownership in repository
```

Git proposait:

```powershell
git config --global --add safe.directory 'C:/Users/jekte/OneDrive/Documents/forge master'
```

Je ne l'ai pas applique, car cela modifie la configuration globale Git.

## Review Ponytail - constats

Verdict court:

- Le vrai produit semble etre la V2 monorepo dans `apps/` et `packages/`.
- La racine garde encore une ancienne app Vite/Express qui ressemble a du legacy.
- Les manifests Kubernetes existent en double.
- Plusieurs gros fichiers melangent trop de responsabilites.

Suppressions/simplifications recommandees:

1. Supprimer ou isoler le legacy racine si plus utilise:
   - `src/App.jsx`
   - `src/main.jsx`
   - `index.html`
   - `styles.css`
   - `vite.config.js`
   - `server.js`
   - scripts root `legacy:build` et `legacy:start`
2. Garder un seul dossier Kubernetes:
   - `k8s/`
   - ou `infra/k8s/v2/`
3. Retirer du README les instructions legacy si la V2 est officielle.
4. Deplacer ou supprimer la logique de calcul manuel de `apps/web/src/App.tsx` si elle duplique `packages/simulator`.
5. Decouper `packages/simulator/src/index.ts` par responsabilite simple:
   - types,
   - normalisation,
   - simulation/combat.
6. Simplifier les schemas Zod de `apps/api/src/server.ts` quand `.optional()` et `.partial()` font le meme travail.
7. Deplacer les dependances root vers les workspaces qui les utilisent.

## Fichiers inspectes

- `package.json`
- `README.md`
- `server.js`
- `src/App.jsx`
- `apps/web/src/App.tsx`
- `apps/api/src/server.ts`
- `packages/simulator/src/index.ts`
- `packages/game-data/src/index.ts`
- `k8s/*`
- `infra/k8s/v2/*`

## Position Dune

- Ne pas refactorer avant de supprimer le code mort.
- Ne pas creer une nouvelle architecture pour ranger le bazar.
- Premier chantier utile: confirmer si le legacy racine sert encore.
