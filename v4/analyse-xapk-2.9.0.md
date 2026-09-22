# Analyse statique XAPK 2.9.0

Date: 2026-09-17. Statut: **candidat**, non active en production.

## Identite et provenance

- Source declaree par l'utilisateur: APKPure, `Forge+Master_2.9.0_APKPure.xapk`.
- Taille: `127197360` octets; SHA256:
  `2D39FAA02EF0D85B4A2E631BCD8735D914010C2DD6100513D9B47F28A4E0D384`.
- Le `manifest.json` du XAPK **et le manifeste Android du base APK**
  concordent: `com.hariwn.legendofcivilizations`, versionName `2.9.0`,
  versionCode `20900`. Le bundle contient aussi `config.armeabi_v7a.apk`.
- Les blocs de signature v2/v3 du base APK et du split contiennent le meme
  certificat, SHA256 `02AAA1FE7C9D8B39DA41F41169B48A47CF9550514882D0216968568407F85222`,
  identique a celui releve dans le XAPK 2.8.2. L'integrite cryptographique
  complete des signatures APK n'a pas ete verifiee avec `apksigner`.
- `SharedGameConfig.mpa`: archive Metaplay v5, checksum
  `CDFF4CFC8CD20D6C5BF7201C94BC7586`, creee le
  `2026-08-28T10:15:11.436Z`.

Analyse locale statique seulement. Aucune connexion aux serveurs du jeu ni
execution de l'APK.

## Delta par rapport a 2.8.2

- 76 entrees de configuration contre 73. Ajouts:
  `FairyUpgradesLibrary`, `GuildTechRaceEliminationLibrary`,
  `TrackingEventLibrary`; aucune suppression.
- 16 autres entrees changent: `ArenaLeagueLibrary`, `ArenaRewardLibrary`,
  `BaseConfig`, `GuildBaseConfig`, `GuildTechRaceRewardLibrary`,
  `GuildTechTreeUpgradeLibrary`, `GuildWarConfig`, `MissionLevelLibrary`,
  `PlayerSegments`, `ProfileBaseConfig`, `SecondaryStatLibrary`,
  `SetsLibrary`, `SkinsLibrary`, `StatConfigLibrary`, `WeaponLibrary` et
  `WorldIndexConfigLibrary`. Toutes ne sont pas consommees par le moteur v4;
  leurs effets hors duel/PvE standard restent a auditer.
- Parmi les 23 tables exportees dans le snapshot v4, trois changent:
  `SecondaryStatLibrary`, `StatConfigLibrary` et `WeaponLibrary`.
- `WeaponLibrary`: 99 vers 111 armes. L'arme `Age=-1001, Idx=12` passe de
  `IsRanged=true` a `false`, donc sa classe de degats distance/melee change.
- `SetsLibrary`: six nouveaux sets; les 21 entrees precedentes sont
  identiques. `SkinsLibrary` change aussi, mais son contenu n'est pas decode
  par le lecteur statique actuel.
- Nouvelle stat `ReflectChance` (`StatType=21`, `SecondaryStatType=15`):
  cible joueur, nature `Multiplier`, valeur par defaut zero. L'exporteur
  la reconnait sans modifier le snapshot 2.8.2.

## Mecanique verifiee: reflexion

Le binaire IL2CPP 2.9.0 contient `CombatStats.ReflectChance` et
`CombatDmg.Reflected`. L'analyse ciblee de `GetDamage` montre les tirages
esquive, blocage, reflexion, puis critique. `ApplyDmg` applique les degats
au defenseur et le vol de vie a l'attaquant, puis retire a l'attaquant la
meme quantite de degats resolus si le coup est marque reflechi. Ce retour
n'est pas une seconde attaque recursive; il peut produire un double KO.

Le moteur v4 porte cette regle uniquement quand `data.version` vaut `2.9.0`.
Le comportement et la sequence RNG 2.8.2 restent inchanges. Les tests
couvrent un verdict PvE modifie par la reflexion, une victoire PvP par
reflexion et le classement de l'arme reclassifiee.

## Fées: formule confirmee et parametres de saison candidats

Les trois fees **Mira, Tira et Lora** sont confirmees dans l'asset Unity
`FairiesVisualConfig` du base APK. Cet asset ne stocke que les noms et les
references visuelles. Le bundle de localisation `Fairies_en` fournit des
textes generiques: bonus par palier de statistique equipee,
plafond possible, niveau et expiration. Il ne donne aucune valeur propre a
Mira, Tira ou Lora. Une recherche elargie a retrouve des textes chiffres de
Mira dans trois prefabs d'ecran, ainsi qu'un releve communautaire des trois
fees: voir `fees-2.9.0.md`. Les textes pre-remplis de Mira different des
valeurs de saison relevees en jeu; ils ne sont pas une reference runtime.

`FairyUpgradesLibrary` contient 19 paliers de cout (niveaux 2 a 20), **pas** les bonus de
combat. Le binaire reference `FairiesEventConfig.Stats` (liste de
`FairyStatLibrary`), la fee selectionnee et son niveau dans
`FairiesEventModel`. Les champs de bonus comprennent la stat cible, la
valeur de base, le gain par niveau, une condition et un plafond.
`ServerGameConfig.FairiesEventTemplates` ne figure pas parmi les 76 entrees
de l'archive locale. Les parametres candidats sont desormais consignes avec
leur source et leur date; ils ne sont pas etablis par l'archive locale.
La formule avec paliers entiers et plafond est confirmee dans le binaire.
Les anciens exports de profils n'indiquent
pas la fee selectionnee ni son niveau.

Ne pas inventer un bonus nul pour un joueur ayant une fee active et ne pas
publier de verdict 2.9.0 comme valide en jeu avant d'avoir les valeurs et
l'etat de fee necessaires. Une donnee ponctuelle pourra etre ajoutee au
profil existant, sans faire recreer le profil entier.

## Snapshot et controles

- Snapshot isole: `packages/v4-game-data/data/2.9.0` (23 tables wire,
  13 tables normalisees et manifeste avec SHA256). L'export `--check` passe.
- Le re-export de `2.8.2 --check` passe; version active par defaut: `2.8.2`.
- Chargement 2.9.0 uniquement par chemin **et** version attendue explicites.
- Les 14 anciens exports de profils restent lisibles en PvE et PvP:
  11 simulables; les trois autres conservent leur diagnostic
  `missing_profile_weapon`.
- Compilation TypeScript v4-core et v4-game-data OK; 129 tests sur 129
  passent, y compris les goldens historiques 2.8.2.
- Aucun cas reel de faux positif/negatif 2.9.0 n'est encore disponible.

## Avant promotion

1. Faire verifier l'integrite des signatures APK avec `apksigner` ou un
   outil equivalent de confiance.
2. Confirmer le releve des bonus de saison dans `fees-2.9.0.md` et obtenir
   la selection/niveau des joueurs concernes, en evitant le double comptage
   si leurs totaux incluent deja la fee.
3. Auditer les changements `SetsLibrary`, `SkinsLibrary` et autres tables
   pertinentes pour les stats du profil; verifier un cas PvE et un duel PvP
   reels 2.9.0.
4. Repasser les tests, documenter les ecarts de verdict, puis seulement
   basculer `V4_GAME_VERSION` et les consommateurs API/front/BIS.

Decision Milo: **ne pas promouvoir 2.9.0 pour l'instant**. Le snapshot et
la reflexion sont exploitables en tests locaux; la precision globale du jeu
2.9.0 reste `unverified_in_game`.
