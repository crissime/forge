# Fees 2.9.0: donnees et preuves

Recherche initiale du 2026-09-17, mise a jour du 2026-09-22. Les noms et la
formule sont confirmes dans le XAPK local. Les valeurs de saison ci-dessous
provenaient initialement d'un releve communautaire date du 2026-09-09; elles
ont ensuite ete confirmees par l'utilisateur pour le scenario BIS de reference
au niveau 20. Elles ne sont toujours pas presentees comme une extraction de
`FairiesEventConfig.Stats` depuis notre APK.

## Parametres de saison retrouves

Source figee: [1vcian/fm, src/utils/fairies.ts au commit b51c33c](https://github.com/1vcian/fm/blob/b51c33cd4804e8506d8f94218f00086c88c74091/src/utils/fairies.ts).
Le commentaire du fichier indique une transcription du selecteur en jeu au
niveau 20, avec la progression observee par niveau. Les captures originales
ne figurent pas dans les elements consultes: statut `community_transcription`,
validation directe en jeu encore necessaire.

| Fee | Statistique equipee requise par palier | Bonus par palier au niv. 1 | Gain par niveau | Bonus par palier au niv. 20 | Plafond du total cible |
| --- | --- | --- | --- | --- | --- |
| Mira | +15% degats de competence | +1 point de chance critique | +1 point | +20 points | 80% critique |
| Tira | 1% reduction de recharge des competences | +0,25 point de blocage | +0,25 point | +5 points | 30% blocage |
| Lora | +10% bonus de vie | +0,75 point de reflexion | +0,75 point | +15 points | 30% reflexion |

Le gain par niveau s'applique a **chaque palier**. Le plafond concerne le
total de la statistique secondaire cible, bonus de fee inclus, et non le seul
bonus. Par exemple, avec ces parametres, Mira niveau 10 et 45% de degats de
competence donnent trois paliers de 10 points, soit 30 points de critique
avant application du plafond avec le critique deja equipe.

La source signale une saison pouvant changer independamment de la version
du jeu. La date du releve ne prouve pas la date exacte de debut de saison.

## Formule confirmee dans le binaire local

`FairyHelpers.CalculateRawBonus`, RVA `0x5E689A8`, utilise:

```text
paliers = abs(floor(totalSecondaireRequis / diviseur))
bonusParPalier = bonusBase + gainParNiveau * (niveau - 1)
bonusBrut = paliers * bonusParPalier
```

La statistique requise est lue dans `Stats.TotalSecondaryStats`, pas dans la
vie finale du personnage ou le multiplicateur final toutes sources confondues.
Le calcul est en F64 (Q32.32). L'ordre `abs(floor(...))` est confirme; ne pas
le remplacer par `floor(abs(...))` si des valeurs signees sont admises.
`SecondaryStatLibrary` encode la reduction de recharge comme une valeur
positive associee a `OneMinusMultiplier`.

`FairyHelpers.ApplyFairyStat`, RVA `0x5E683F4`, enregistre le plafond dans
`Stats.CappedSecondaryStats`. Quand le bonus brut n'est pas nul, il calcule
la contribution effective comme:

```text
totalEffectif = min(totalCibleAvant + bonusBrut, plafond)  # si plafond present
contribution = totalEffectif - totalCibleAvant
```

Le dictionnaire `TotalSecondaryStats` conserve le total brut; le plafond et
la contribution effective sont traites separement. Il ne faut pas ajouter
la fee deux fois a un profil dont les chiffres incluent deja son effet.

## Ce que contient l'APK

- `FairiesVisualConfig`: Mira, Tira et Lora, dans cet ordre, avec leurs icones
  et prefabs. Asset: `assets/bin/Data/2b4761109dd1844908d743481c877957`.
- `FairyUpgradesLibrary`: **19 lignes, niveaux 2 a 20**. Le niveau initial du
  modele est 1. L'ancien compte rendu parlait a tort de 20 paliers de cout.
- `Fairies_en`: textes generiques de conversion, plafond et expiration.
- Trois prefabs d'ecran contiennent un texte chiffre pour **Mira**:
  +5 points de critique par +15% de degats de competence, +1 point a
  l'amelioration et plafond de 50%. Le prefab d'amelioration affiche aussi
  `Lv. 1`. Ce contenu enregistre differe du releve de saison ci-dessus.

Ces textes sont des valeurs pre-remplies d'interface, pas une table de
parametres de combat: les classes d'ecran ont des references aux textes et
au modele d'evenement. Ne pas injecter les valeurs 5%/50% dans le moteur en
les qualifiant de regles actuelles.

Preuves locales des textes, sous `assets/bin/Data/` du base APK:

| Asset | Ecran | SHA256 |
| --- | --- | --- |
| `06f3467b886e94be189902f8bf0453b9` | Selection | `14c0e17d7774679175c75285785c1d75172a7462e6ef4a393896a7e45ddf6e52` |
| `b1ba3425f54a64a99ae20138252366eb` | Amelioration | `63dd74eddbf365e11e1ab8d702c3d1e0999943ef408478514fbffe771e09cf34` |
| `f64ec50d09f6d45cea4d237bdec26d7e` | Fiche PvP | `6ceeda6fb4165c054e0734d209663c71e62c2f13d332e7edd25e105883c27000` |

## Perimetre de recherche

Inventaire avec UnityPy de 2538 fichiers Unity (y compris les fichiers
`.assets.splitN` reunis en memoire): 10038 MonoBehaviour et 11 TextAsset,
sans erreur de lecture de l'inventaire. Recherche dans les ressources de
localisation, les chaines du metadata IL2CPP, les 76 entrees de configuration
et les methodes de calcul/chargement des fees. La lecture de l'inventaire
n'equivaut pas au decodage de chaque champ de chaque MonoBehaviour.

La classe `FairiesEventConfig` ne fournit pas de constantes de bonus dans
son constructeur. `FairiesEventModel.Stats` lit le contenu d'evenement.
Aucune table chiffreant Tira et Lora n'a ete identifiee dans les ressources
locales examinees. Cela decrit le resultat de la recherche, pas une preuve
d'absence absolue de toute representation dans le fichier.

## Suite pour le moteur

- Utiliser la formule native comme reference et les chiffres communautaires
  comme configuration de saison candidate, avec source et date.
- Confirmer les valeurs actuelles puis conserver un identifiant de saison
  distinct de `gameVersion`; une mise a jour d'evenement peut changer les
  bonus sans nouveau XAPK.
- Adapter le profil existant avec selection, niveau et etat d'evenement;
  verifier si ses totaux incluent deja la fee. Aucune recreation de profil.
- Verifier les agregats monture/pets/equipement et les limites de paliers.
  Le [signalement communautaire #22](https://github.com/1vcian/fm/issues/22)
  montre notamment un oubli de monture/pets dans la comparaison de builds
  du calculateur communautaire: ne pas reprendre son calcul sans controle.
