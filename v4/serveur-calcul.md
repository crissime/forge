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

## Commande du futur pilote de familles

La commande de batch ne doit etre ajoutee qu'avec son generateur dedie et sa
configuration figee. Elle utilisera le meme repertoire et devra recevoir:

```bash
node --import tsx v4/tools/run-bis-family-pilot.mjs \
  --config v4/config/bis-family-pilot-2.9.0.json \
  --output artifacts/bis-family-pilot
```

Cette commande est volontairement indicative: `run-bis-family-pilot.mjs` et sa
configuration n'existent pas encore. Ne pas la lancer avant leur livraison.
Le pilote devra tracer le commit, le fingerprint, la cible `hard 2-3`, les
regles de construction, les seeds, tous les verdicts et les replays des
candidats retenus.
