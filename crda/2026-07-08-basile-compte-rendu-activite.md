# Compte rendu d'activite - Basile

Date: 2026-07-08  
Nom choisi: Basile  
Depot local: `C:\Users\jekte\OneDrive\Documents\forge master`  
Branche observee: `test`  
Objectif du document: donner assez de contexte pour reprendre le sujet sans relire tout le fil.

## Resume court

Le projet Forge Master Simulator a beaucoup evolue depuis une app simple vers une V2/V3 plus structuree:

- front React/Vite expose publiquement;
- API Fastify privee derriere le front;
- Postgres/Prisma pour comptes, sessions et profils;
- moteur de simulation pur dans `packages/simulator`;
- donnees de jeu normalisees dans `packages/game-data`;
- UX refaite autour de build, comparaison, PvP, simulation, talents et BIS;
- generateur BIS local dans `scripts/generate-simulated-bis.mjs`;
- manifests Kubernetes dans `k8s`.

Le point le plus sensible actuellement: le simulateur V3 et le generateur BIS sont utiles mais encore discutables sur le fond. Les hypotheses de gameplay ne sont pas assez verifiees pour faire confiance aveuglement aux recommandations, surtout autour de `Skill Damage`, regeneration sante, sorts, pets, montures et choix BIS.

## Etat Git vu au moment du compte rendu

Commande observee:

```text
git status --short --branch
```

Etat:

```text
## test...origin/test
?? crda/
?? simulatedBis.json
?? simulatedBis.v3-new.json
?? tmp/
?? v4/
```

Derniers commits vus:

```text
0370ef6 simplify v3 build and simulation UX
13d6dee preserve zero secondary lines in compare
a598b8c add reach bis objective
320fa8e serve bis data outside web bundle
0c829e5 set bis companion levels to one
```

Important:

- `crda/` contient deja plusieurs comptes rendus.
- `simulatedBis.json` et `simulatedBis.v3-new.json` sont non suivis. Ne pas les supprimer sans verifier leur role.
- `tmp/` contient probablement des artefacts de generation/test.
- `v4/` contient des notes de cadrage pour repartir plus proprement.

## Fichiers d'entree importants

Racine:

- `package.json`: scripts principaux, workspaces, Node >= 20.
- `docker-compose.yml`: stack locale.
- `prisma/schema.prisma`: schema DB.
- `scripts/generate-simulated-bis.mjs`: generation BIS locale.
- `simulatedBis.json`: artefact BIS non suivi a verifier.
- `simulatedBis.v3-new.json`: ancien artefact BIS non suivi a verifier.

Apps:

- `apps/web/src/App.tsx`: routing front.
- `apps/web/src/features/shell/Shell.tsx`: navigation.
- `apps/web/src/features/build/BuildPage.tsx`: edition du profil/build.
- `apps/web/src/features/compare/ComparePage.tsx`: comparaison de drops.
- `apps/web/src/features/pvp/PvpPage.tsx`: PvP.
- `apps/web/src/features/simulation/SimulationPage.tsx`: simulation/recommandations.
- `apps/web/src/features/simulation/BisPage.tsx`: page BIS separee.
- `apps/web/src/features/talents/TalentsPage.tsx`: arbre de talents.
- `apps/web/src/features/shared/NumericInput.tsx`: champ numerique important, support `.` et suffixes `k/m`.
- `apps/web/src/features/shared/gameData.ts`: resolution objets, pets, montures.
- `apps/web/src/store/workshop.ts`: profil local, sauvegarde, mutations.

Packages:

- `packages/simulator/src/index.ts`: moteur de simulation, scenarios, PvP, recommandations.
- `packages/simulator/test/simulator.test.ts`: tests moteur.
- `packages/simulator/test/bis-generator.test.ts`: tests generateur BIS.
- `packages/game-data/src/index.ts`: normalisation et exposition des donnees de jeu.
- `packages/game-data/scripts/update-game-data.ts`: recuperation/manifest des JSON.
- `packages/game-data/curated/SkillMechanics.json`: mecanique manuelle des sorts.

Infra:

- `apps/api/src/server.ts`: API Fastify.
- `k8s/web.yaml`: web public + proxy API.
- `k8s/api.yaml`: API interne.
- `k8s/postgres.yaml`: Postgres.
- `k8s/bis-data.yaml`: volume/config BIS.
- `k8s/kustomization.yaml`: a appliquer avec `kubectl apply -k`, pas `kubectl apply -f`.

Docs deja presentes:

- `docs/00-index.md`
- `docs/game-overview.md`
- `docs/stats-and-builds.md`
- `docs/simulator-context.md`
- `docs/sources.md`
- `v4/*.md` si le dossier est conserve

## Commandes utiles

Developpement:

```text
npm run dev:web
npm run dev:api
```

Build complet:

```text
npm run build
```

Tests:

```text
npm run test
```

Verification globale:

```text
npm run check
```

Mise a jour donnees de jeu:

```text
npm run game-data:update
```

Generation BIS:

```text
npm run bis:generate
```

Kubernetes:

```text
kubectl -n forge apply -k k8s
```

A eviter:

```text
kubectl -n forge apply -f k8s
```

Raison: `kustomization.yaml` n'est pas une ressource Kubernetes standard a appliquer avec `-f`; c'est une entree Kustomize.

## Historique fonctionnel du travail

### V2 architecture

Une architecture plus propre a ete mise en place ou preparee:

- `apps/web`: React/Vite, front public.
- `apps/api`: Fastify, API privee.
- `packages/simulator`: moteur pur/testable.
- `packages/game-data`: donnees JSON normalisees.
- `prisma`: schema et migrations Postgres.
- `k8s`: deploiement web/api/postgres.

Principe conserve: le front est expose, l'API reste derriere le front/proxy et ne doit pas avoir d'ingress public separe.

### Donnees

Les donnees communautaires sont utilisees comme JSON de reference, pas comme code copie.

Points traites ou a conserver:

- versionner les donnees de jeu;
- garder source, date et hash;
- ajouter/maintenir une page ou doc "Sources / donnees utilisees";
- ne pas copier composants, styles ou logique depuis `1vcian/fm`;
- accepter l'import/export compatible sans rendre l'import prioritaire.

Un point precis a ete corrige: le catalogue pets devait utiliser les vrais noms via `ManualSpriteMapping.json` et ne plus filtrer par specialisation avant le choix du pet.

Correspondance pet attendue:

- Common: Chicken, Dog, Cat, Snail, Mouse, Turtle.
- Rare: Hedgehog, Bear, Ostrich, Spider, Scorpion.
- Epic: Griffin, Saber Tooth, Unicorn, Tiger, Panda.
- Legendary: Serpent, Cerberus, Kitsune.
- Ultimate: Electry, Treant, Enchanted Elk.
- Mythic: Baby Dragon, Genie, Spectral Tiger.

Le meme besoin existe cote montures: remplacer les modeles generiques par les vrais noms.

### Profil et sauvegarde

Objectif produit:

- edition manuelle prioritaire;
- import comme option secondaire;
- export de profil;
- sauvegarde locale invite;
- synchro serveur apres connexion.

Problemes qui ont ete remontes:

- changement de PC sans retrouver les stats;
- creation/connexion de compte a verifier;
- bouton connexion invisible sur mobile;
- sessions/cookies/DB a surveiller.

Ce qu'il faut garder en tete:

- si le profil n'est pas lie a un compte ou pas pousse cote API, le changement de PC ne peut pas fonctionner;
- les sessions doivent etre en cookie `HttpOnly`, `Secure` en prod;
- verifier le flux complet register/login/session/profile save/load avec Postgres.

### UX front

Le front a ete fortement remanie parce que l'ancien ressenti etait "formulaire Google", trop complique et pas assez joueur.

Principes retenus:

- moins de gros formulaires;
- cartes orientees action;
- resume clair avant detail;
- details de calcul caches par defaut;
- mobile utilisable sans zoom;
- navigation claire vers Build, Simuler, PvP, Comparer, Talents, BIS;
- BIS moins mis en avant que recommandations, car BIS vise surtout les tryharders.

Pages principales:

- Accueil/profil/build: remplir le profil sans dependance obligatoire a l'import.
- Audit: ne pas afficher toutes les stats a 0.
- Recommandations/simulation: donner les prochaines priorites.
- Comparateur: drop contre equipe, avec bouton "equiper" apres comparaison.
- PvP: mode resume avec attaque totale, PV total, stats secondaires et sorts.
- Talents: vrai arbre inspire RPG, mais lisible sans zoom.

### Objets

Decision importante:

- un objet a soit attaque soit PV;
- exception: arme, qui peut avoir attaque et parfois PV selon le type;
- le joueur renseigne surtout age, type utile et niveau;
- les valeurs attaque/PV sont reconstruites depuis les donnees de jeu;
- les lignes secondaires restent renseignables en pourcentage.

Details UX:

- age objet en derouleur avec noms, pas numero brut;
- `idx` ne doit pas etre demande partout si cela ne change que l'apparence;
- exception: arme, ou melee/distant/hybride change les valeurs;
- niveau objet ne doit pas etre bloque artificiellement a 98 si le jeu accepte plus;
- les champs doivent accepter `.` et suffixes `k/m`.

### Pets et montures

Objectif UX:

- choisir rarete;
- choisir le pet/monture par son vrai nom;
- indiquer niveau;
- indiquer lignes secondaires;
- calculer attaque/PV depuis donnees;
- deduire le type automatiquement pour les pets.

Pour les pets:

- supprimer le choix manuel "specialisation";
- afficher le type en lecture seule: Equilibre, Degats, PV;
- comparer un drop pet contre tous les pets possibles;
- afficher le bouton "equiper" apres comparaison;
- compatibilite anciens profils contenant `Pet 1`.

Pour les montures:

- meme logique de noms officiels a appliquer/maintenir.

### Talents

Une page talents existe, mais il y a eu un retour fort:

- page initialement difficile a trouver;
- UX trop compliquee et necessitant de zoomer;
- besoin d'un vrai arbre lisible.

Modele cible:

- 3 onglets: Forge, Puissance, Competence/Animaux/Tech;
- chaque talent = case;
- niveau 1 a 5 ou 1 seul selon talent;
- prerequisites bloquants comme un RPG;
- profil importe modifiable ensuite;
- talents pris en compte dans recommandations et simulation.

### Sorts

Les sorts sont cruciaux, surtout parce que beaucoup sont multicibles.

Comprehension actuelle:

- sorts de buff: degats et/ou PV;
- sorts de degat instantane;
- sorts a petits degats multiples;
- rarete et niveau des sorts doivent impacter les recommandations/BIS;
- `Skill Damage` peut etre game changer quand un nouveau palier de sort est debloque;
- `Damage + Skill Damage` semble additif pour les sorts, d'apres le test utilisateur sur Epines.

Test utilisateur donne:

```text
Sans bonus: 30.6k
Damage 14%: 35k
Skill Damage 15.3%: 35.5k
Les deux: 39.7k
Sort teste: Epines
```

Conclusion actuelle:

- pour les sorts, `Damage` et `Skill Damage` sont probablement dans le meme bucket additif;
- il faut garder cette hypothese testable, pas la presenter comme verite absolue.

## Comprehension gameplay actuelle

### Stats secondaires a connaitre

Liste generale manipulee par le projet:

- Damage: bonus degats global.
- Melee Damage: bonus degats arme melee.
- Ranged Damage: bonus degats arme distance.
- Skill Damage: bonus degats des sorts.
- Attack Speed: vitesse d'attaque arme.
- Critical Chance: chance de critique.
- Critical Damage: multiplicateur/bonus de critique.
- Double Chance: chance de tirer/frapper une deuxieme fois.
- Health: bonus PV.
- Health Regen: regeneration sante, formule exacte inconnue.
- Lifesteal: vol de vie, uniquement arme selon retour utilisateur.
- Block: chance de bloquer totalement un coup.
- possiblement autres stats selon mapping complet dans `STAT_ID_MAP`.

Points confirmes par retour utilisateur:

- Lifesteal seulement sur l'arme.
- Double Chance peut crit, car c'est un tir/coup normal en plus.
- Block = chance de bloquer 100% d'un coup.
- Certains niveaux ont mobs melee, d'autres distance, d'autres mixtes.

Points incertains:

- regeneration sante: tick, frequence, scaling exact.
- interaction `Damage` + `Melee/Ranged Damage`: supposee additive maintenant.
- interaction `Damage` + `Skill Damage`: supposee additive pour les sorts.
- poids reel de `Skill Damage` quand les sorts mythiques sont accessibles.

### Sources de puissance

La puissance vient de:

- attaque/PV de base des objets;
- attaque/PV des pets;
- attaque/PV de la monture;
- lignes secondaires des objets/pets/monture;
- sorts equipes;
- talents;
- rarete/niveau du contenu accessible;
- type de mobs du niveau vise;
- PvP multipliers/configs.

Impacts attendus:

- objets: grosse base attaque/PV, lignes secondaires par slot;
- arme: source speciale, peut influer sur lifesteal et type melee/ranged;
- pets/monture: apportent attaque/PV et jusqu'a deux lignes selon rarete;
- sorts: apportent burst, multi-hit, multi-target ou buffs;
- talents: modifient des bases, sorts, passifs et stats globales;
- stats secondaires: changent DPS, sustain, mitigation, PV effectifs.

## Simulateur V3

La tranche V3 demandee visait le realisme combat sans refaire toute l'architecture.

Changements conceptuels:

- `Damage + Melee/Ranged Damage` additifs dans le meme bucket arme.
- `Attack Speed`, `Double Chance` et critique restent multiplicateurs separes.
- `Damage + Skill Damage` additifs pour les sorts.
- Lifesteal base uniquement sur DPS arme.
- Block en RNG seedee, chance de bloquer 100% d'un coup.
- Defaut demande: 64 trials, seed fixe, score moyenne, succes majorite.
- Mobs resolus depuis donnees ennemis/armes quand possible.
- Resultats exposent mode melee/ranged/mixed.

Metriques V3 attendues:

- `trials`
- `successRate`
- `blockRate`
- `enemyMode`
- `meleeEnemyCount`
- `rangedEnemyCount`
- `meleeDps`
- `rangedDps`

Tests attendus:

- `Damage 14% + Ranged 15%` donne `1.29`, pas `1.14 * 1.15`.
- `Damage + Skill Damage` additif sur sort de degats.
- `Double Chance` conserve la possibilite de crit.
- `Block 100%` bloque les degats entrants.
- `Block 0%` garde comportement sans blocage.
- `Block 50%` stable avec seed fixe et moyenne proche de 50%.
- PvP miroir proche de 50%.
- Scenarios melee/distance/mixte exposent les bonnes metriques.
- Recommandations triees, stables, sans doublons contradictoires.

Limite actuelle:

- ce n'est pas une simulation frame-by-frame;
- le modele reste hybride;
- les hypotheses doivent etre validees par tests in-game ou donnees plus fiables.

## Scenarios de simulation

Idee utilisateur retenue:

- mob intuable avec degats progressifs: mesurer temps de survie;
- mob avec peu de degats et vie adaptee: mesurer temps pour tuer;
- plusieurs mobs avec vie/degats variables: enchainer des simulations.

Le niveau de simulation doit etre adapte au niveau de jeu vise, mais attention:

- age des objets et age des niveaux ne sont pas la meme chose;
- niveaux de jeu: de 1 a 11, 20 batailles par niveau, puis Difficile 1 a Difficile 11;
- exemple `8-15` signifie age/niveau de jeu 8, combat 15, pas objet age 8;
- il ne faut pas demander au joueur de remplir PV/DPS mob a la main si les donnees peuvent etre approximees depuis configs.

## Recommandations

Objectif:

- tester les changements de stat possibles sur une ligne;
- proposer ce qui aide vraiment le joueur a passer le niveau vise;
- eviter les recommandations contradictoires.

Problemes deja observes:

- Top 3 disait de chercher `Lifesteal`.
- Suite des recommandations disait de garder/chercher `Attack Speed`.
- Cela donne une contradiction UX meme si techniquement deux objectifs/scenarios differents peuvent l'expliquer.

Regle produit:

- une recommandation doit dire pourquoi elle gagne;
- si deux stats gagnent dans deux scenarios differents, l'UI doit le formuler;
- sinon il faut dedoublonner et trier par objectif prioritaire.

Points de vigilance:

- ne pas proposer L2 sous Quantique pour objets si elle n'existe pas;
- ne pas proposer L2 sous Legendaire pour pets/montures si elle n'existe pas;
- remettre les recommandations de skills/sorts;
- inclure pets/montures/sorts dans l'evaluation BIS/reco.

## BIS

Le BIS actuel est un sujet sensible.

Definition utilisateur:

- un vrai BIS ne depend pas du stuff actuel du joueur;
- il doit etre identique pour tout le monde a conditions d'acces egales;
- on le simule une fois pour chaque cas;
- ensuite on le met en dur/statique pour le front.

Conditions d'acces a prendre en compte:

- age/niveau equipement accessible;
- rarete pet accessible;
- rarete monture accessible;
- rarete sort accessible;
- nombre de lignes secondaires disponibles;
- niveau de jeu vise.

Problemes/doutes actuels:

- les premiers BIS etaient trop lies au profil courant;
- les pets/montures n'etaient pas assez pris en compte;
- les sorts n'etaient pas assez pris en compte;
- `Skill Damage` peut etre sous-valorise au moment ou un nouveau tier de sort est debloque;
- `Health Regen` peut etre sous-valorisee alors qu'elle est tres forte en sustain;
- `Ranged Damage` peut apparaitre alors qu'il n'est pas forcement meilleur que `Damage`;
- la question "12 lignes max contre niveau 8-1 normal" reste a clarifier.

Etat technique:

- `scripts/generate-simulated-bis.mjs` gere la generation locale.
- `npm run bis:generate` build game-data/simulator puis genere.
- Des artefacts BIS existent a la racine mais sont non suivis.
- Il y a eu une option/objective `reach` pour choisir le build qui va le plus loin en progression reelle.
- La page BIS a ete separee de la page Simuler.

Position prudente:

- ne pas pousser un BIS comme verite definitive tant que le simulateur V3 n'est pas stabilise;
- marquer le BIS comme "simule" ou "experimental" si affiche;
- garder les recommandations joueur plus visibles que le BIS.

## PvP

Demandes utilisateur:

- remplir a la main facilement;
- mode resume;
- champs: attaque totale, PV total, sorts, stats secondaires;
- meme niveau de modele que PvE autant que possible.

Points a verifier:

- toutes les stats secondaires doivent etre disponibles;
- les sorts doivent etre pris en compte;
- profils importes et profils manuels doivent marcher;
- PvP miroir doit rester autour de 50%;
- les multiplicateurs/configs PvP doivent etre explicables.

## Auth, prod et infra

Incidents/remontees:

- creation/connexion de compte suspecte;
- sauvegarde ne fonctionne pas entre PC;
- prod crashee apres coupure de courant;
- probleme de connexion DB;
- certificat HTTPS invalide.

Ce qui a ete fait dans le fil semble avoir debloque la prod/certificat, mais il faut verifier l'etat reel du cluster avant nouvelle livraison.

Checklist reprise prod:

- `kubectl -n forge get pods`
- `kubectl -n forge logs deploy/forge-master-api`
- `kubectl -n forge logs deploy/forge-master-web`
- `kubectl -n forge get ingress`
- verifier secret API `DATABASE_URL`
- verifier secret Postgres
- verifier certificat/ingress controller/cert-manager si utilise
- tester `/api/session` via le front

## Reverse engineering

Sujet discute mais reporte.

Position:

- recuperer de vraies stats serait utile;
- ne pas casser le jeu, ne pas contourner protections, ne pas automatiser de triche;
- l'option propre est d'exploiter des fichiers de config publics/accessibles, APK si legalement acceptable, exports, captures de tests manuels;
- ne pas depenser de gros budget token tant que le simulateur/front local n'est pas stabilise.

Si repris plus tard, il faudra:

- APK ou dump des fichiers configs accessibles;
- version exacte du jeu;
- liste precise des valeurs recherchees;
- cadrage legal/ethique clair;
- espace de travail separe pour ne pas polluer ce repo.

## Ce qui est fiable

Je considere plutot fiable:

- la structure monorepo `apps/*` + `packages/*`;
- le principe front public + API privee + Postgres;
- la separation moteur pur / UI;
- l'idee de champs numeriques acceptant `.` et `k/m`;
- la resolution automatique des valeurs objets/pets/monture depuis les donnees;
- la navigation separee Build / Simuler / PvP / Comparer / Talents / BIS;
- le besoin de sources et hashes pour donnees.

## Ce qui reste fragile

Je considere fragile:

- la formule exacte regen sante;
- le poids reel de `Skill Damage`;
- le modele exact des sorts multicibles/multi-hit;
- l'equilibre des recommandations;
- le BIS simule;
- le mapping complet des montures par vrai nom si pas finalise;
- la synchro profil compte/serveur;
- la prod si DB/cert/ingress ne sont pas surveilles.

## Reprise conseillee

Si quelqu'un reprend demain, ordre minimal:

1. Lancer tests et build:

```text
npm run test
npm run build
```

2. Verifier les artefacts non suivis:

```text
git status --short
```

3. Lire:

```text
docs/00-index.md
docs/simulator-context.md
docs/stats-and-builds.md
crda/2026-07-08-eline-compte-rendu-forge-master.md
crda/2026-07-08-juno-compte-rendu-v3-front.md
```

4. Tester manuellement le front:

- build/profile;
- pet/monture;
- talents;
- simulation;
- recommandations;
- BIS;
- PvP;
- login/register/save/load.

5. Ne pas recalculer/committer BIS avant d'avoir decide:

- objectif exact;
- niveaux de sorts;
- niveaux pets/monture;
- raretes accessibles;
- nombre de lignes;
- traitement regen/skill damage.

## Prochaine decision importante

Deux chemins possibles:

- continuer a patcher V3;
- repartir proprement sur une V4 specifiee, avec modele de combat ecrit noir sur blanc avant UI.

Mon avis de Basile: ne pas tout refaire tout de suite. D'abord ecrire une spec courte du combat, ajouter 5 a 10 tests qui verrouillent les hypotheses, puis seulement ensuite recalculer les BIS. Sinon le generateur va produire beaucoup de chiffres tres vite, mais pas forcement des chiffres vrais.

## Notes de style pour la suite

- Favoriser l'edition manuelle, import en bonus.
- Ne pas afficher les stats a 0 dans l'audit.
- Ne pas demander au joueur ce que les donnees peuvent deduire.
- Ne pas montrer le BIS avant les recommandations.
- Expliquer "pourquoi" une stat est recommandee.
- Garder les details experts dans "Voir le calcul".
- Toujours distinguer verite verifiee, hypothese et approximation.
