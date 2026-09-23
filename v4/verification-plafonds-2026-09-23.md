# Verification des probabilites et du palier 3-13

Source : rapport de campagne fourni a la racine, 22 vagues completes,
2 894 616 evaluations et 24 finalistes. Le fichier utilisateur reste inchange.

## Double chance superieure a 100 %

La machine d'attaque v4 programme au plus un second coup accelere. Son test
aleatoire compare un tirage de probabilite au taux de double chance. Au-dela
de 100 %, ce test ne peut devenir plus certain et ne programme pas un troisieme
coup. Cela decrit la mecanique implementee; le plafond affiche dans l'interface
du jeu n'a pas ete confirme par cette verification.

Une incoherence existait dans l'approximation moyenne : le poids du second coup
etait directement le taux brut (1.2 pour 120 %), produisant des degats supplementaires
absents du mode aleatoire. Le poids est maintenant borne a [0, 1]. Les probabilites
de critique, blocage et esquive utilisees dans les esperances sont aussi bornees
a [0, 1], sans inventer de plafond de jeu inferieur (exemple : 80 %).

Tests : egalite des verdicts a 100 % et 120 % pour double chance, critique et
blocage, en mode moyen et aleatoire. Les statistiques brutes restent conservees.

## Impact sur le rapport

Replay des 24 finalistes sur les 25 combats (600 evaluations moyennes) :
- `36c92df8a7` et `effb08b819`, Lora melee avec environ 120 % de double chance :
  21 combats chacun changent de degats ou de temps; aucun verdict ne bascule.
- Les 22 autres finalistes n'ont pas change de degats, temps ou verdict.

Le chemin aleatoire n'a pas ete modifie. La selection initiale en mode moyen
reste potentiellement biaisee : cette verification des finalistes ne revalide
pas tous les candidats ecartes pendant les huit heures.

## Difficile 3-13

Les donnees normalisees de MainBattleLibrary indiquent :
- 3-12 : trois vagues d'un ennemi Id 4.
- 3-13 : deux vagues de deux ennemis Id 4, puis trois ennemis Id 5.

Les finalistes meurent (raison `dead`), sans erreur `missing_data` ni simple
expiration du delai. Exemple : Mira melee `307b8f68ad` meurt a 4.7 s sans degats
infliges en mode moyen; Mira distance `1223104693` atteint deux vagues nettoyees
avant sa mort a 30.6 s. La composition des vagues explique une pression accrue,
mais ce constat ne remplace pas une validation du comportement en jeu.

Les nouveaux checkpoints doivent utiliser un autre dossier : le moteur a change.
