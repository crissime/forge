# Stats et builds

Ce fichier resume les stats suivies par le simulateur. Les noms viennent du jeu, du wiki communautaire et du format de configuration utilise par ForgeMaster Helper.

## Stats secondaires

| Stat | Role dans le simulateur |
| --- | --- |
| Damage | Multiplie les degats generaux. |
| Health | Multiplie les PV/sante max. |
| Ranged Damage | Multiplie les degats si l'arme est distance. |
| Melee Damage | Multiplie les degats si l'arme est melee. |
| Attack Speed | Augmente le DPS attendu de l'arme. |
| Double Chance | Augmente le DPS attendu via doubles coups. |
| Critical Chance | Augmente la chance de critique. |
| Critical Damage | Augmente le multiplicateur de critique. |
| Skill Damage | Augmente la puissance des sorts offensifs et defensifs. |
| Skill Cooldown | Reduit le cooldown effectif des sorts. |
| Health Regen | Donne du soin par seconde base sur les PV max. |
| Lifesteal | Convertit une partie des degats d'arme en soin. |
| Block | Reduit les degats recus en PvP. |

## Caps et prudence

Le simulateur applique certains plafonds de calcul pour eviter les resultats absurdes:

- `Double Chance`: 100%;
- `Critical Chance`: 100%;
- `Block`: 100%;
- `Skill Cooldown`: 80%.

Ces caps sont des choix de simulation. Ils doivent etre verifies si la communaute ou les fichiers de config du jeu donnent une valeur plus precise.

## Objets

Regle actuelle:

- 8 slots d'equipement;
- 2 lignes secondaires max par objet;
- l'optimiseur de build utilise donc 16 lignes d'equipement;
- les stats principales des objets alimentent la base attaque/PV;
- les stats secondaires alimentent les multiplicateurs.

Les talents d'objets ne sont pas des bonus globaux. Ils s'appliquent au slot correspondant:

- `WeaponBonus`: attaque de l'arme;
- `HelmetBonus`: sante/defense du casque;
- `GloveBonus`: attaque des gants;
- `BodyBonus`: sante/defense de l'armure;
- `NecklaceBonus`: attaque du collier;
- `ShoeBonus`: sante/defense des bottes;
- `RingBonus`: attaque de l'anneau;
- `BeltBonus`: sante/defense de la ceinture.

## Pets et monture

Les pets et la monture sont traites comme des cartes separees:

- attaque;
- sante;
- 2 lignes secondaires;
- talents dedies.

Les talents pets appliques:

- `PetBonusDamage`: attaque des pets;
- `PetBonusHealth`: sante des pets.

Les talents monture appliques:

- `MountDamage`: attaque de la monture;
- `MountHealth`: sante de la monture.

## Sorts

Le simulateur integre les 18 sorts depuis les donnees versionnees:

- 3 sorts equipes max cote joueur;
- 3 sorts equipes max cote adversaire;
- buffs temporaires d'attaque et de PV;
- impacts instantanes ou multi-coups;
- ciblage monocible ou de zone;
- cooldown, duree, delai et intervalle entre les impacts;
- overkill et changement de cible entre les ennemis;
- prise en compte de `Skill Damage` et `Skill Cooldown`.

## Recommandations

Les recommandations actuelles sont heuristiques:

- `Prochaines lignes rentables`: simule l'ajout d'une ligne max de chaque stat.
- `Objets a regarder`: repere les slots/pets/monture qui n'ont pas encore les stats prioritaires.
- `Trades possibles`: simule la perte d'une ligne max contre le gain d'une autre.
- `Arbres de talents`: teste les prochains talents disponibles et classe leur gain.

Ces recommandations ne prouvent pas un optimum parfait. Elles donnent une direction utile pour savoir quoi tester ou comparer.
