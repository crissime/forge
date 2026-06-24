# Forge Master - Vue d'ensemble du jeu

Forge Master est un jeu mobile idle/competitive ou le joueur progresse en forgeant de l'equipement, en ameliorant ses technologies, en equipant des sorts, pets et montures, puis en comparant sa puissance en PvE/PvP.

## Boucle principale

La boucle de progression ressemble a ceci:

1. Forger ou ameliorer de l'equipement.
2. Garder les pieces avec de bonnes stats principales et secondaires.
3. Monter les arbres de technologie/talents.
4. Equiper des sorts adaptes.
5. Ameliorer pets et monture.
6. Tester la progression PvE, les combats PvP, les evenements et les modes clan/league.

## Equipement

Les slots suivis par notre simulateur sont:

- arme;
- casque;
- gants;
- armure;
- collier;
- bottes;
- anneau;
- ceinture.

Chaque objet a une valeur principale utile au calcul:

- attaque pour certains objets, surtout l'arme et les slots offensifs;
- defense/sante pour les slots defensifs;
- 2 lignes de stats secondaires maximum.

Les drops sont importants parce qu'un objet ne peut pas etre garde comme une collection de bonus independants: remplacer une piece fait gagner certaines lignes mais peut en faire perdre d'autres.

## Pets

Les pets apportent aussi des valeurs de combat et des stats secondaires. Ils sont plus interessants a optimiser separement des objets parce qu'un bon pet peut souvent etre garde plus longtemps qu'une piece d'equipement remplacee par forge/drop.

Dans notre simulateur, les pets ont:

- attaque;
- sante;
- 2 lignes secondaires;
- effets des talents pets.

## Monture

La monture est une progression de long terme. Elle peut avoir une forte importance parce qu'elle combine une base de combat avec des bonus durables.

Dans notre simulateur, la monture a:

- attaque;
- sante;
- 2 lignes secondaires;
- effets des talents `MountDamage` et `MountHealth`.

## Sorts

Le jeu utilise des sorts equipes. Notre simulateur integre les sorts connus depuis la configuration communautaire de 1vcian/fm et limite la selection a 3 sorts equipes.

Les sorts peuvent contribuer:

- aux degats directs;
- au soin ou bouclier;
- au rythme de combat via cooldown;
- a la valeur de `Skill Damage` et `Skill Cooldown`.

## Talents / technologies

Les arbres de talents influencent differents systemes:

- bonus d'objet par slot;
- bonus de pets;
- bonus de monture;
- bonus de sorts;
- progression non-combat comme couts, timers et chances.

Notre simulateur affiche les arbres mais ne donne un impact numerique qu'aux noeuds utiles au score combat. Les noeuds non-combat peuvent rester visibles pour comprendre la progression de l'arbre.

## PvE et PvP

Le PvE sert surtout a mesurer une progression generale: degats, survie, sustain et sorts sur une duree donnee.

Le PvP est plus comparatif: il faut connaitre ou estimer les stats adverses, son attaque/PV, ses sorts et ses bonus. C'est pourquoi notre outil a un objectif specifique PvP et un objectif equilibre PvE/PvP.
