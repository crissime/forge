# Analyse statique APK cible 2.6.0

Date: 2026-08-20.

## Verdict

Le fichier local `forge-master.apk` n'est pas l'APK de Forge Master.

Il s'agit de l'application Aptoide Games. Cet artefact ne contient ni les
classes, ni les tables, ni les formules du jeu. Il est donc rejete comme source
du simulateur v4 et ne doit pas etre execute.

## Faits verifies localement

- chemin: `forge-master.apk`;
- taille: `13202941` octets;
- SHA256: `A7CE7F344D5208100CC6811A676540301351B0B836ABA0E6AED233C35C0CD0CF`;
- package Android: `com.aptoide.android.aptoidegames`;
- nom application: `Aptoide Games`;
- version: `1.20.0`;
- versionCode: `642`;
- activite principale: `com.aptoide.android.aptoidegames.MainActivity`;
- signature APK: v2;
- certificat SHA1: `D590A7D792FD0331542D99FAF9997641790773A9`;
- certificat SHA256: `73534D45C1345A4783C7EFF2CF6038551AB5FDF09673F32C68C3B0864BAA80E4`;
- contenu: 2 fichiers DEX, 11319 classes;
- classes Aptoide detectees: 917 sous `com/aptoide/android`;
- occurrence de `Forge Master`, `forgemaster`, `forge-master` ou `2.6.0`
  dans les chaines DEX: 0;
- aucun JSON, asset pack, OBB, bibliotheque Unity ou bibliotheque Flutter du jeu.

Confiance: haute.

## Identite attendue du jeu

La fiche Google Play officielle donne le package
`com.hariwn.legendofcivilizations` pour Forge Master:
https://play.google.com/store/apps/details?id=com.hariwn.legendofcivilizations

La fiche historique APKPure indique pour la version 2.6.0:

- versionCode: `20600`;
- format distribue: XAPK/APKs;
- base APK attendue: `com.hariwn.legendofcivilizations.apk`;
- taille d'ensemble indiquee: environ 101,5 Mo;
- architecture disponible: `arm64-v8a` ou `armeabi-v7a`.

Ces informations externes servent seulement a controler le prochain artefact.
Le manifeste, la signature et le hash du fichier recu resteront la preuve
locale de reference.

## Fichier necessaire pour continuer

Fournir l'ensemble 2.6.0 original et non renomme de preference:

- un fichier `.xapk`, `.apks` ou `.apkm` complet; ou
- le base APK `com.hariwn.legendofcivilizations.apk` avec tous ses split APK;
- les asset packs ou OBB associes s'ils existent.

Le premier controle sera strict: package
`com.hariwn.legendofcivilizations`, versionName `2.6.0`, versionCode `20600`,
signature, hash et liste complete des splits.

## Impact equipe

- Milo: APK 2.6.0 encore manquant; analyse du jeu bloquee sur l'artefact.
- Oren: rejeter le fichier actuel et valider le prochain ensemble avant toute
  extraction.
- Tess: ne modifier aucune formule a partir de cet artefact.
- Lina, Noor et Vega: aucune action liee a l'APK pour le moment.

## Cadre respecte

Analyse statique locale uniquement. Aucun lancement de l'application, aucun
appel a ses services, aucun contournement et aucune copie de code proprietaire.
