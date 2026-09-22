# Contrat simulateur v4

But: supprimer les ambiguities. Un cas passe ou ne passe pas selon une seule regle.

## Types conceptuels

```ts
type FightPoint = {
  age: number;
  combat: number;
  difficulty: "normal" | "hard";
};

type CombatVerdict = {
  point: FightPoint;
  passed: boolean;
  reason: "cleared" | "dead" | "timeout" | "invalid_input" | "missing_data";
  clearedWaves: number;
  waveCount: number;
  timeSeconds: number;
  maxSeconds: number;
  remainingHealth: number;
  damageDone: number;
  blockMode: "average" | "rng";
  seed: number | null;
  issues: Array<{ severity: "warning" | "error"; code: string; path?: string }>;
  metrics: Record<string, number | string>;
};
```

## Regle de passage

Pour le combat cible PvE:

```text
passed = toutes les vagues du combat cible sont videes
         ET le joueur est vivant
         ET le temps max n'est pas depasse
```

Semantique:

- `passed === true` seulement si `reason === "cleared"`.
- `cleared`: toutes les vagues sont videes, joueur vivant, `timeSeconds <= maxSeconds`.
- `dead`: PV tombes a 0 avant verdict passant. Prioritaire sur timeout.
- `timeout`: joueur vivant, temps atteint, vagues non videes.
- `invalid_input`: point, profil ou options incoherents; pas de simulation.
- `missing_data`: donnees combat necessaires absentes; pas de fallback synthetique.
- `metrics` sert au debug/tri, jamais a redefinir `passed`.

Les scores `damage`, `survival`, `progress`, `reach` peuvent aider a trier. Ils ne peuvent pas transformer un `passed: false` en "passe".

## Fonction publique minimale

```ts
evaluateCombatVerdict(
  profile: NormalizedProfile,
  data: GameDataBundle,
  point: FightPoint,
  options?: {
    maxSeconds?: number;
    blockMode?: "average" | "rng";
    seed?: number;
    skillActivationPolicy?: "auto_when_ready" | "disabled";
  }
): CombatVerdict
```

Le profil brut n'entre pas ici. L'adaptation des profils v2/v3 reste cote API/compatibilite.

## Determinisme

Par defaut, le simulateur v4 doit etre deterministe:

- `maxSeconds`: `900`;
- `blockMode`: `"average"`;
- `seed`: `null` en average, `1337` si RNG demande sans seed;
- `skillActivationPolicy`: `"auto_when_ready"`; si elle n'est pas fournie
  avec des competences equipees, le verdict expose l'avertissement
  `assumed_skill_auto_activation`;
- pas de `trials` ni `successRate >= 50` dans le verdict officiel;
- pas de `Date.now()` dans les resultats metier;
- arrondis seulement en sortie UI, jamais au milieu du calcul sauf raison documentee.

## Separation des sorties

Le simulateur retourne:

- un verdict binaire;
- des metriques brutes;
- un score de tri optionnel.

L'UI decide les textes affiches. Le BIS decide quel candidat trier. Aucun des deux ne redefinit `passed`.

## Cas golden a creer ensuite

1. Profil trop faible: meurt vague 1, `passed: false`.
2. Profil DPS fort mais PV trop faible: tue vite mais meurt avant la fin, `passed: false`.
3. Profil tank faible DPS: survit mais timeout, `passed: false`.
4. Profil valide: vide toutes les vagues, `passed: true`.
5. Meme profil via API, BIS et simulateur direct: meme `passed`.
6. Frontiere temps: tuer le dernier ennemi exactement a `maxSeconds` donne `cleared`.
7. Determinisme: meme profil, point, settings et seed donnent le meme verdict.
8. Donnees manquantes: `missing_data`, pas de combat synthetique.
