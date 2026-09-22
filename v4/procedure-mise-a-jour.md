# Procedure de mise a jour du jeu (v4)

Cette procedure s'applique a chaque nouvelle version de Forge Master. La
version active reste utilisable pendant l'analyse. On ne modifie pas la v2/v3,
on n'ecrase jamais `packages/v4-game-data/data/2.8.2` ni un autre snapshot
historique, et aucun utilisateur ne ressaisit son profil entier.

## 1. Reception et identite (Oren)

- Noter la source, la date de recuperation, le nom, la taille et le SHA256 du
  XAPK. Conserver l'original intact.
- Figer l'etat v4 actif (commit/tag ou sauvegarde immuable) avant toute
  modification du moteur. Les fichiers v4 de ce workspace ne sont pas encore
  suivis par Git: sans cette etape, le retour arriere n'est pas garanti.
- Verifier dans les metadonnees du **base APK** le package
  `com.hariwn.legendofcivilizations`, `versionName`, `versionCode` et le
  certificat des APK du bundle. Comparer avec la version annoncee par la
  source. Si l'identite diverge ou reste inconnue, arreter.
- Ne pas deduire `versionName` du nom du fichier ou du champ
  `--game-version`: l'exporteur ne verifie pas la version Android.
- Analyse statique locale seulement: pas de lancement de l'APK, d'acces aux
  serveurs du jeu, de contournement ou de copie de code proprietaire.

Commandes PowerShell 7 depuis la racine du repo (remplacer les trois valeurs):

```powershell
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$activeVersion = "2.8.2"
$version = "2.X.Y"
$xapk = (Resolve-Path -LiteralPath "CHEMIN_DU_NOUVEAU.xapk").Path
$snapshot = Join-Path (Get-Location) "packages/v4-game-data/data/$version"
if (Test-Path -LiteralPath $snapshot) { throw "Snapshot deja present: $snapshot" }
Get-FileHash -LiteralPath $xapk -Algorithm SHA256
```

## 2. Extraction isolee (Oren)

Utiliser Python 3. Le bloc ci-dessous prend le Python du `PATH` ou celui du
runtime Codex installe sur ce poste. PowerShell 7 stoppe au premier code de
sortie non nul. `--output` et `--game-version` sont
obligatoires pour ne pas toucher au snapshot precedent.

```powershell
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (!$python) { $python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' }
if (!(Test-Path -LiteralPath $python)) { throw "Python 3 introuvable" }
& $python -B v4/tools/inspect_metaplay_archive.py --self-test
& $python -B v4/tools/inspect_metaplay_archive.py $xapk
& $python -B v4/tools/export_v4_game_data.py $xapk --game-version $version --output $snapshot
& $python -B v4/tools/export_v4_game_data.py $xapk --game-version $version --output $snapshot --check
```

Conserver `manifest.json`, les tables `raw/` et `normalized/` ensemble. Le
manifeste porte les tailles et SHA256 verifies au chargement. Si une table
requise manque ou si un tag/format change, l'extraction est bloquee: adapter
le parseur avec un test cible, sans valeur par defaut inventee. N'utiliser
`--oracle` que pour un export communautaire **de la meme version**; une
ancienne version n'est pas une reference pour forcer l'egalite.

## 3. Comparaison et impact (Oren + Tess)

- Comparer le nouveau manifeste et les tables avec le dernier snapshot actif:
  tables ajoutees/supprimees, hashes raw et normalises, nombres de lignes,
  valeurs et schemas. Distinguer changement de donnees, de format et de
  mecanique.
- Conserver les resultats des tests et goldens de la version active avant de
  changer `V4_GAME_VERSION`, afin de pouvoir expliquer chaque ecart.
- Si les tables sont identiques mais le binaire change, verifier quand meme
  les methodes qui produisent les verdicts: stats, degats, cadence, skills,
  PvP et donjon. Desassembler seulement les methodes concernees si necessaire.
- Si une donnee manque dans l'archive, examiner aussi les assets Unity,
  prefabs et localisations. Un texte pre-rempli peut etre un ancien exemple:
  verifier sa provenance avant d'en faire une constante de calcul.
- Pour les evenements saisonniers, identifier la saison et dater les valeurs
  independamment de la version APK. Conserver le statut de chaque source
  (parametre runtime, texte de prefab, releve communautaire, capture en jeu).
- Inscrire dans `v4/analyse-<version>.md` les faits verifies, les hypotheses,
  les inconnues, les formules modifiees et les preuves. Ne pas retoucher le
  compte rendu 2.8.2 comme s'il decrivait la nouvelle version.
- Si une regle essentielle n'est plus comprise, retourner `missing_data` ou
  garder la nouvelle version candidate; ne pas publier un verdict suppose.

Liste des tables dont le contenu a change (raw ou normalise):

```powershell
$old = Get-Content "packages/v4-game-data/data/$activeVersion/manifest.json" -Raw | ConvertFrom-Json
$new = Get-Content "$snapshot/manifest.json" -Raw | ConvertFrom-Json
$names = @($old.tables.PSObject.Properties.Name) + @($new.tables.PSObject.Properties.Name) | Sort-Object -Unique
foreach ($name in $names) {
  $a = $old.tables.$name
  $b = $new.tables.$name
  if ($a.fileSha256 -ne $b.fileSha256 -or $a.normalizedFileSha256 -ne $b.normalizedFileSha256) { $name }
}
```

## 4. Adaptation et verification (Tess + Noor)

- Adapter seulement les normaliseurs et le moteur v4 touches par le diff.
  Mettre a jour les tests de conversion et les cas golden **apres** avoir
  explique chaque changement de resultat; ne jamais accepter un nouveau
  golden juste pour faire passer la suite.
- Tester les profils recuperes, les imports et les profils en base. Les
  champs deja connus sont reutilises; une donnee ponctuelle manquante est
  signalee par son chemin, sans demande de creation d'un nouveau profil.
- Verifier PvE, duel PvP standard, limites de temps, competences, RNG seede,
  valeurs manquantes et regression des anciennes formules. Ajouter un cas reel
  quand un retour joueur ou une mesure en jeu existe.
- Le chargeur `packages/v4-game-data/src/index.ts` garde `V4_GAME_VERSION`
  comme version active par defaut; un candidat exige un chemin et une version
  attendue explicites. Ne changer la version active qu'apres validation du
  candidat. Revoir alors les tests et goldens v4; conserver l'ancien snapshot
  sur disque pour audit.

Verification locale actuelle (Node et dependances du repo installes):

```powershell
node node_modules/typescript/bin/tsc -p packages/v4-core/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p packages/v4-game-data/tsconfig.json --noEmit
node node_modules/vitest/vitest.mjs run --configLoader runner --maxWorkers 2
```

## 5. Decision de mise en service (Milo)

Milo valide une fiche contenant: identite et hashes, diff des donnees,
changements de formules, tests/goldens, compatibilite des anciens profils,
cas reels compares et limites restantes. Sans preuve suffisante, le snapshot
reste **candidat** et la version active ne change pas. Si aucun cas reel
n'est disponible, indiquer explicitement `unverified_in_game`; ne pas
annoncer une precision confirmee.

Apres accord: Noor branche l'API sur les verdicts v4 uniques, Vega regenere
le BIS avec la version active, Lina affiche la version et les limites sans
recalculer les combats. Faire un controle final API/front/BIS sur les memes
entrees. En cas de regression, revenir au dernier snapshot et moteur valides;
ne pas supprimer les profils ni les snapshots historiques.
