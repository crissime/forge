import type {
  NormalizedProfile,
  NormalizedSpellSelection,
  StatMap
} from "@forge-master/simulator";
import type { SpellOption } from "../../types";

export function setOpponentTotal(
  profile: NormalizedProfile,
  field: "attack" | "health",
  value: number
) {
  const safeValue = Math.max(0, Number(value || 0));
  profile.base[field] = safeValue;
  if (field === "attack") {
    profile.breakdown.baseAttack = safeValue;
    profile.breakdown.equipmentAttack = 0;
    profile.breakdown.petAttack = 0;
    profile.breakdown.mountAttack = 0;
  } else {
    profile.breakdown.baseHealth = safeValue;
    profile.breakdown.equipmentHealth = 0;
    profile.breakdown.petHealth = 0;
    profile.breakdown.mountHealth = 0;
  }
}

export function setOpponentStat(
  profile: NormalizedProfile,
  stat: keyof StatMap,
  value: number
) {
  const safeValue = Math.max(0, Number(value || 0));
  profile.stats[stat] = safeValue;
  profile.breakdown.secondaryStats[stat] = safeValue;
  profile.breakdown.talentStats[stat] = 0;
}

export function setOpponentSpell(
  profile: NormalizedProfile,
  index: number,
  id: string,
  level: number,
  spells: SpellOption[]
) {
  const next = profile.spells.slice(0, 3) as Array<NormalizedSpellSelection | undefined>;
  if (!id) {
    next.splice(index, 1);
  } else {
    next[index] = {
      id,
      level: Math.min(100, Math.max(1, Math.round(Number(level || 1)))),
      rarity: spells.find((spell) => spell.id === id)?.rarity
    };
  }
  profile.spells = next.filter((spell): spell is NormalizedSpellSelection => Boolean(spell?.id));
}
