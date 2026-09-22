# Serveur de calcul v4

Ce runbook prepare le serveur et execute uniquement les controles et probes v4.
Il ne lance ni l'ancien generateur BIS, ni l'API, ni un batch long. Requis:
Linux, Git, Node.js 20 ou plus, acces au depot contenant les snapshots
`packages/v4-game-data/data/2.8.2` et `2.9.0`.

## Installation et preflight

Remplacer les deux variables par le depot et le commit a calculer. Le commit
doit etre fige: il sera reporte avec les artefacts de sortie.

```bash
set -euo pipefail

export REPOSITORY_URL='URL_DU_DEPOT'
export COMMIT_SHA='COMMIT_A_CALCULER'
export WORKDIR="$HOME/forge-master-v4"

git clone "$REPOSITORY_URL" "$WORKDIR"
cd "$WORKDIR"
git checkout --detach "$COMMIT_SHA"

node --version
npm ci

# Ne jamais lancer: npm run build
# Ne jamais lancer: npm run bis:generate
set +e
node --import tsx v4/tools/prepare-bis-batch.mjs
PREFLIGHT_STATUS=$?
set -e

# 0: toutes les gates sont validees.
# 2: controles techniques executes, mais des gates metier restent bloquees.
# Autre code: echec technique, ne pas continuer.
if [ "$PREFLIGHT_STATUS" -ne 0 ] && [ "$PREFLIGHT_STATUS" -ne 2 ]; then
  exit "$PREFLIGHT_STATUS"
fi

node --import tsx v4/tools/probe-bis-fairies.mjs

mkdir -p "$WORKDIR/artifacts"
cp v4/generated/bis-preflight.json "$WORKDIR/artifacts/"
cp v4/generated/bis-fairy-probe.json "$WORKDIR/artifacts/"
git rev-parse HEAD > "$WORKDIR/artifacts/commit.txt"
sha256sum "$WORKDIR"/artifacts/* > "$WORKDIR/artifacts/SHA256SUMS"

printf 'Preflight exit code: %s\n' "$PREFLIGHT_STATUS"
printf 'Artifacts: %s\n' "$WORKDIR/artifacts"
```

Le probe de fees est synthetique et non publiable. Il controle le cablage des
fees, paliers, plafonds et le replay; il ne cherche pas un BIS et ne remplace
pas le futur batch de familles.

## Pilote de familles

Le pilote utilise son generateur et sa configuration dedies:

```bash
node --import tsx v4/tools/run-bis-family-pilot.mjs \
  --config v4/config/bis-family-pilot-2.9.0.json \
  --output artifacts/bis-family-pilot
```

Cette commande lance le pilote experimental livre avec le depot. Il ne produit
pas un BIS publiable. Lire `verdictSpread`: si tous les candidats passent ou
echouent, la cible ne departage pas les familles et doit etre relevee ou abaissee
avant de comparer un gagnant.

## Calibration graduelle

La calibration conserve exactement les memes candidats, puis parcourt les
combats APK dans l'ordre a partir de `Difficile 2-3`. Elle s'arrete au premier
combat ou aucun candidat ne passe. Le rapport conserve chaque palier et les
totaux par fee, style, pet, monture et allocation.

Le numero de combat n'est pas necessairement une difficulte strictement
croissante : les vagues peuvent changer. Lire la courbe complete et le champ
`passCountsAreMonotonic`; le premier palier a zero reussite est un plafond de
la campagne, pas une preuve qu'aucun combat suivant ne serait plus accessible.

```bash
node --import tsx v4/tools/run-bis-family-calibration.mjs \
  --config v4/config/bis-family-calibration-2.9.0.json \
  --output artifacts/bis-family-calibration.json
```

Ce rapport est experimental : il selectionne une zone de comparaison, il ne
publie pas un BIS.
Le pilote devra tracer le commit, le fingerprint, la cible `hard 2-3`, les
regles de construction, les seeds, tous les verdicts et les replays des
candidats retenus.

## Batch parallele avec affinement

Utiliser Node 22 ou plus recent. La commande suivante remplace les anciens
`run-bis-large-shard.mjs` et `aggregate-bis-large-batch.mjs`.

ATTENTION : la configuration a trois types d'armes reste bloquee tant que les
statistiques primaires de l'arme melee attaque + PV ne sont pas identifiees
dans le catalogue. Les anciens resultats de `melee_plus_health` ne representent
pas cette arme et ne doivent pas etre reutilises. Ne pas lancer la campagne
complete avant resolution de cette donnee.

```bash
cd /home/debian/forge
git pull --ff-only
npm ci
mkdir -p artifacts
nohup node --import tsx v4/tools/run-bis-batch.mjs \
  --config v4/config/bis-large-batch-2.9.0.json \
  --workers 40 --output artifacts/bis-batch-v2 \
  > artifacts/bis-batch-v2.log 2>&1 < /dev/null &
```

Suivi : `tail -f artifacts/bis-batch-v2.log`.
Resultat : `artifacts/bis-batch-v2/report.json`.
Le lanceur attend la fin de tous les workers et fusionne automatiquement.
Ne pas lancer cette commande en parallele avec l'ancien batch.

- Jusqu'a 100 000 profils de combat uniques apres resolution des fees, avec
  un plafond d'un million de propositions. Le rapport expose le nombre reel.
- Corps a corps + PV selectionne une arme avec attaque et sante de base.
  Aucune quantite de lignes Sante n'est imposee. Chaque porteur conserve deux
  statistiques secondaires differentes.
- Evaluation moyenne sur Difficile 2-16, 2-17, 2-18 et 2-19; courbes par famille.
- Conservation des cinq meilleurs par fee/style. Jusqu'a trois tours de
  5 000 mutations de lignes legales; arret anticipe si les elites ne changent plus.
- Les deux finalistes par famille sont reconstruits et rejoues a l'identique,
  puis testes sur 100 graines par combat, avec taux de reussite et intervalle a 95 %.
- Classement exploratoire : nombre de combats passes, puis verdicts du dernier
  au premier combat (reussite, temps/PV ou vagues/degats). Pas de score de combat
  alternatif au verdict officiel. Les taux RNG sont exposes pour comparaison.

Le parent genere les candidats une seule fois; chaque worker ne charge que sa
tranche. Checkpoint tous les 100 candidats, puis par finaliste RNG. Relancer la
meme commande reprend les checkpoints si le code, les donnees, la configuration
et le nombre de workers sont identiques. Une modification exige un autre dossier.
Apres un arret brutal, un fichier `running.lock` peut rester : verifier qu'aucun
processus de cette campagne ne tourne avant de retirer ce fichier uniquement.
Un echec d'un worker interrompt le lanceur sans publier de rapport final.

Limites du scenario : objets divins niveau 100, lignes au roll maximum,
armes canoniques du pilote, trois pets du meme type parmi les compositions
configurees, montures mythiques configurees, fees niveau 20. Pas de sorts,
talents ou skins. Pas d'elimination par dominance supposee : seules les
equivalences de profil de combat sont supprimees. L'affinement local et les
graines RNG n'etablissent ni optimalite globale ni validation en jeu.

Test du lanceur :
`node --import tsx --test v4/tools/run-bis-batch.test.mjs`.
