# Entrees recues pour la v4

Date initiale: 2026-07-08.
Mise a jour: 2026-08-20.

## Version jeu

- Version actuelle fournie par le proprietaire: `2.8.2`.
- Ancienne version annoncee au debut du cadrage: `2.6.0`.

## APK initial rejete

- Chemin local: `forge-master.apk`
- Taille: `13202941` octets
- SHA256: `A7CE7F344D5208100CC6811A676540301351B0B836ABA0E6AED233C35C0CD0CF`
- Controle statique du 2026-08-20: fichier identifie comme `Aptoide Games`
  `1.20.0`, package `com.aptoide.android.aptoidegames`.
- Statut: rejete comme source Forge Master; ne contient pas le jeu 2.6.0.
- Rapport: `v4/analyse-apk-2.6.0.md`.
- Identite qui etait attendue a ce moment: package
  `com.hariwn.legendofcivilizations`, versionName `2.6.0`, versionCode `20600`.

### XAPK accepte

- Chemin local: `Forge+Master_2.8.2_APKPure.xapk`
- Taille: `125500994` octets
- SHA256: `C496445179936D9139BCDB9E0CB3C4C266426AFA132174D6C334D53C7989A306`
- Package: `com.hariwn.legendofcivilizations`
- Version: `2.8.2`, versionCode `20802`
- Splits: base + `config.armeabi_v7a`
- Statut: accepte comme source locale v4.
- Configuration: `assets/SharedGameConfig.mpa`, 73 entrees, creee le
  `2026-07-24T09:54:24.324Z`.
- Rapport: `v4/analyse-xapk-2.8.2.md`.

## Profils recuperes

- Dossier local: `profile/`
- Exports directs detectes: `14` fichiers `*.forge-master.json`
- Schema detecte sur ces exports: `forge-master-v2-profile`
- Version data detectee sur ces exports: `2026_05_23_14_08`
- Profils complets detectes: majorite avec equipement, 3 pets, monture, 3 sorts.
- Profils incomplets utiles pour tests: certains sans pets, sans monture ou sans sorts.
- Autres fichiers presents:
  - `profile/index.json`
  - `profile/profiles.prod.raw.json`
  - `profile/users.prod.map.json`

## Cas jeu vs simulateur

- Aucun faux positif ou faux negatif fourni pour l'instant.
- Quand ils existent, les noter ici avec:
  - profil utilise;
  - combat cible;
  - verdict en jeu;
  - verdict simulateur;
  - capture ou notes manuelles.

## Impact sur l'equipe

- Noor: utiliser ces profils comme base de compatibilite sans ressaisie.
- Tess: utiliser les profils complets/incomplets comme fixtures de verdict.
- Oren: le XAPK 2.8.2 est valide; figer maintenant le snapshot de donnees v4
  et sa provenance.
- Tess: le scaling `F1D Raw / 100` est confirme; le moteur actuel utilise un
  facteur deux trop eleve et ne doit plus porter le verdict v4.
- Lina: prevoir l'affichage des profils incomplets sans forcer la ressaisie complete.
- Vega: attendre que Tess remplace le calcul herite et valide au moins un
  profil fixture avant BIS v4.
