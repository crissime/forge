# Forge Master v4

Objectif: repartir proprement sans toucher a la v2/v3 existante.

La v4 doit corriger le probleme principal vu dans l'existant: plusieurs chemins de calcul donnent des verdicts differents. En v4, un cas ne peut etre marque "passe" que par le meme simulateur et la meme fonction de verdict que l'ecran de simulation.

## Regles de depart

- Aucun fichier existant hors `v4/` n'est modifie pendant le cadrage.
- Le simulateur est la source de verite; l'UI affiche, elle ne recalcule pas le combat.
- Un verdict de passage est binaire et explicite: combat cible passe ou ne passe pas.
- Les autres scores servent au tri et aux recommandations, pas a contredire le verdict.
- Les donnees generees doivent embarquer leur schema, version de donnees, hypothese de niveau, et regle de verdict.
- Les utilisateurs existants ne doivent pas recreer leur profil: soit la v4 garde la structure profil compatible, soit elle migre les donnees existantes automatiquement.

## Fichiers de cadrage

- `etat-des-lieux.md`: inventaire de l'existant et problemes reperes.
- `architecture.md`: architecture cible v4 minimale.
- `simulateur.md`: contrat du nouveau simulateur/verdict.
- `sources.md`: sources et donnees utiles a conserver.
- `equipe.md`: equipe v4, roles, prompts d'initialisation et cadre APK.
- `plan-calculateur-bis.md`: plan par lots, prerequis de calcul des candidats
  et prompt de mission a transmettre a Vega.
- `audit-donnees-bis.md`: matrice des sources de donnees, couvertures et
  bloqueurs de reconstruction des candidats.
- `strategie-batch-bis.md`: protocole de recherche bornee, tests des reductions
  et contrat du moteur BIS.
- `config/bis-batch-gates.json`: gates explicites du lancement d'un batch.
- `config/fairy-season-2.9.0.candidate.json`: configuration de saison candidate
  des fees, avec provenance explicite.
- `tools/prepare-bis-batch.mjs`: preflight qui controle les snapshots, le code,
  les tests et les gates sans demarrer de batch.
- `tools/probe-bis-fairies.mjs`: banc synthetique de cablage, paliers et replay
  des fees; il ne produit pas de BIS publiable.
- `ordres-milo.md`: ordres de cadrage par role, decisions verrouillees et infos a demander.
- `entrees-recueillies.md`: artefacts fournis pour v4, APK, profils et cas de validation.
- `analyse-apk-2.6.0.md`: controle statique de l'artefact APK et identite du fichier attendu.
- `analyse-xapk-2.8.2.md`: validation du bon XAPK, extraction des tables et formules confirmees.
- `analyse-xapk-2.9.0.md`: snapshot candidat, reflexion confirmee et limites des fees.
- `fees-2.9.0.md`: formule native, chiffres de saison candidats pour Mira,
  Tira et Lora, et provenance des valeurs.
- `pvp.md`: contrat du duel PvP standard, regles extraites et limites.
- `procedure-mise-a-jour.md`: reception, extraction, comparaison et validation
  d'une nouvelle version du jeu.
- `tools/inspect_metaplay_archive.py`: lecteur statique reproductible de l'archive de configuration.
- `tools/disassemble_il2cpp.py`: desassemblage statique cible avec noms Cpp2IL.
- `phase-1-verdict.md`: decisions phase 1 sur verdict, donnees, profils et gate APK.
- `todo.md`: chantiers v4 restants et ordre de dependance.

## Decision v4 proposee

Construire d'abord un petit moteur deterministe:

1. charger les donnees de jeu;
2. normaliser un profil;
3. simuler un combat cible;
4. retourner un `CombatVerdict`;
5. utiliser ce verdict partout: UI, BIS, tests, exports.

Tout le reste attendra que ce noyau soit fiable.

## Etat actuel

- snapshot APK 2.8.2: 23 tables wire, 13 tables normalisees et hashes verifies;
- moteur v4 pur: positions, vagues, attaques, projectiles et RNG seedee;
- 18 competences sur 18 confirmees depuis l'APK et implementees dans le meme
  moteur de verdict;
- profils existants adaptes a la volee, sans migration destructive;
- totaux pets/monture conserves et geometrie de monture issue de l'APK;
- 11 exports sur 14 sont simulables; les 3 autres restent importes et signalent
  uniquement l'arme absente;
- duel PvP standard disponible via `evaluatePvpVerdict`, sans validation en jeu;
- snapshot 2.9.0 chargeable explicitement pour tests, sans changer la version
  active 2.8.2; la reflexion est prise en compte; les parametres de fees sont
  recenses comme candidats et restent a valider puis a integrer;
- toute donnee ou competence manquante bloque le verdict explicitement;
- moteur BIS v4 borne: recherche deterministe sur candidats deja reconstruits,
  verdict officiel conserve, echec/diagnostic distincts et replay du gagnant;
- fees 2.9.0: Mira, Tira et Lora sont appliquees au profil avant PvE/PvP lorsque
  leur selection, les totaux avant fee et une saison explicite sont fournis;
  les profils 2.9.0 dont cet etat est inconnu le signalent et sont refuses par
  la recherche BIS;
- preflight BIS execute et volontairement bloque: reconstruction des candidats,
  espace legal, sets/skins, saison de fee et validations en jeu restent ouverts;
- l'API, l'UI et le BIS v4 ne sont pas encore branches.
