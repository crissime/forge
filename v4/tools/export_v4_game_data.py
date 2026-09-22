#!/usr/bin/env python3
"""Export the minimal v4 simulator data snapshot from SharedGameConfig.mpa."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from inspect_metaplay_archive import load_mpa, parse_archive, parse_config


REQUIRED_TABLES = (
    "MainBattleLibrary",
    "EnemyAgeScalingLibrary",
    "EnemyLibrary",
    "WeaponLibrary",
    "ProjectilesLibrary",
    "MainBattleConfig",
    "ItemBalancingConfig",
    "StatConfigLibrary",
    "SecondaryStatLibrary",
    "SkillLibrary",
    "SkillBaseConfig",
    "MountLibrary",
    "PvpBaseConfig",
)

OPTIONAL_TABLES = (
    "ItemBalancingLibrary",
    "TechNodesLibrary",
    "PlayerTechTreePositionLibrary",
    "PlayerTechTreeNodeValuesLibrary",
    "PlayerTechTreeTierLibrary",
    "PetLibrary",
    "PetUpgradeLibrary",
    "PetBalancingLibrary",
    "PetBaseConfig",
    "MountUpgradeLibrary",
    "SecondaryStatItemUnlockLibrary",
    "SecondaryStatPetUnlockLibrary",
)

F1D_SCALE = 100
ITEM_TYPES = {
    0: "Helmet",
    1: "Armour",
    2: "Gloves",
    3: "Necklace",
    4: "Ring",
    5: "Weapon",
    6: "Shoes",
    7: "Belt",
}
SECONDARY_STAT_TYPES = {
    0: "CriticalChance",
    1: "CriticalMulti",
    2: "BlockChance",
    3: "HealthRegen",
    4: "LifeSteal",
    5: "DoubleDamageChance",
    6: "DamageMulti",
    7: "MeleeDamageMulti",
    8: "RangedDamageMulti",
    9: "AttackSpeed",
    10: "SkillDamageMulti",
    11: "SkillCooldownMulti",
    12: "HealthMulti",
    13: "MoveSpeed",
    14: "AttackRange",
    15: "ReflectChance",
}
STAT_TYPES = {
    0: "Damage",
    1: "Health",
    2: "MaxLevel",
    3: "Experience",
    4: "Cost",
    5: "TimerSpeed",
    6: "SellPrice",
    7: "MaxCount",
    8: "Bonus",
    10: "FreebieChance",
    11: "CriticalChance",
    12: "CriticalDamage",
    13: "BlockChance",
    14: "HealthRegen",
    15: "LifeSteal",
    16: "DoubleDamageChance",
    17: "AttackSpeed",
    18: "MoveSpeed",
    19: "AttackRange",
    20: "Duration",
    21: "ReflectChance",
}
STAT_NATURES = {0: "Multiplier", 1: "Additive", 2: "Divisor", 3: "OneMinusMultiplier"}
STAT_LAYERS = {0: "None", 1: "GeneralCompounding", 2: "Skins", 3: "Ascensions", 4: "TechTree"}
STAT_CONDITIONS = {
    0: "None",
    1: "Melee",
    2: "Ranged",
    10: "InHammerThiefDungeon",
    11: "InGhostTownDungeon",
    12: "InInvasionDungeon",
    13: "InZombieRushDungeon",
    14: "InLeagueBattle",
    15: "InClanWarOrBrawl",
    16: "InMission",
    20: "OnGuildWarDay1",
    21: "OnGuildWarDay2",
    22: "OnGuildWarDay3",
    23: "OnGuildWarDay4",
    24: "OnGuildWarDay5",
    25: "OnGuildWarDay6",
}
STAT_TARGET_KINDS = {
    0: "Player",
    1: "Equipment",
    2: "ActiveSkill",
    3: "PassiveSkill",
    4: "Mount",
    5: "Forge",
    6: "Egg",
    7: "Currency",
    8: "Pet",
    9: "TechTree",
    10: "Duration",
    11: "WarPoints",
    13: "Keys",
    14: "TechRaceScore",
}
STAT_QUALIFIER_TYPES = {
    0: "ItemType",
    1: "AttackType",
    2: "Rarity",
    3: "Skill",
    4: "CurrencyType",
    5: "DungeonType",
    6: "Source",
}
COMBAT_SKILLS = {
    0: "Meat", 1: "Morale", 2: "Arrows", 3: "Shuriken", 4: "Shout",
    5: "Meteorite", 6: "Berserk", 7: "Stampede", 8: "Thorns",
    9: "Bomb", 10: "Worm", 11: "Lightning", 12: "Buff",
    13: "HigherMorale", 14: "RainOfArrows", 15: "StrafeRun",
    16: "CannonBarrage", 17: "Drone",
}
RARITIES = {0: "Common", 1: "Rare", 2: "Epic", 3: "Legendary", 4: "Ultimate", 5: "Mythic"}
PET_BALANCING_TYPES = {0: "Balanced", 1: "Damage", 2: "Health"}


def json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True, allow_nan=False)
        + "\n"
    ).encode("utf-8")


def expect_tags(value: dict[str, Any], tags: set[str], context: str) -> None:
    if set(value) != tags:
        raise ValueError(
            f"unexpected tags for {context}: got {sorted(value)}, expected {sorted(tags)}"
        )


def member(value: dict[str, Any], tag: int) -> Any:
    return value[str(tag)]["value"]


def enum_name(values: dict[int, str], value: int, context: str) -> str:
    if value not in values:
        raise ValueError(f"unknown {context} enum value: {value}")
    return values[value]


def fixed_member(value: dict[str, Any], tag: int) -> float:
    return member(value, tag)["value"]


def f1d_member(value: dict[str, Any], tag: int) -> dict[str, int | float]:
    encoded = member(value, tag)
    expect_tags(encoded, {"1"}, "F1D")
    raw = member(encoded, 1)
    return {"Raw": raw, "Value": raw / F1D_SCALE}


def normalize_item_id(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    expect_tags(value, {"1", "2", "3"}, "ItemId")
    return {
        "Age": member(value, 1),
        "Type": enum_name(ITEM_TYPES, member(value, 2), "ItemType"),
        "Idx": member(value, 3),
    }


def normalize_main_battle(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    rows = parsed["value"]
    result = []
    for row in rows:
        expect_tags(row, {"1", "2"}, "MainBattleLibrary")
        battle_id = member(row, 1)
        expect_tags(battle_id, {"1", "2"}, "BattleId")
        waves = []
        for wave in member(row, 2):
            expect_tags(wave, {"1", "2"}, "WaveConfig")
            enemies = []
            for enemy in member(wave, 2):
                expect_tags(enemy, {"1", "2"}, "Enemy")
                enemies.append({"Id": member(enemy, 1), "Count": member(enemy, 2)})
            waves.append({"WaveIdx": member(wave, 1), "Enemies": enemies})
        result.append(
            {
                "BattleId": {
                    "AgeIdx": member(battle_id, 1),
                    "BattleIdx": member(battle_id, 2),
                },
                "Waves": waves,
            }
        )
    return result


def normalize_enemy_age_scaling(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3"}, "EnemyAgeScalingConfig")
        result.append(
            {
                "AgeIdx": member(row, 1),
                "Damage": f1d_member(row, 2),
                "Health": f1d_member(row, 3),
            }
        )
    return result


def normalize_enemy_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3", "4"}, "EnemyConfig")
        result.append(
            {
                "EnemyIdx": member(row, 1),
                "WeaponId": normalize_item_id(member(row, 2)),
                "HelmetId": normalize_item_id(member(row, 3)),
                "ArmourId": normalize_item_id(member(row, 4)),
            }
        )
    return result


def normalize_vector(value: list[dict[str, Any]]) -> dict[str, float]:
    if len(value) != 2:
        raise ValueError(f"unexpected F64Vec2 length: {len(value)}")
    return {"X": value[0]["value"], "Y": value[1]["value"]}


def normalize_weapon_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    tags = {"1", "3", "4", "5", "6", "7", "8", "9", "10"}
    for row in parsed["value"]:
        expect_tags(row, tags, "WeaponInfo")
        result.append(
            {
                "ItemId": normalize_item_id(member(row, 1)),
                "AttackRange": fixed_member(row, 3),
                "WindupTime": fixed_member(row, 4),
                "AttackDuration": fixed_member(row, 5),
                "IsRanged": bool(member(row, 6)),
                "IsAiming": bool(member(row, 7)),
                "ProjectileId": member(row, 8),
                "Hand": normalize_vector(member(row, 9)),
                "Offset": normalize_vector(member(row, 10)),
            }
        )
    return result


def normalize_projectile_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3", "4"}, "ProjectileInfo")
        result.append(
            {
                "Id": member(row, 1),
                "Speed": fixed_member(row, 2),
                "CollisionRadius": fixed_member(row, 3),
                "AffectedByGravity": bool(member(row, 4)),
            }
        )
    return result


def normalize_main_battle_config(parsed: dict[str, Any]) -> dict[str, Any]:
    value = parsed["value"]
    expect_tags(value, {"1", "2", "3"}, "MainBattleConfig")
    return {
        "EnemyHpDifficultyMulti": fixed_member(value, 1),
        "EnemyDmgDifficultyMulti": fixed_member(value, 2),
        "CoinsPerEnemy": member(value, 3),
    }


def normalize_item_balancing_config(parsed: dict[str, Any]) -> dict[str, float]:
    value = parsed["value"]
    expect_tags(value, {str(tag) for tag in range(1, 10)}, "ItemBalancingConfig")
    names = (
        "LevelScalingBase",
        "SellBasePrice",
        "PlayerMeleeDamageMultiplier",
        "PlayerBaseDamage",
        "PlayerBaseHealth",
        "EnemyRangedDamageMultiplier",
        "PlayerPowerDamageMultiplier",
        "PlayerBaseCritDamage",
        "ItemBaseMaxLevel",
    )
    return {name: fixed_member(value, tag) for tag, name in enumerate(names, 1)}


def normalize_unique_stat(value: dict[str, Any]) -> dict[str, str]:
    expect_tags(value, {"1", "2"}, "UniqueStat")
    return {
        "StatType": enum_name(STAT_TYPES, member(value, 1), "StatType"),
        "StatNature": enum_name(STAT_NATURES, member(value, 2), "StatNature"),
    }


def normalize_stat_config(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, "StatConfig")
        result.append(
            {
                "UniqueStat": normalize_unique_stat(member(row, 1)),
                "DefaultValue": fixed_member(row, 2),
            }
        )
    return result


def normalize_stat_target(value: dict[str, Any]) -> dict[str, Any]:
    expect_tags(value, {"1", "2"}, "StatTarget")
    qualifiers = []
    for qualifier in member(value, 2):
        expect_tags(qualifier, {"1", "2"}, "StatQualifier")
        qualifiers.append(
            {
                "Type": enum_name(
                    STAT_QUALIFIER_TYPES, member(qualifier, 1), "StatQualifierType"
                ),
                "Value": member(qualifier, 2),
            }
        )
    return {
        "Kind": enum_name(STAT_TARGET_KINDS, member(value, 1), "StatTargetKind"),
        "Qualifiers": qualifiers,
    }


def normalize_stat_node(value: dict[str, Any]) -> dict[str, Any]:
    expect_tags(value, {"1", "2", "3", "4", "5"}, "StatNode")
    legacy_target = member(value, 2)
    if legacy_target is not None:
        raise ValueError("non-null legacy StatTarget is not mapped")
    return {
        "UniqueStat": normalize_unique_stat(member(value, 1)),
        "LegacyTarget": None,
        "Layer": enum_name(STAT_LAYERS, member(value, 3), "StatLayer"),
        "Condition": enum_name(STAT_CONDITIONS, member(value, 4), "StatCondition"),
        "Target": normalize_stat_target(member(value, 5)),
    }


def normalize_secondary_stats(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3", "4"}, "SecondaryStatLibrary")
        result.append(
            {
                "Stat": enum_name(
                    SECONDARY_STAT_TYPES, member(row, 1), "SecondaryStatType"
                ),
                "LowerRange": fixed_member(row, 2),
                "UpperRange": fixed_member(row, 3),
                "StatNodes": [normalize_stat_node(node) for node in member(row, 4)],
            }
        )
    return result


def normalize_skill_library(parsed: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3", "4", "5", "6"}, "SkillConfig")
        skill = enum_name(COMBAT_SKILLS, member(row, 1), "CombatSkill")
        result[skill] = {
            "Type": skill,
            "Rarity": enum_name(RARITIES, member(row, 2), "Rarity"),
            "ActiveDuration": fixed_member(row, 3),
            "Cooldown": fixed_member(row, 4),
            "DamagePerLevel": [entry["value"] for entry in member(row, 5)],
            "HealthPerLevel": [entry["value"] for entry in member(row, 6)],
        }
    return result


def normalize_skill_base_config(parsed: dict[str, Any]) -> dict[str, int]:
    value = parsed["value"]
    expect_tags(value, {"4", "5"}, "SkillBaseConfig")
    return {"SkillsCount": member(value, 4), "SkillSlotsCount": member(value, 5)}


def normalize_mount_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3", "4"}, "MountLibrary")
        mount_id = member(row, 1)
        expect_tags(mount_id, {"1", "2"}, "MountId")
        result.append(
            {
                "MountId": {
                    "Rarity": enum_name(RARITIES, member(mount_id, 1), "Rarity"),
                    "Id": member(mount_id, 2),
                },
                "UnitOffset": normalize_vector(member(row, 2)),
                "CenterOfMass": normalize_vector(member(row, 3)),
                "ColliderRadius": fixed_member(row, 4),
            }
        )
    return result


def normalize_pvp_base_config(parsed: dict[str, Any]) -> dict[str, Any]:
    value = parsed["value"]
    expect_tags(value, {"1", "2", "3", "4", "10", "11", "12", "13"}, "PvpBaseConfig")
    return {
        "PvpHpBaseMultiplier": fixed_member(value, 1),
        "PvpHpPetMultiplier": fixed_member(value, 2),
        "PvpHpSkillMultiplier": fixed_member(value, 3),
        "PvpHpMountMultiplier": fixed_member(value, 4),
        "PvpMatchTimerSeconds": member(value, 10),
        "DailyArenaTickets": member(value, 11),
        "GuildWarBattleMatchTimerSeconds": member(value, 12),
        "GuildWarMeleeHpScaling": fixed_member(value, 13),
    }


def normalize_stat_contribution(value: dict[str, Any]) -> dict[str, Any]:
    expect_tags(value, {"1", "2"}, "StatContribution")
    return {"StatNode": normalize_stat_node(member(value, 1)), "Value": fixed_member(value, 2)}


def normalize_item_balancing_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, "EquipmentItemInfo")
        result.append({
            "ItemId": normalize_item_id(member(row, 1)),
            "EquipmentStats": [normalize_stat_contribution(stat) for stat in member(row, 2)],
        })
    return result


def normalize_pet_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, "PetConfig")
        pet_id = member(row, 1)
        expect_tags(pet_id, {"1", "2"}, "PetId")
        result.append({
            "PetId": {"Rarity": enum_name(RARITIES, member(pet_id, 1), "Rarity"), "Id": member(pet_id, 2)},
            "Type": enum_name(PET_BALANCING_TYPES, member(row, 2), "PetBalancingType"),
        })
    return result


def normalize_upgrade_library(parsed: dict[str, Any], context: str) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, context)
        levels = []
        for level in member(row, 2):
            expect_tags(level, {"1", "2", "3"}, f"{context}.LevelInfo")
            stats = member(level, 3)
            expect_tags(stats, {"1", "2"}, f"{context}.Stats")
            levels.append({
                "Level": member(level, 1),
                "Experience": member(level, 2),
                "Stats": [normalize_stat_contribution(stat) for stat in member(stats, 1)],
            })
        result.append({"Rarity": enum_name(RARITIES, member(row, 1), "Rarity"), "LevelInfo": levels})
    return result


def normalize_pet_balancing_library(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2", "3"}, "PetBalancingConfig")
        result.append({
            "Type": enum_name(PET_BALANCING_TYPES, member(row, 1), "PetBalancingType"),
            "DamageMultiplier": fixed_member(row, 2),
            "HealthMultiplier": fixed_member(row, 3),
        })
    return result


def normalize_pet_base_config(parsed: dict[str, Any]) -> dict[str, int]:
    value = parsed["value"]
    expect_tags(value, {"1", "2", "3", "4", "5"}, "PetBaseConfig")
    return {
        "PetSlotsCount": member(value, 1),
        "EggHatchSlotStartCount": member(value, 2),
        "EggHatchSlotMaxCount": member(value, 3),
        "EggHatchSlotThreeCost": member(value, 4),
        "EggHatchSlotFourCost": member(value, 5),
    }


def normalize_secondary_item_unlocks(parsed: dict[str, Any]) -> list[dict[str, int]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, "SecondaryStatItemUnlockLibrary")
        result.append({"ItemAge": member(row, 1), "NumberOfSecondStats": member(row, 2)})
    return result


def normalize_secondary_pet_unlocks(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for row in parsed["value"]:
        expect_tags(row, {"1", "2"}, "SecondaryStatPetUnlockLibrary")
        result.append({
            "PetRarity": enum_name(RARITIES, member(row, 1), "Rarity"),
            "NumberOfSecondStats": member(row, 2),
        })
    return result


NORMALIZERS = {
    "MainBattleLibrary": normalize_main_battle,
    "EnemyAgeScalingLibrary": normalize_enemy_age_scaling,
    "EnemyLibrary": normalize_enemy_library,
    "WeaponLibrary": normalize_weapon_library,
    "ProjectilesLibrary": normalize_projectile_library,
    "MainBattleConfig": normalize_main_battle_config,
    "ItemBalancingConfig": normalize_item_balancing_config,
    "StatConfigLibrary": normalize_stat_config,
    "SecondaryStatLibrary": normalize_secondary_stats,
    "SkillLibrary": normalize_skill_library,
    "SkillBaseConfig": normalize_skill_base_config,
    "MountLibrary": normalize_mount_library,
    "PvpBaseConfig": normalize_pvp_base_config,
    "ItemBalancingLibrary": normalize_item_balancing_library,
    "PetLibrary": normalize_pet_library,
    "PetUpgradeLibrary": lambda parsed: normalize_upgrade_library(parsed, "PetUpgradeLibrary"),
    "PetBalancingLibrary": normalize_pet_balancing_library,
    "PetBaseConfig": normalize_pet_base_config,
    "MountUpgradeLibrary": lambda parsed: normalize_upgrade_library(parsed, "MountUpgradeLibrary"),
    "SecondaryStatItemUnlockLibrary": normalize_secondary_item_unlocks,
    "SecondaryStatPetUnlockLibrary": normalize_secondary_pet_unlocks,
}


def build_snapshot(archive_path: Path, game_version: str) -> dict[Path, bytes]:
    archive_bytes = load_mpa(archive_path)
    archive = parse_archive(archive_bytes)
    entries = {entry.name: entry for entry in archive.entries}
    files: dict[Path, bytes] = {}
    manifest_tables: dict[str, Any] = {}

    missing_required = [
        table for table in REQUIRED_TABLES if f"{table}.mpc" not in entries
    ]
    if missing_required:
        raise ValueError(
            "missing required archive entries: " + ", ".join(missing_required)
        )

    selected_tables = REQUIRED_TABLES + tuple(
        table for table in OPTIONAL_TABLES if f"{table}.mpc" in entries
    )
    for table in selected_tables:
        entry_name = f"{table}.mpc"
        entry = entries[entry_name]
        parsed = parse_config(entry.data)
        relative_path = Path("raw") / f"{table}.json"
        file_content = json_bytes(parsed)
        files[relative_path] = file_content
        manifest_tables[table] = {
            "archiveEntry": entry_name,
            "entryChecksum": entry.checksum,
            "file": relative_path.as_posix(),
            "fileSha256": hashlib.sha256(file_content).hexdigest().upper(),
            "fileSize": len(file_content),
            "payloadSha256": hashlib.sha256(entry.data).hexdigest().upper(),
            "payloadSize": len(entry.data),
        }
        if table in NORMALIZERS:
            normalized_path = Path("normalized") / f"{table}.json"
            normalized_value = NORMALIZERS[table](parsed)
            normalized_content = json_bytes(normalized_value)
            files[normalized_path] = normalized_content
            manifest_tables[table].update(
                {
                    "normalizedFile": normalized_path.as_posix(),
                    "normalizedFileSha256": hashlib.sha256(
                        normalized_content
                    ).hexdigest().upper(),
                    "normalizedFileSize": len(normalized_content),
                    "normalizedShape": (
                        "array" if isinstance(normalized_value, list) else "object"
                    ),
                }
            )

    manifest = {
        "schemaVersion": 2,
        "gameVersion": game_version,
        "format": "metaplay-wire-v1",
        "normalizedFormat": "forge-master-semantic-v1",
        "fixedPointScales": {"F1D": F1D_SCALE, "F64": 1 << 32},
        "source": {
            "asset": "assets/SharedGameConfig.mpa",
            "archiveChecksum": archive.checksum,
            "archiveVersion": archive.version,
            "createdAt": archive.created_at,
            "sha256": hashlib.sha256(archive_bytes).hexdigest().upper(),
        },
        "requiredTables": list(REQUIRED_TABLES),
        "optionalTablesIncluded": list(selected_tables[len(REQUIRED_TABLES) :]),
        "tables": manifest_tables,
    }
    files[Path("manifest.json")] = json_bytes(manifest)
    return files


def write_snapshot(output: Path, files: dict[Path, bytes]) -> None:
    for relative_path, content in files.items():
        destination = output / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)


def check_snapshot(output: Path, files: dict[Path, bytes]) -> None:
    expected = set(files)
    actual = {
        path.relative_to(output)
        for path in output.rglob("*")
        if path.is_file()
    } if output.exists() else set()
    errors = [f"missing: {path}" for path in sorted(expected - actual)]
    errors.extend(f"unexpected: {path}" for path in sorted(actual - expected))
    errors.extend(
        f"changed: {path}"
        for path in sorted(expected & actual)
        if (output / path).read_bytes() != files[path]
    )
    if errors:
        raise ValueError("snapshot verification failed\n" + "\n".join(errors))


def verify_oracle(files: dict[Path, bytes], oracle: Path) -> tuple[int, int]:
    object_tables = {
        "MainBattleLibrary",
        "EnemyAgeScalingLibrary",
        "EnemyLibrary",
        "WeaponLibrary",
        "ProjectilesLibrary",
        "StatConfigLibrary",
        "SecondaryStatLibrary",
        "MountLibrary",
    }
    compared_rows = 0
    apk_only_rows = 0
    for table in REQUIRED_TABLES:
        oracle_path = oracle / f"{table}.json"
        expected = json.loads(oracle_path.read_text(encoding="utf-8"))
        if table in object_tables:
            expected = list(expected.values())
        if table == "EnemyAgeScalingLibrary":
            for row in expected:
                row["Damage"]["Value"] = row["Damage"]["Raw"] / F1D_SCALE
                row["Health"]["Value"] = row["Health"]["Raw"] / F1D_SCALE

        generated_path = Path("normalized") / f"{table}.json"
        generated = json.loads(files[generated_path])
        if table == "SecondaryStatLibrary":
            generated_by_stat = {row["Stat"]: row for row in generated}
            for row in expected:
                if generated_by_stat.get(row["Stat"]) != row:
                    raise ValueError(
                        f"community oracle mismatch: {table}/{row['Stat']}"
                    )
            apk_only_rows += len(generated) - len(expected)
            compared_rows += len(expected)
        else:
            if generated != expected:
                raise ValueError(f"community oracle mismatch: {table}")
            compared_rows += len(generated) if isinstance(generated, list) or table == "SkillLibrary" else 1
    return compared_rows, apk_only_rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path, help="SharedGameConfig.mpa or its XAPK")
    parser.add_argument("--game-version", default="2.8.2")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--oracle", type=Path, help="community JSON mapping oracle")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    output = args.output or (
        Path(__file__).resolve().parents[2]
        / "packages"
        / "v4-game-data"
        / "data"
        / args.game_version
    )
    files = build_snapshot(args.archive, args.game_version)
    if args.oracle:
        compared_rows, apk_only_rows = verify_oracle(files, args.oracle)
        print(
            f"community oracle: OK ({compared_rows} rows compared, "
            f"{apk_only_rows} APK-only rows)"
        )
    if args.check:
        check_snapshot(output, files)
        print(
            f"snapshot {args.game_version}: OK "
            f"({len(REQUIRED_TABLES) + len(OPTIONAL_TABLES)} raw, "
            f"{len(NORMALIZERS)} normalized tables)"
        )
    else:
        write_snapshot(output, files)
        print(f"snapshot {args.game_version}: wrote {len(files)} files to {output}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
