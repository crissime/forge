# Calculateur BIS v4: plan et prompt de mission

Date: 2026-09-17. Responsable: Vega. Coordination: Milo.
Statut: cadrage pret; implementation et generation non lancees par ce document.

## 1. Objectif et decisions

Produire des builds de reference accessibles, calcules hors ligne, reproductibles
et reutilisables par la future API et le front. Un BIS de reference ne depend pas
du stuff actuel du joueur: a contexte et conditions d'acces identiques, le
resultat est identique. La recommandation personnalisee est un chantier distinct.

- Le moteur officiel decide du resultat du combat. Le BIS cherche et classe;
  il ne contient aucune autre formule de combat ni regle de passage.
- Ne pas modifier la v2/v3, ses donnees generees ou les profils recuperes.
- Aucun utilisateur ne doit recreer son profil. L'adaptation reste non destructive.
- Livrer par petits lots. Pas de generation de tous les ages au premier lancement.
- Premier perimetre: un cas PvE, un combat cible, un budget borne. Ce resultat
  est un meilleur build trouve pour ce cas, pas un BIS universel.
- Les fees font partie du perimetre indispensable du BIS 2.9.0, pas d'une
  extension facultative: elles changent la valeur des statistiques et donc les
  builds retenus. Aucun ancien classement ne peut etre reconduit sans recalcul.
- PvP ensuite, contre un adversaire ou un panel explicitement fige. Utiliser
  `evaluatePvpVerdict` et son `winner`, pas un faux champ `passed`.
- Donjon seulement apres disponibilite de son moteur. API et front hors premier lot.

## 2. Etat reel et sources a lire

Les chemins des packages ci-dessous priment sur l'arborescence conceptuelle
ancienne de `v4/architecture.md`.

| Source | Ce qu'elle apporte |
| --- | --- |
| `v4/README.md`, `v4/equipe.md` | Objectif, contraintes et responsabilites |
| `packages/v4-core/src/index.ts` | `evaluateCombatVerdict`, `evaluatePvpVerdict`, types et adaptation des profils |
| `packages/v4-core/src/combat-profile.ts` | Conversion des totaux d'un profil en statistiques de combat |
| `packages/v4-core/src/stat-resolver.ts` | Resolution commune des contributions de statistiques |
| `packages/v4-game-data/src/index.ts` | Chargement versionne; 2.8.2 reste la version active |
| `v4/simulateur.md`, `v4/pvp.md` | Contrats, limites et hypotheses du moteur |
| `v4/analyse-xapk-2.9.0.md`, `v4/fees-2.9.0.md` | Candidat 2.9.0, reflexion, formule des fees et provenance des coefficients |
| `v4/procedure-mise-a-jour.md` | Gestion des changements de version |
| `crda/2026-07-08-basile-compte-rendu-activite.md`, section BIS | Definition du BIS independant du profil et conditions d'acces |
| `crda/2026-07-08-ariane-forge-master.md`, decisions BIS | Niveaux de reference, doublons de pets et limites de l'ancienne recherche |
| `scripts/generate-simulated-bis.mjs` | Retour d'experience uniquement: budgets, reprise, cout des recherches |

Le noyau sait simuler un profil avec `base.attack`, `base.health` et `stats`
deja renseignes. `adaptProfileToV4` reconnait les formats existants; il ne
reconstruit pas tous les bonus d'un nouvel equipement. Changer des identifiants
en conservant les anciens totaux ne constitue donc pas un candidat BIS valide.

La validation en jeu reste a faire. La formule des fees est documentee, mais
leurs coefficients de saison sont une transcription communautaire et leur
integration au moteur reste a faire. Le snapshot 2.9.0 n'est pas la version active.

## 3. Contrat du cas de recherche

Un cas fige explicitement:

- version du jeu, hashes des donnees, configuration de saison et son niveau de confiance;
- age et niveau d'equipement, raretes autorisees, nombre de lignes secondaires,
  valeurs legales par ligne, emplacements et regles de cumul;
- objets, pets, montures et sorts accessibles, avec leur ordre si celui-ci a un effet;
- pets, monture et sorts niveau 1 pour le BIS de reference, conformement au cadrage
  existant; un autre niveau definit un autre cas;
- talents fixes, hors espace de recherche; autres bonus permanents fixes et traces;
- etat de l'evenement fee, selection autorisee et niveau: ne pas supposer que
  le niveau 1 des compagnons s'applique automatiquement aux fees;
- cible PvE `{age, combat, difficulty}`, horizon de combat et politique des sorts;
- `blockMode`, seed ou liste de seeds, objectif de classement et budget de recherche.

Les doublons de pets ne sont pas interdits artificiellement. Les limites
d'emplacements et autres regles doivent toutefois provenir des donnees verifiees.
Une rarete autorisee, un deblocage ou une valeur secondaire inconnus ne deviennent
pas silencieusement une autorisation. Distinguer contrainte utilisateur,
regle du jeu verifiee et hypothese du scenario.

Pour les fees, couvrir Mira, Tira et Lora selon les deblocages et les regles
de selection verifiees. Si le cas impose une fee, la figer explicitement;
sinon inclure les choix autorises dans la recherche, a niveaux accessibles
declares. Ne pas supposer qu'elles se cumulent ou qu'elles sont toutes au niveau 20.

Le bonus de fee est recalcule pour CHAQUE candidat depuis ses statistiques
secondaires agregees, avant la simulation. Ne jamais choisir un build sans fee
puis lui ajouter une fee a la fin. Mira depend des degats de competence, Tira
de la reduction de recharge et Lora du bonus de vie: leurs paliers peuvent
inverser un classement. Les valeurs et plafonds viennent de la configuration
de saison tracee, pas de constantes dispersees dans l'optimiseur.

Decision utilisateur du 2026-09-22 pour le BIS de reference 2.9.0: comparer
une seule fee active, Mira, Tira ou Lora, au niveau 20. Les valeurs sont donc
Mira +20 critique par palier de 15% de degats de competence (cap 80%), Tira
+5 blocage par palier de 1% de reduction de recharge (cap 30%), et Lora +15
reflexion par palier de 10% de sante (cap 30%). Les skins et leurs sets sont
exclus du scenario de reference comme bonus aleatoires hors statistiques.

Ne pas reprendre les anciens filtres tels que suppression de `rangedDamage`,
monture canonique unique ou exclusion d'une statistique sans une autre comme
des lois du jeu. Une restriction heuristique reduit l'espace explore et doit
etre declaree. Ne pas reprendre non plus l'ancien modele de degats additif.

## 4. Plan par lots

### Lot 0 - Fermer les prerequis

Vega inventorie les champs necessaires et prepare un cas pilote a partir de
donnees disponibles, sans deduire un build de reference du stuff d'un utilisateur.
Tess verifie le chemin de calcul des statistiques; Oren les catalogues et leur
provenance. Noor intervient seulement si la compatibilite des profils est concernee.

Livrable: un cas explicite, une liste courte des manques bloquants et le contrat
du constructeur de candidat. Ne pas inventer de valeurs pour rendre le cas executable.

La 2.8.2 peut servir de banc technique. Pour la 2.9.0, autoriser seulement des
essais etiquetes experimentaux tant que les donnees pertinentes et les fees
ne sont pas integrees et validees. Un scenario sans fee est explicitement sans
fee, jamais presente comme un BIS complet de la saison. Aucun basculement de
version active ni publication de reference 2.9.0 implicites.

Ordre obligatoire pour le premier BIS 2.9.0: Oren fige la configuration candidate
des trois fees et ses preuves; Tess implemente les conversions/plafonds dans
le calcul partage; Vega explore les builds avec ces effets actifs. Les essais
techniques 2.8.2 ne remplacent pas cette livraison. Si les coefficients restent
non confirmes en jeu, le resultat reste experimental, meme si les tests passent.

### Lot 1 - Construire un candidat fiable

Tess porte le calcul partage dans le noyau v4, avec les tables preparees par Oren.
Vega fournit la selection de build et les contraintes, pas des formules paralleles.

Le constructeur recalcule les bases et toutes les contributions applicables:
equipement, lignes secondaires, pets, monture, talents fixes, sets et fees selon
le perimetre. Il distingue totaux bruts et effets plafonnes, preserve les arrondis
du moteur, et evite tout double comptage des bonus deja inclus dans un profil.
Une contribution necessaire non prise en charge bloque le candidat.

Acceptance: changer un composant produit les totaux attendus sur des fixtures
calculees independamment; les seuils/plafonds sont testes; le profil source ne
change pas. Les champs absents d'un ancien profil restent diagnostiques sans
demander une recreation de compte ou de profil.

### Lot 2 - Chercher sur un seul cas PvE

Creer un package independant `packages/v4-bis/` et une petite entree CLI dediee
sous `v4/tools/`, sans remplacer le generateur historique. Ces chemins sont a creer.

Commencer par une enumeration exhaustive d'un petit espace legal, utilisable
comme oracle de test. Pour un espace reel trop grand, ajouter seulement ensuite
une recherche bornee, par exemple selection initiale puis substitutions locales.
Mesurer avant d'ajouter beam search, workers ou une nouvelle dependance.

Chaque candidat suit le meme chemin:

```text
contraintes -> build legal -> statistiques recalculees -> profil v4
            -> evaluateCombatVerdict -> classement -> resultat trace
```

En 2.9.0, `build legal` inclut le choix de fee autorise et `statistiques
recalculees` inclut ses conversions et plafonds pour ce candidat precis.
Une recherche heuristique doit explorer autour des paliers de fee; ne pas
eliminer un axe de statistiques parce qu'il etait faible dans un build sans fee.

Budget initial propose: un cas, un processus, 200 evaluations officielles maximum
et 60 secondes de temps mural. Les limites sont configurables; ce sont des
protections de lancement, pas une promesse de trouver un bon build. Un arret
temporel peut changer la couverture: il est indique comme interruption.

Classement initial propose pour une cible donnee: passages avant echecs valides;
entre passages, temps croissant puis vie restante relative decroissante; entre
echecs, vagues nettoyees decroissantes puis degats infliges decroissants. Une cle
canonique de build departage les egalites. Cette politique est versionnee, pas
presentee comme une definition universelle du meilleur build.

`invalid_input` et `missing_data` sont des diagnostics, jamais des defaites a
classer. Le meilleur echec reste un echec. Dire "aucun passage trouve" et non
"impossible" lorsque l'espace n'est pas exhaustif. Une approximation de score
ou un taux de victoire ne peut jamais transformer `passed: false` en succes.

### Lot 3 - Reprise et sortie reutilisable

Ajouter la reprise seulement apres validation du cas pilote. Ecrire dans un
repertoire dedie, par exemple `v4/generated/bis/`, sans ecraser les BIS historiques.

Conserver pour chaque resultat:

- contexte complet, contraintes, hypotheses et provenance;
- build retenu, profil effectivement simule et verdict officiel complet;
- versions/hashes du moteur, constructeur de candidat, donnees et politique de recherche;
- candidats explores, rejetes et invalides, taille de l'espace si connue,
  recherche exhaustive ou heuristique, budget et motif d'arret;
- etat de recherche distinct du resultat de combat et du statut experimental.

La cle du cache/checkpoint couvre tous les inputs utiles: cible, options, seeds,
contraintes, niveaux, talents, saison, donnees et implementation effective.
Un numero de version seul ne suffit pas si le code a change sans release.
Refuser une reprise incompatible. Reprendre dans un ordre deterministe; une
reprise vers le meme budget total d'evaluations doit retrouver le meme resultat
qu'un calcul continu, hors arret temporel. Ecriture atomique du resultat final.

Rejouer le gagnant avec exactement ses inputs avant publication. Ne jamais
publier un artefact incomplet sous l'etiquette "calcule integralement".

### Lot 4 - Etendre apres mesure

Mesurer duree et couverture sur quelques cas representatifs avant d'etendre aux
ages/raretes. Ne pas supposer la progression monotone pour une recherche binaire
du dernier combat passant. Tout combat annonce passe doit avoir son verdict.

PvP: figer adversaires, niveaux, roles et seeds; conserver chaque `PvpVerdict`.
Un classement sur un panel n'est pas un BIS PvP universel. Les distributions RNG
restent une mesure distincte, sans nouvelle regle implicite de victoire.
Noor puis Lina branchent ensuite l'artefact, sans refaire les calculs.

## 5. Tests qui conditionnent la livraison

- Meme cas et meme budget d'evaluations: meme build et meme verdict.
- Verdict stocke identique a l'appel direct du moteur sur le profil stocke.
- Oracle exhaustif minuscule: classement et gagnant attendus; ne pas exiger
  qu'une heuristique trouve toujours l'optimum, mais mesurer ses ecarts.
- Accessibilite: deblocages, lignes secondaires, niveaux et doublons de pets.
- Reconstruction des bases et bonus, precision numerique, caps et seuils de fees.
- Pour chacune de Mira/Tira/Lora: juste sous un palier, au palier et au-dessus;
  niveau 1 et niveau maximal confirme; total cible deja au plafond ou au-dessus;
  bonus des pets/monture inclus; absence de double comptage. Ajouter une fixture
  ou le classement change avec la fee, pour detecter une optimisation sans fee.
- Espace vide, tous les candidats invalides, meilleur echec, timeout de combat
  et interruption de recherche distingues.
- Mutation des profils interdite; replay des profils historiques sans recreation.
- Resume valide equivalent au continu; changement de saison, donnees, moteur,
  options ou contraintes invalide le checkpoint.
- Donnees necessaires manquantes: diagnostic; aucune omission silencieuse de fee.

Utiliser des tests cibles et les commandes directes TypeScript/Vitest du repo.
Ne pas lancer `npm run build` ou `npm run bis:generate`: ces commandes declenchent
encore la generation BIS historique. Aucun benchmark massif sans accord de Milo.

## 6. Transmission a l'equipe

| Destinataire | Informations et ordre de passage |
| --- | --- |
| Vega | Document complet et prompt ci-dessous; proprietaire du calculateur, commence au lot 0 |
| Tess | Sections 2 a 5: contrat de profil, constructeur de statistiques partage, verdict et tests; intervient avant l'optimisation |
| Oren | Sections 2 a 4: catalogues legaux, valeurs secondaires, niveaux, sets et configuration de saison des fees; liste source/confiance/manques |
| Noor | Contrainte de conservation des profils et futur format de sortie; sollicite si adaptation necessaire, API apres contrat stable |
| Lina | BIS de reference distinct du conseil personnalise, hypotheses et statut de recherche visibles; front apres contrat stable |
| Milo | Arbitre les inconnues, valide le cas pilote et autorise les extensions couteuses |

Pas de membre supplementaire necessaire a ce stade. Vega ne modifie pas les
modules appartenant a Tess/Oren/Noor en parallele sans coordination.

## 7. Prompt de mission a transmettre a Vega

```text
Tu es Vega, responsable BIS de Forge Master Simulator v4. Milo coordonne;
Tess porte le moteur, Oren les donnees, Noor les profils/API et Lina l'UX.

La v4 remplace un systeme dont les verdicts et chemins de calcul divergeaient.
Objectif: un calculateur BIS accessible, fiable, efficace, reproductible.
Un BIS de reference est independant du stuff actuel du joueur. Les utilisateurs
existants ne doivent jamais recreer leur profil. Ne modifie pas la v2/v3.

Lis v4/plan-calculateur-bis.md, puis les sources ciblees de sa section 2.
Les packages/v4-core et packages/v4-game-data sont les references executables;
le generateur BIS historique est seulement un retour d'experience.
Ne suppose pas qu'adaptProfileToV4 recalcule les bonus: ce n'est pas le cas.
Le moteur recoit actuellement des totaux deja prepares. La reconstruction des
statistiques d'un candidat est un prerequis, a cadrer avec Tess et Oren.

2.8.2 reste active. La 2.9.0 est candidate; les fees ne sont pas encore integrees,
et leurs coefficients sont communautaires, pas confirmes par nos tests en jeu.
Ne publie aucun BIS 2.9.0 complet en ignorant ces limites.
Mira, Tira et Lora font partie du coeur de la recherche: chaque candidat doit
recalculer leurs bonus a partir de ses propres statistiques, avec paliers,
niveaux accessibles, plafonds et saison. Compare les selections autorisees,
sauf si le cas en impose une. Ne les ajoute jamais apres avoir choisi le build.
Le lot 0 doit inclure ce prerequis pour les trois fees avec Tess et Oren.

Ta premiere mission est uniquement le lot 0: verifier les prerequis, proposer
un cas PvE pilote entierement explicite, definir les entrees/sorties minimales
et relever les manques bloquants avec leur destinataire. Distingue fait verifie,
hypothese et proposition. Tu peux produire une note de cadrage dans v4/;
ne code pas encore le calculateur, ne lance aucune generation longue et ne
modifie pas le moteur. Attends le feu vert de Milo avant les lots suivants.

Pour la suite, conserve ces garde-fous: candidats legaux, pets/monture/sorts
niveau 1 en reference, talents fixes, doublons de pets autorises selon les
regles; evaluateCombatVerdict est le seul juge du passage. Stocke le verdict
exact et ses inputs. Meilleur build trouve ne signifie pas optimum prouve.
Le PvP est une extension avec son propre verdict et un panel explicite.

Retour attendu court: prerequis disponibles/manquants, cas pilote propose,
contrat minimal, demandes precises a Tess/Oren/Noor, prochain lot et cout estime.
Pas de refonte generale, pas de nouvelle dependance sans besoin demontre.
```
