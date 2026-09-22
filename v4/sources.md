# Sources utiles v4

## Donnees locales a garder

Version actuellement chargee par le code existant: `2026_05_23_14_08`.

Source locale v4 validee:

- jeu: Forge Master `2.8.2`, versionCode `20802`;
- archive: `assets/SharedGameConfig.mpa`;
- creation archive: `2026-07-24T09:54:24.324Z`;
- checksum archive: `C28A5430D47F3F5B9BD30DD7E28AED47`;
- comparaison communautaire: version `2026_07_15_12_09` au commit
  `0647fc8c9788df04a71e93ac408c9a638eb32fbc`;
- rapport: `v4/analyse-xapk-2.8.2.md`.

La version `2026_05_23_14_08` reste une entree historique. Elle ne doit pas
etre presentee comme la version de donnees du verdict v4.

Fichiers importants charges par `packages/game-data`:

- `SecondaryStatLibrary.json`
- `SkillLibrary.json`
- `SkillMechanics.json`
- `TechTreeLibrary.json`
- `TechTreeMapping.json`
- `ItemBalancingLibrary.json`
- `ItemBalancingConfig.json`
- `WeaponLibrary.json`
- `PetLibrary.json`
- `PetUpgradeLibrary.json`
- `MountLibrary.json`
- `MountUpgradeLibrary.json`
- `PvpBaseConfig.json`
- `MainBattleConfig.json`
- `MainBattleLibrary.json`
- `EnemyAgeScalingLibrary.json`
- `EnemyLibrary.json`
- `ProjectilesLibrary.json`

## Sources communautaires deja notees

- ForgeMaster Helper: https://1vcian.me/fm/
- Repo ForgeMaster Helper: https://github.com/1vcian/fm
- Wiki Forge Master: https://forge-master.fandom.com/wiki/Forge_Master_Wiki
- Page stats/builds: https://forge-master.fandom.com/wiki/Sub_stats_and_Builds
- Subreddit: https://www.reddit.com/r/ForgeMasterUnofficial/

## Priorite des sources

1. Configuration embarquee du XAPK valide, avec hash.
2. JSON communautaires pinnes et compares a la configuration embarquee.
3. Export profil compatible 1vcian/fm.
4. Tests manuels en jeu.
5. Wiki communautaire.
6. Discussions communautaires pour hypotheses seulement.

## Informations a verifier avant de coder v4

- Formule de scaling ennemi: verifiee dans le XAPK 2.8.2; voir rapport.
- Timing reel: approche melee, attaque distance, cooldowns et startup des sorts.
- Block: un tirage reussi annule le coup; composition/arrondis encore a figer.
- Regle des lignes secondaires par age/rarete.
- Niveau de reference BIS: pets/monture/sorts niveau 1 ou niveau max selon usage voulu.
