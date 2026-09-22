# Audit donnees BIS v4

Oren, 2026-09-22. Lecture locale ciblee uniquement; aucun scan APK, web,
batch ou changement de code. Lecture initiale avant les livraisons paralleles
de Milo (preflight/integration), Tess (core/fees) et Vega (recherche).
Relecture finale: `fairy.ts` et son branchement dans `combat-profile.ts`/`index.ts`
ont apparu pendant l'audit. Contrat observe: `fairy` (id, niveau, saison,
eventState, statsState), `secondaryStatsBeforeFairy`, `FairySeasonConfig`.
Implementation parallele non testee ici; les actions core ci-dessous sont des
criteres de livraison, pas une affirmation que ce travail reste entierement absent.

## Verdict court

**Batch reel tous parametres bloque.** Un combat sur des totaux fournis est
possible; cela ne prouve ni la reconstruction ni la legalite d'un nouveau build.

1. Le constructeur v4 reconstruit maintenant les bases item/pet/monture et les
   secondaires depuis les catalogues APK normalises. Il ne reutilise aucun total
   importe; les talents restent une contribution explicite par scenario.
2. Les deblocages de lignes et les bornes sont verifies. Restent a fixer par
   scenario: ages, raretes, niveaux, politique de doublon et grille discrete de
   rolls; les raccourcis de l'ancien BIS ne sont pas des preuves de regles du jeu.
3. Skins et sets de skins sont exclus. La saison des fees est confirmee par
   l'utilisateur et integree dans chaque candidat; sa validation en jeu manque.

La version active du loader est **2.8.2**. La 2.9.0 exige chemin ET version
attendue explicites; elle reste candidate, `unverified_in_game`.

## Sources et distinction essentielle

Sources de cadrage: `v4/plan-calculateur-bis.md`, `v4/fees-2.9.0.md`,
`v4/analyse-xapk-2.9.0.md`, `v4/simulateur.md`, `v4/pvp.md`.
Sources executables: `packages/v4-core/src/{index,combat-profile,skill-data,stat-resolver}.ts`,
`packages/v4-game-data/src/index.ts`, manifeste et JSON `data/2.9.0/{raw,normalized}`
de ce dernier package; mappings dans `v4/tools/export_v4_game_data.py`.
Historique consulte: `packages/simulator/src/index.ts`,
`packages/game-data/src/index.ts`, `scripts/generate-simulated-bis.mjs`.

`adaptProfileToV4` reconnait/enveloppe un profil existant. `buildPlayerCombatProfile`
lit `base.attack`, `base.health`, `stats`, l'arme et la geometrie de monture;
il ne somme pas objets/pets/talents. Remplacer un ID en conservant les totaux
du profil importe n'est PAS une construction de candidat.
L'ancien `canonicalizeProfile` conserve meme un delta secondaire positif
(`positiveStatDelta`): utile a la compatibilite, impropre a une reconstruction
BIS sans provenance. Aucun total de joueur ne doit servir de base implicite.

Le manifeste 2.9.0 contient les tables requises et **12 tables optionnelles**;
**21 tables sont normalisees**. Le loader verifie tailles/SHA256 et expose
toutes les tables normalisees presentes dans `data.tables`. Wire n'est pas le JSON
semantique historique: `{value, wire}` et tags numeriques, pas `EquipmentStats`.
Un chargement reussi garantit l'integrite du snapshot, pas sa suffisance BIS.

## Matrice actionable

Les noms de tables ci-dessous designent le snapshot v4 2.9.0. "Partiel"
signifie disponible en partie, pas autorise a completer silencieusement par zero.

| Famille | Source / statut constate | Bloqueur et action |
| --- | --- | --- |
| Bases items / niveaux | `ItemBalancingLibrary`, `ItemBalancingConfig`, `WeaponLibrary`, `ProjectilesLibrary` normalises. Config: bases joueur 10/80, croissance ~1.01, niveau de base max 98, facteur melee ~1.6. Le constructeur applique les bases et facteur melee. | Verifier arrondis/couches et acces aux objets speciaux. `WeaponLibrary` decrit le combat, pas toutes les bases d'equipement. Ne pas extrapoler 98 en plafond universel sans regle d'acces. |
| Secondaires / lignes | `SecondaryStatLibrary` fournit bornes et `StatNodes`; les tables APK `SecondaryStatItemUnlockLibrary` et `SecondaryStatPetUnlockLibrary` confirment: items ages 0-2: 0, 3-6: 1, 7-9: 2; Common/Rare/Epic: 1, Legendary/Ultimate/Mythic: 2. | Les bornes sont appliquees par porteur avec tolerance fixe Q32.32. Une statistique ne peut pas etre repetee sur un meme porteur; reste a confirmer la grille discrete de rolls. Stocker une affectation par porteur, pas seulement un nombre global de lignes. |
| Pets / repetitions | `PetLibrary`, `PetUpgradeLibrary`, `PetBalancingLibrary`, `PetBaseConfig` sont normalises; `PetSlotsCount=3`. Le constructeur garde chaque occurrence et applique base, multiplicateur et secondaires. | Confirmer deblocages et contraintes du scenario. Ne pas prendre l'enumerateur historique comme preuve suffisante de toutes les regles. Reference: niveau 1. |
| Montures / geometrie | `MountLibrary` et `MountUpgradeLibrary` sont normalises; geometrie deja consommee par le core. Le constructeur applique base et secondaires. | Expliciter l'etat des skills de monture, non reconstruites par `combat-profile`. Ne pas canonicaliser sur le premier ID: Rare 0 et Rare 1 ont deja des offsets differents. Reference: niveau 1. |
| Sorts | `SkillLibrary` normalisee: rarete, cooldown, duree, tableaux damage/health par niveau. `SkillBaseConfig`: 3 slots, 18 sorts; `skill-data.ts` supporte 18 IDs, refuse doublons et niveaux hors 1..100. | Fixer acces/raretes, ordre des slots et politique d'activation; joindre les effets de talents appropries. Les limites acceptees par le moteur ne prouvent pas l'accessibilite. Reference: niveau 1; pas de selection historique arbitraire des trois meilleurs sorts. |
| Talents / permanents | `TechNodesLibrary`, `PlayerTechTreePositionLibrary`, `PlayerTechTreeNodeValuesLibrary`, `PlayerTechTreeTierLibrary` wire. Ancien agregeur cible equipement/pets/monture/sorts via `TechTreeLibrary` et un mapping historique. | Fixer le scenario de talents (hors recherche initiale), normaliser la jointure position/type/niveau/valeur/cible. Le mapping historique n'est pas une preuve de compatibilite du nouveau schema. Le resolver sait traiter des couches, mais ne collecte pas ces bonus. Tracer aussi tout autre bonus permanent requis. |
| Skins et sets de skins | `SkinsLibrary` et `SetsLibrary` sont des tables distinctes mais liees: le code APK associe les skins a un set et active des bonus par nombre de pieces. | Exclus du scenario BIS de reference par decision utilisateur du 2026-09-22. Aucune extraction supplementaire necessaire pour ce scenario; les declarer hors perimetre dans chaque artefact. |
| Fees / saison | Formule native documentee; Mira/Tira/Lora connues. Coefficients de saison dans `fees-2.9.0.md`, statut `community_transcription`; aucune table fee dans le manifeste. | Figer configuration/hash/source/date et identifiant de saison distinct de gameVersion; selection, niveau accessible, evenement actif/expire, regles de choix/cumul. Tess integre calcul brut/caps avant simulation; validation directe en jeu manque. Cout des upgrades ne donne pas les bonus. |
| PvE / PvP | Tables ennemis/vagues/projectiles et `PvpBaseConfig` normalisees; verdicts officiels disponibles. Reflexion active seulement en 2.9.0. | Figer cible PvE `{age,combat,difficulty}`, horizon, options et seeds; PvP: adversaire/panel, roles et memes parametres traces. Donjon et guerre de guilde hors contrat actuel. Aucun cas reel de validation 2.9.0 fourni par les sources lues. |

## Schemas et formules exploitables

**Bases, piste historique a porter et verifier, pas formule native certifiee:**
`reconstructItem/reconstructPet/reconstructMount` dans `packages/simulator/src/index.ts`:

```text
item = valeurTable * LevelScalingBase^(niveau-1) * (1 + talentCible)
attaqueArmeMelee = itemDamage * PlayerMeleeDamageMultiplier
pet = valeurUpgrade[rarete,niveau-1] * multiplicateurType * (1 + talentPet)
monture = valeurUpgrade[rarete,niveau-1] * (1 + talentMonture)
base.attack/health = baseJoueur + somme(items) + somme(pets) + monture
```

Ne pas reprendre les fallbacks historiques (inconnu -> zero/type Balanced).
Verifier `LevelInfo.Level` (historique indexe depuis zero) plutot que deviner
le niveau. Exemple wire observe: premiere ligne PetUpgrade rarete 0,
niveau encode 0, valeurs Damage=100 et Health=800 avant multiplicateur de type.
`ItemBalancingLibrary.value[]`: tag 1 identite, tag 2 liste de stats;
une stat a tag 1 `StatNode`, tag 2 valeur F64. Le normaliseur existant
`normalize_stat_node` decode deja les tags 1..5 et rejette une cible legacy
non nulle: reutilisable, sans effacer cible/couche/condition.

**Secondaires:** `SecondaryStatLibrary` fournit des fractions; `profile.stats`
attend des points de pourcentage (`0.15` -> `15`). Maxima nominaux observes:
crit 12, critDamage 80, block 5, regen 4, lifesteal/double 20, damage/ranged/health 15,
melee 50, attackSpeed 40, skillDamage 30, skillCooldown 7.
`MoveSpeed`, `AttackRange`, `ReflectChance` ont des bornes **0..0**:
leur presence n'autorise pas une ligne positive; la fee Lora est une autre source.
Conserver la precision wire Q32.32 (echelle 2^32); les nombres nominaux ci-dessus
sont arrondis pour lecture, pas pour les tests de paliers. F1D a l'echelle 100.

**Combat actuel:** `combat-profile.ts` applique conceptuellement
`attaque = base.attack * (1 + damage/100) * (1 + bonusMeleeOuDistance/100)`;
`PV = base.health * (1 + health/100)`. `skill-data.ts` applique
`cooldown = cooldownTable * (1 - skillCooldown/100)`.
Utiliser les fonctions partagees et leurs arrondis, pas une copie dans Vega.
`stat-resolver.ts` expose `layer/nature/value/condition`, pas la collecte des sources.

**Fees, configuration candidate du releve 2026-09-09:**

| Fee | Requis par palier | Bonus niv. 1 / gain par niveau (points) | Cap total cible |
| --- | --- | --- | --- |
| Mira | 15 points skillDamage | critChance: 1 / 1 | 80 |
| Tira | 1 point skillCooldown positif | block: 0.25 / 0.25 | 30 |
| Lora | 10 points health secondaire | reflectChance: 0.75 / 0.75 | 30 |

```text
n = abs(floor(totalSecondaireRequis / diviseur))
brut = n * (bonusBase + gainParNiveau * (niveau - 1))
si brut != 0: effectif = min(totalCibleAvant + brut, cap) - totalCibleAvant
```

Source de formule: `FairyHelpers.CalculateRawBonus` RVA `0x5E689A8`,
`ApplyFairyStat` RVA `0x5E683F4`, consignes dans `v4/fees-2.9.0.md`.
Lire `TotalSecondaryStats` (equipement ET pets/monture), pas les PV finaux.
Garder brut, plafond et contribution effective distincts; celle-ci peut etre
negative si le total avant depasse le cap. Ne pas appliquer ce chemin de cap
au bonus nul sans verifier la regle. Niveau initial 1, upgrades 2..20 observes;
cela ne prouve pas le niveau accessible du cas. Prefabs Mira 5%/50% non utilisables
comme saison actuelle. Un profil importe exige aussi de savoir si la fee est deja incluse.

**PvP:** multiplicateur PV par profil = `1 + 0.5*nbPets + 0.5*nbSorts + 2*montureEquipee`;
le maximum des deux profils s'applique aux deux camps, duree 60 s (table).
Conserver donc les listes et occurrences, pas seulement les totaux de stats.
Classer via `evaluatePvpVerdict().winner`, jamais via un `passed` invente.

## Passage au batch

- **Oren/donnees:** normalisation versionnee des tables wire manquantes, preuves
  de legalite, sets/skins et saison tracee; toute inconnue reste un bloqueur nomme.
- **Tess:** constructeur partage depuis selections et contributions fixes, fees
  recalculees par candidat, aucun reliquat de profil importe; fixtures independantes
  de bases, repetitions, niveaux, couches et seuils/caps Q32.32.
- **Milo:** preflight de suffisance BIS en plus du checksum loader. Refuser les
  composants non resolus, l'acces inconnu et la saison absente; diagnostic distinct
  d'une defaite. Un scenario restreint/experimental doit etre explicitement etiquete.
- **Vega:** cas borne avec IDs/niveaux/lignes affectees, talents/permanents fixes,
  fee et etat, cible/panel/options/seeds; seulement apres construction valide.
  Ne pas reprendre `rangedDamage` exclu, monture unique, degats additifs, stats
  uniquement au maximum, ou reduction aux archetypes comme exhaustivite du jeu.

Minimum de sortie: selections, contributions sourcees, bases et secondaires
bruts/effectifs, profil effectivement simule, verdict officiel, hashes des
donnees/saison/moteur/constructeur, contraintes et limites d'exploration.
Rejouer le gagnant; une petite enumeration exhaustive sert d'oracle avant extension.
Ce document ne lance rien et ne valide pas les implementations paralleles.
