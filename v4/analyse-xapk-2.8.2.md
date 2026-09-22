# Analyse statique XAPK 2.8.2

Date initiale: 2026-08-20. Mise a jour moteur: 2026-08-27.

## Verdict

Le fichier recu est bien Forge Master 2.8.2. Le XAPK, ses deux APK et la
configuration embarquee sont coherents. L'archive fournit les tables utiles au
simulateur et permet aussi de verifier plusieurs formules directement dans le
code IL2CPP.

Conclusion initiale: le moteur v2/v3 ne peut pas servir de reference v4, car
il applique notamment un facteur ennemi faux.

Etat v4 au 2026-08-27: `packages/v4-core` ne depend plus du moteur existant.
Il execute un moteur spatial pur, en precision fixe, avec vagues, mouvement,
attaques, projectiles et les 18 competences confirmees. Une competence
inconnue reste refusee explicitement.

## Identite de l'artefact

- fichier: `Forge+Master_2.8.2_APKPure.xapk`;
- taille: `125500994` octets;
- SHA256: `C496445179936D9139BCDB9E0CB3C4C266426AFA132174D6C334D53C7989A306`;
- application: `Forge Master`;
- package: `com.hariwn.legendofcivilizations`;
- versionName: `2.8.2`;
- versionCode: `20802`;
- minSdk: `26`;
- targetSdk: `36`;
- base APK: `com.hariwn.legendofcivilizations.apk`, `80098163` octets,
  SHA256 `A71B6B5FD14DEDBE8235A7CB625CE9ABB17135D2F35F34EA5AB27402FBD18A21`;
- split armeabi-v7a: `config.armeabi_v7a.apk`, `45389115` octets,
  SHA256 `2D2B239681E1E740B5B3DE99C40524C388D87C2966BC0ACC981302CC33DA848A`;
- certificat commun aux deux APK, SHA256
  `02AAA1FE7C9D8B39DA41F41169B48A47CF9550514882D0216968568407F85222`.

Confiance sur l'identite: haute.

## Technologie

- Unity `6000.0.58f2`;
- IL2CPP armeabi-v7a;
- `libil2cpp.so`: `123074404` octets, SHA256
  `AC19CA6D75F705779FEAE178DE7F57BB2F70FF3DE42F94E75AE504BDBE841A30`;
- `global-metadata.dat`: `22124144` octets, SHA256
  `4206CCD3325848749859D608920C38CBB91D5398AE740C2E80CBAA733656648F`;
- assemblies identifiees: `Assembly-CSharp`, `SharedCode`, `Metaplay`;
- Addressables `2.7.2`, surtout utilises pour la localisation.

## Configuration embarquee

Le base APK contient `assets/SharedGameConfig.mpa`:

- taille: `77898` octets;
- SHA256: `EC736D24A8CFC63C443CFE96D09180F204228D0B89132DB228064EA8F961A572`;
- format Metaplay `MCA!`, version `5`;
- checksum archive: `C28A5430D47F3F5B9BD30DD7E28AED47`;
- creation: `2026-07-24T09:54:24.324Z`;
- entrees: `73` fichiers `.mpc`.

Le lecteur v4 decode 69 entrees sur 73. Les quatre entrees non encore gerees
sont `InAppProducts`, `MissionBattleLibrary`, `PlayerSegments` et
`SkinsLibrary`. Elles ne bloquent pas le simulateur de combat principal.

Tables critiques decodees:

| Table | Nombre |
| --- | ---: |
| `MainBattleLibrary` | 210 combats |
| `EnemyAgeScalingLibrary` | 11 ages |
| `EnemyLibrary` | 72 ennemis |
| `WeaponLibrary` | 99 armes |
| `ItemBalancingLibrary` | 232 bases objets |
| `SecondaryStatLibrary` | 15 stats internes, dont 13 tirables |
| `SkillLibrary` | 18 competences |
| `PetLibrary` | 25 pets |
| `MountLibrary` | 15 montures |

Snapshot v4 reproductible:

- package: `packages/v4-game-data`;
- 23 tables wire conservees pour audit;
- 13 tables critiques normalisees pour le moteur, dont `MountLibrary` et
  `PvpBaseConfig`;
- chaque fichier est controle par taille et SHA256 au chargement;
- la reconstruction depuis le XAPK compare 478 lignes avec l'oracle
  communautaire pinne; 2 lignes supplementaires proviennent uniquement de
  l'APK (`MoveSpeed` et `AttackRange`).

Outil reproductible:

```powershell
python -B v4/tools/inspect_metaplay_archive.py --self-test
python -B v4/tools/inspect_metaplay_archive.py Forge+Master_2.8.2_APKPure.xapk
python -B v4/tools/inspect_metaplay_archive.py Forge+Master_2.8.2_APKPure.xapk --entry MainBattleConfig

# Necessite capstone, lit le binaire local sans l'executer.
python v4/tools/disassemble_il2cpp.py libil2cpp.so script.json "SkillBuilder$$RainOfArrow"
```

## Formules confirmees

### Conversion du scaling ennemi

`EnemyAgeScalingLibrary` utilise le type Metaplay `F1D`:

```text
Precision = 2
Multi = 100
valeur reelle = Raw / 100
```

Exemples de l'age 0:

- `Health.Raw = 3500` donne `35` PV, pas `3500`;
- `Damage.Raw = 500` donne `5` degats, pas `500`.

### PV et degats ennemis

Les methodes IL2CPP `MainBattleBalancing.GetEnemyHp` et
`MainBattleBalancing.GetEnemyDmg` donnent:

```text
enemyHp = (Health.Raw / 100)
          * pow(EnemyHpDifficultyMulti, difficultyIdx)

enemyDamage = (Damage.Raw / 100)
              * pow(EnemyDmgDifficultyMulti, difficultyIdx)
              * (weapon.IsRanged ? EnemyRangedDamageMultiplier : 1)
```

Avec la configuration 2.8.2:

- `EnemyHpDifficultyMulti = 6000000`;
- `EnemyDmgDifficultyMulti = 6000000`;
- `EnemyRangedDamageMultiplier = 0.6699999999254942`;
- `difficultyIdx = 0` applique un facteur `1`;
- `difficultyIdx = 1` applique un facteur `6000000`.

Le jeu consulte explicitement `WeaponInfo.IsRanged` pour le multiplicateur
ennemi. `AttackRange > 1` n'est pas la regle metier.

### Resolution d'un coup

`AttacksSystem.GetDamage` confirme cet ordre:

1. tirage dodge;
2. tirage block;
3. tirage critique;
4. le block reussi met les degats du coup a zero;
5. le critique multiplie les degats par la valeur critique resolue.

### Composition des degats joueur

Le resolveur de stats IL2CPP confirme deux regles distinctes:

- les contributions d'une meme couche sont additionnees;
- les couches successives sont composees par multiplication.

`DamageMulti` est dans la couche `None`. `RangedDamageMulti` et
`MeleeDamageMulti` sont dans `GeneralCompounding`. La formule est donc:

```text
degats distance = base * (1 + somme DamageMulti)
                       * (1 + somme RangedDamageMulti)

degats melee = base * (1 + somme DamageMulti)
                    * (1 + somme MeleeDamageMulti)
```

La condition `Ranged` ne s'applique que si `WeaponInfo.IsRanged` est vraie;
la condition `Melee` ne s'applique que si elle est fausse.

### Precision et arrondis

- `F64` utilise une echelle `2^32`;
- `F1D` utilise une echelle `100`;
- `F6D` utilise une echelle `1 000 000`;
- multiplication `F6D`: `(a * b) / 1 000 000`;
- division `F6D`: `(a * 1 000 000) / b`;
- les divisions entieres tronquent vers zero apres chaque operation;
- la conversion `F64 -> F6D` tronque, elle n'arrondit pas.
- le tick `F64(0.1)` vaut exactement `429496729`; sa conversion en F6D vaut
  `99999`. Un arrondi a `429496730` decale certaines impulsions de competence.

### Cadence d'attaque

- cadence logique: 10 ticks par seconde (`dt = 0.1`);
- cycle: `Idle -> WindingUp -> OnCooldown -> Idle`;
- `AttackDuration` couvre le cycle total, pas seulement le cooldown;
- le timer avance de `dt * AttackSpeedMulti`;
- l'entree en windup ne consomme pas de temps sur le tick d'acquisition;
- si la cible quitte la portee pendant le windup, l'attaque est annulee;
- une double attaque est un second coup complet, pas un multiplicateur x2;
- ce second coup arrive apres un quart du windup nominal et refait ses propres
  tirages dodge, block et critique.

Le generateur aleatoire est le `RandomPCG` du jeu. La v4 reproduit son etat
64 bits et sa sortie PCG32, ce qui rend les simulations seedees reproductibles.

### Mouvement et engagement

Constantes et initialisation confirmees:

- joueur cree en `(0, 0)`;
- centre de combat place a `player.x + 15`;
- vitesse de mouvement par defaut: `2`;
- rayon d'unite par defaut: `0.35`;
- espacement de formation ennemi: `1`;
- delai initial optionnel avant la premiere vague: `2` secondes;
- chaque arme porte `AttackRange`, `WindupTime`, `AttackDuration` et
  `IsRanged`;
- le combat execute successivement skills, ciblage/deplacement, physique et
  attaques a chaque frame logique.

Ordre confirme d'une frame de combat:

1. competences et timers;
2. ciblage et vitesses;
3. physique des projectiles;
4. physique des unites;
5. impacts des projectiles;
6. impacts de zone;
7. regeneration et attaques normales;
8. ajout des nouvelles entites differees.

La cible est l'adversaire le plus proche. Une cible est en portee seulement si
`distance < porteeArme + rayonAttaquant + rayonCible`. Les formations sont
deterministes, avec au plus 2 unites par ligne jusqu'a 4 ennemis, puis 3.

### Projectiles

- la gravite est `(0, -9.81)`;
- la vitesse recoit d'abord la gravite, puis la position recoit `vitesse * dt`;
- la collision teste le segment parcouru pendant la frame, avec une inegalite
  stricte;
- les statistiques du coup sont copiees dans le projectile a sa creation.
- le depart normal combine `Position`, `UnitOffset`, `Hand` et `Offset`;
- avec `IsAiming`, `Offset` est tourne par la direction normalisee vers
  `cible.Position + cible.CenterOfMass`; sinon il est seulement miroire selon
  le camp;
- la duree vaut `(cible.x - depart.x) / vitesse.x`; un projectile n'utilise pas
  de timeout arbitraire.

### Pets et montures

Les exports recuperes stockent deja dans `base.attack` et `base.health` la
somme base + equipement + pets + monture. Le moteur applique ensuite les stats
secondaires agregees du profil. Il ne faut donc pas rajouter une seconde fois
les valeurs des pets ou de la monture.

Dans le combat principal, `BattleModelExtensions.UpdateMount` modifie la meme
unite joueur; il ne cree pas un combattant de monture separe. La configuration
de monture fournit `UnitOffset`, `CenterOfMass` et `ColliderRadius`. La v4
charge maintenant les 15 lignes de `MountLibrary`, utilise le rayon pour la
physique et la portee, et le centre de masse pour les collisions et les cibles
de projectiles. Sans monture, les valeurs restent centre `(0, 0)` et rayon
`0.35`.

### Competences actives

Le profil stocke un niveau joueur `1..100`; le jeu lit directement un index
`0..99`. L'adaptateur v4 effectue donc `index = niveau - 1` sans modifier le
profil conserve.

Formules confirmees:

```text
degats competence = baseNiveau
                    * (1 + DamageMulti)
                    * (1 + SkillDamageMulti)

vie competence = baseNiveau
                 * (1 + HealthMulti)
                 * (1 + SkillDamageMulti)

recharge = rechargeBase * (1 - SkillCooldownMulti)
```

Les competences commencent avec une recharge fixe de 4 secondes. Avec le tick
F6D exact de `99999`, elles deviennent disponibles apres 41 mises a jour. Une
recharge normale commence seulement apres la fin de la duree active.

Competences implementees sans approximation silencieuse:

| Competence | Mecanique confirmee |
| --- | --- |
| `RainOfArrows` | rayon 6, impulsion 0.2 s, 10 impacts reels, chaque impact vaut `Damage / 15` |
| `Arrows` | 3 projectiles balistiques, chacun vaut `Damage / 3`, vitesse 20, rayon 0.4 |
| `Shuriken` | 5 projectiles balistiques, chacun vaut `Damage / 5`, vitesse 20, rayon 0.4 |
| `Shout` | zone rayon 10 decalee de 5 vers l'ennemi, 8 impulsions sur 1.5 s, chacune vaut `Damage / 8` |
| `Bomb` | zone rayon 4 au centre ennemi, impact final apres 1 s, vaut `Damage` |
| `Worm` | zone rayon 4 au centre ennemi, impact final apres 0.1 s, vaut `Damage` |
| `Thorns` | rayon 3, impulsion 0.5 s, 2 impulsions puis un impact final, chaque impact vaut `Damage` |
| `Meat`, `Morale`, `Berserk`, `Buff`, `HigherMorale` | meme cycle generique de bonus degats/vie sur le camp allie, soigne le gain de vie puis borne les PV a l'expiration |
| `Meteorite` | 5 zones finales de rayon 5, dispersees autour du centre ennemi, delai aleatoire de 1 a 2 s, chacune vaut `Damage / 5` |
| `Lightning` | 5 zones finales de rayon 3, dispersees autour du centre ennemi, delai aleatoire de 0 a 0.5 s, chacune vaut `Damage / 5` |
| `CannonBarrage` | 3 zones finales de rayon 6, dispersees autour du centre ennemi, delai aleatoire de 1 a 1.5 s, chacune vaut `Damage / 3` |
| `Stampede` | zone mobile de rayon 3, depart a 15 derriere le joueur, vitesse 8 vers l'ennemi, impulsion 0.25 s pendant 8 s, sans impact final |
| `StrafeRun` | zone fixe de rayon 3 au centre ennemi, impulsion 0.25 s pendant 1 s, sans impact final |
| `Drone` | unite temporaire immobile, non solide et non ciblable, decalee de 10 selon le camp et de 1 en hauteur; portee 4, attaque 0.5 s, windup 1/6 s, projectile non gravitaire vitesse 30 rayon 0.2 |

Les impacts de competence refont les tirages dodge, block et critique par
cible, puis appliquent le lifesteal. Ils ne declenchent pas de double attaque.

`AttacksSystem.ApplyDmg` confirme aussi la base du lifesteal: le soin vaut les
degats resolus multiplies par `LifeSteal`, puis il est borne aux PV max de
l'attaquant. Les degats ne sont pas bornes aux PV que la cible possedait avant
le coup; un sur-degat produit donc bien du lifesteal sur sa valeur complete.

L'auto-activation est maintenant confirmee cote client. Le profil conserve un
booleen `PlayerSkillCollectionModel.AutoActivateSkillActive`. Quand il est
actif, `CombatSkillAutoSkillVisual.Update` parcourt les entites competence dans
leur ordre, ignore celles actives ou en recharge, verifie qu'elles sont
equipees, puis envoie une `ActivateSkillAction` pour chacune. Les exports de
profils recuperes ne contiennent pas ce booleen. Le contrat v4 expose donc
`skillActivationPolicy: "auto_when_ready" | "disabled"`; le defaut reste
`auto_when_ready`, avec un avertissement dans le verdict si l'appelant n'a pas
fait ce choix explicitement.

L'ordre de cette activation est confirme par `PvpBattleSimulator.Step`: la
scene execute d'abord sa frame complete, puis `TryActivateSkills` est appele
pour chaque camp. Une competence devenue disponible pendant la frame est donc
activee apres les attaques normales; ses projectiles ou zones commencent leur
physique a la frame suivante. La correction de ce decalage a fait passer le
golden Elkikito 9-10 normal de `118.6 s` a `119.3 s`, sans changer son verdict
passant.

`Arrows` et `Shuriken` utilisent un `PseudoRandom` distinct du PCG des attaques.
Son compteur partage est incremente a chaque tirage, puis la valeur suit
`(((offset * a + b) & 0x7fffffff) % c) / c`. Le depart est place a `(-12, 2)`
du joueur allie, avec une dispersion x dans `[-4, 4]` et y dans `[-2, 2]`.
Les ennemis gardent l'ordre des entites; les cibles sont choisies par
`index % nombreEnnemis`. La cible est une position figee au lancement, sans
retargeting. La trajectoire utilise la gravite `-9.81` et expire a la duree
balistique `(cible.x - depart.x) / vitesse.x`. Le tableau natif
`GetSkillDamageCount` confirme 3 projectiles pour `Arrows` et 5 pour
`Shuriken`.

`SkillBuilder.IsBuff` est un bitmask qui contient exactement `Meat`, `Morale`,
`Berserk`, `Buff` et `HigherMorale`. Le moteur partage donc une seule mecanique
pour ces cinq competences. Une liste `DamagePerLevel` ou `HealthPerLevel` vide
signifie zero pour cette composante; c'est notamment le cas de `Meat` et de
`Berserk` dans les donnees 2.8.2.

Le jeu simule donc des positions et une portee. Les delais fixes d'approche du
moteur actuel ne sont pas une formule du jeu.

## Comparaison des donnees

Apres conversion semantique, la 2.8.2 est identique a l'extraction
communautaire pinnee `2026_07_15_12_09`, repo au commit
`0647fc8c9788df04a71e93ac408c9a638eb32fbc`, pour:

- les 210 combats;
- les 11 scalings d'age;
- les 72 ennemis;
- les 99 armes;
- les 18 competences;
- `MainBattleConfig`;
- `ItemBalancingConfig`.

Par rapport aux donnees projet `2026_05_23_14_08`:

- `WeaponLibrary` passe de 87 a 99 entrees;
- 12 armes speciales ont ete ajoutees;
- `IsRanged` a change de `false` a `true` pour l'arme speciale
  `Age=-1001, Idx=12`;
- les 46 armes referencees par les ennemis principaux ont actuellement une
  coherence parfaite entre `IsRanged` et leur portee;
- le schema `StatNode` a migre de cibles legacy vers `Target`, `Layer` et
  `Condition`;
- `DamageMulti` ne cible plus la vie des competences actives;
- `HealthMulti` cible maintenant aussi la vie des competences actives;
- `MoveSpeed` et `AttackRange` existent dans la table interne, avec des plages
  nulles: elles ne font pas partie des 13 stats secondaires tirables.

## Erreurs demontrees dans v2/v3

1. `packages/simulator/src/index.ts` utilise
   `MAIN_BATTLE_ENEMY_SCALE = 0.02`; la conversion exacte est `Raw / 100`, donc
   un facteur `0.01`. Le moteur double les PV et degats ennemis de base.
2. Le moteur deduit distance/melee avec `AttackRange > 1`; le jeu lit
   `IsRanged`.
3. Le moteur impose deux delais d'approche fixes (`2` et `3` secondes); le jeu
   utilise positions, vitesse, rayon et portee.
4. La premiere ebauche de `v4-core` appelait encore `evaluateProfileSnapshot`.
   Cette dependance a ete retiree: le package v4 n'importe plus aucun module du
   simulateur v2/v3.

Ces points peuvent expliquer des faux negatifs, notamment le facteur ennemi
double. Ils ne suffisent pas encore a garantir tous les cas sans tests en jeu.

## Inconnues restantes

- validation contre des videos ou mesures en jeu, aucun faux positif/negatif
  reproductible n'ayant encore ete fourni.
- validation du duel PvP v4 contre un duel reel; la guerre de guilde reste
  hors du contrat actuel (voir `v4/pvp.md`).

## Decisions Milo

- l'APK 2.8.2 devient la source primaire locale pour les donnees et formules;
- aucune donnee extraite en masse n'est copiee dans l'ancien moteur;
- l'API, l'UI et le BIS restent debranches tant qu'ils n'appellent pas tous le
  meme `evaluateCombatVerdict`;
- le premier verrou du nouveau moteur est un test unitaire `F1D Raw / 100` et
  les exemples age 0: `35` PV, `5` degats melee, `3.35` degats distance;
- l'approche v4 utilise maintenant un modele de positions et non les delais
  fixes `2/3` de l'ancien moteur;
- toute competence non implementee retourne `unsupported_skill` et ne produit
  aucun verdict.

## Transmission equipe

- Oren: figer un snapshot v4 issu de `SharedGameConfig.mpa`, avec hashes,
  schema et provenance; conserver les 15 stats internes et marquer les 13
  tirables.
- Tess: repartir des formules confirmees ci-dessus, sans appeler le moteur v3;
  ajouter les tests de conversion et de difficulte avant le combat complet.
- Noor: aucune migration profil n'est requise par ces donnees; continuer
  l'adaptation a la volee et ajouter la version de donnees au contexte de
  simulation.
- Lina: ne pas afficher de verdict preview avant le nouveau verrou Tess.
- Vega: garder le BIS en attente; aucune regeneration avec le moteur actuel.

## Cadre respecte

Analyse statique locale uniquement. Aucun lancement de l'application, aucun
appel aux services du jeu, aucun contournement et aucune copie de code
proprietaire.
