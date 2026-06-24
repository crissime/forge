# Contexte du simulateur

Ce simulateur est une application fan-made distincte de 1vcian/fm. Il est pense comme un outil complementaire pour tester des decisions de build, surtout en PvP.

## Objectifs fonctionnels

- Importer un profil JSON exporte depuis ForgeMaster Helper.
- Garder les objets, pets et monture detailles au lieu de tout ecraser en stats globales.
- Comparer un drop potentiel.
- Estimer une chance de victoire PvP avec stats adverses.
- Proposer des ameliorations simples.
- Sauvegarder automatiquement le profil.
- Rester deployable avec un front public, une API interne et Postgres.

## Decisions de modele

Le simulateur separe:

- base attaque/PV: objets, pets, monture et valeurs manuelles;
- stats secondaires: lignes d'objets, pets, monture et ajustements manuels;
- talents de slot: appliques a la base de la carte concernee;
- talents sorts/passifs: appliques comme stats globales;
- PvP: duel temporel symetrique entre joueur et adversaire.

Le comparateur de drop travaille sur un objet complet. Il faut choisir le slot, l'age, le niveau et les lignes secondaires; l'app reconstruit attaque/PV depuis les JSON du jeu. Le simulateur compare la piece actuelle avec le nouveau drop, affiche le delta de score, et l'option d'equipement remplace directement la piece concernee.

## Import JSON

L'import cherche a lire:

- items par slot;
- pets actifs;
- monture active;
- talents;
- sorts equipes;
- niveau de forge;
- stats secondaires connues.

Si une ligne est rattachee a une carte reconnue, elle reste sur cette carte pour eviter le double comptage. Les stats manuelles servent de fallback pour ce qui n'est pas reconnu.

## Limites connues

- Les formules exactes du jeu peuvent changer.
- Les configs communautaires peuvent etre plus a jour que ce projet.
- Le PvE utilise les PV, degats, vagues et nombres d'ennemis des configs disponibles. Les distances, animations et collisions restent approximees.
- Les nombres d'impacts et le ciblage des sorts viennent d'une analyse communautaire et sont marques avec un niveau de confiance.
- Le PvP depend de la qualite des stats adverses renseignees.
- Le PvP applique les multiplicateurs de `PvpBaseConfig`, les buffs et les impacts de sorts des deux combattants. Les positions et trajectoires restent abstraites.
- Les recommandations sont basees sur des gains marginaux, pas sur une simulation exhaustive de tous les drops possibles.

## Idees d'amelioration

- Affiner les distances, temps de trajet et collisions des projectiles.
- Ajouter une comparaison objet contre objet par slot.
- Ajouter un mode "mon prochain meilleur drop" qui indique quelles stats chercher par slot.
- Ajouter une vue mobile plus compacte pour les objets.
- Ajouter une page d'audit du profil: lignes manquantes, valeurs a verifier, doublons suspects.
- Ajouter export/import du profil propre au simulateur.

## Ethique et reutilisation de projets communautaires

Le projet 1vcian/fm est une excellente reference communautaire. Pour rester propre:

- citer le site et le repo;
- ne pas copier son interface ou son code sans respecter sa licence;
- preferer utiliser son export JSON comme format d'echange;
- contribuer upstream ou demander permission si on veut reutiliser une partie substantielle.
