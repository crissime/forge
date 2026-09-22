# PvP v4: duel standard

Le duel standard passe par `evaluatePvpVerdict(player, opponent, data, options)`
dans `packages/v4-core`. Il partage les calculs de combat PvE, sans appeler
le moteur v2/v3. La sortie a un vainqueur `player`, `opponent` ou `draw`, ou
`null` si aucune simulation fiable ne peut etre lancee. Elle n'a pas de
booleen `passed`: une victoire PvP n'est pas un passage de combat PvE.

## Regles extraites de l'APK 2.8.2

- Les deux combattants commencent aux positions `(0, 0)` et `(18, 0)`.
- La duree du duel standard vient de `PvpBaseConfig.PvpMatchTimerSeconds`:
  `60` secondes. L'appelant ne peut pas la remplacer.
- Chaque profil donne un multiplicateur de PV:
  `base * 1 + nombrePets * 0.5 + nombreSkills * 0.5 + montureEquipee * 2`.
  Le plus grand des deux multiplicateurs est applique aux deux combattants.
- Si un seul combattant reste en vie, il gagne. Si les deux tombent pendant
  la meme frame, c'est une egalite.
- Au chrono, le vainqueur est celui avec la plus grande fraction
  `PV restants / PV max`; fractions egales: egalite.
- Les deux camps utilisent la meme boucle spatiale, les memes attaques,
  projectiles, competences et tirages aleatoires du moteur v4.

## Contrat et limites

`evaluatePvpVerdict` accepte deux profils normalises existants. Les donnees
incompletes rendent `invalid_input` ou `missing_data` avec un code et un
chemin precis; aucun equipement ou sort n'est invente. Les options exposent
`blockMode`, `seed` et `skillActivationPolicy`. Le mode `average` est un
calcul en valeur attendue, pas une probabilite de victoire; `rng` est un
duel reproductible pour une seed donnee, pas une garantie de resultat reel.
Le champ `validation: "unverified_in_game"` reste present tant qu'aucun cas
PvP reel reproductible n'a ete compare.

Les 14 exports de profils recuperes entrent dans l'adaptateur v4. Onze ont
une arme et se simulent directement; trois restent conserves mais exigent
seulement la donnee d'arme manquante. Aucun utilisateur ne doit ressaisir
son profil entier.

Ce lot ne couvre pas la guerre de guilde: l'APK indique une duree de 120 s
et un scaling melee `2.6`, mais ce mode doit avoir un contrat et des tests
propres avant d'etre annonce comme pris en charge. L'API, le front et le BIS
v4 ne sont pas encore branches au verdict PvP.
