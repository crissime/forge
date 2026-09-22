# TODO v4

- [ ] Valider le candidat 2.9.0 (signatures APK, bonus de fees, impacts des
  tables changees et cas reels); garder 2.8.2 active jusque-la
- [x] Moteur PvP: duel standard v4, verdict unique et tests locaux
- [ ] Validation du duel PvP contre des cas reels reproductibles
- [ ] Mode PvP guerre de guilde (regles et tests propres)
- [ ] Moteur donjon
- [x] Cadrage du calculateur BIS et prompt Vega: `plan-calculateur-bis.md`
- [x] BIS lot 0: audit des prerequis, gates de lancement et contrat de recherche
- [x] BIS: moteur de recherche borne, deterministe et rejouable sur candidats
  deja reconstruits; probe synthetique des fees realise
- [x] BIS 2.9.0: integration technique de Mira/Tira/Lora par candidat, avec
  paliers, plafonds, saison tracee et refus de l'etat de fee inconnu en batch
- [x] BIS 2.9.0: fige les fees de reference: une selection Mira/Tira/Lora,
  niveau 20, coefficients et plafonds confirmes par l'utilisateur
- [x] BIS: exclure skins et sets de skins du scenario de reference
- [x] BIS: normaliser les composants et construire les candidats legaux de base
  (equipement, lignes, pets, monture; donnees APK 2.9.0 et tests dedies)
- [ ] BIS: completer les candidats legaux avec talents fixes, regles d'acces du
  cas, politique de doublon et granularite discrete des rolls; sets et skins
  restent exclus du scenario de reference
- [ ] BIS: tester les reductions sur petits espaces legaux exhaustifs puis sur
  des cas de controle, avant tout batch long
- [ ] BIS: constructeur partage de statistiques puis recherche PvE sur un cas
- [ ] BIS: reprise, artefacts verifies, extension mesuree puis classement PvP
- [ ] API v4 branchee uniquement sur les verdicts officiels des moteurs
- [ ] Front v4 sans recalcul local des combats

Ordre de dependance: donnees et moteurs, construction des candidats et BIS,
API, puis front. La recherche BIS 2.9.0 depend aussi des fees et de leur saison.
