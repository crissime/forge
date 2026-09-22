#!/usr/bin/env python3
"""Inspect the Metaplay game-config archive embedded in a Forge Master XAPK."""

from __future__ import annotations

import argparse
import io
import json
import struct
import sys
import zipfile
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WIRE_NAMES = {
    0: "Invalid",
    1: "Null",
    2: "VarInt",
    3: "VarInt128",
    4: "F32",
    5: "F32Vec2",
    6: "F32Vec3",
    7: "F64",
    8: "F64Vec2",
    9: "F64Vec3",
    10: "Float32",
    11: "Float64",
    12: "String",
    13: "Bytes",
    14: "AbstractStruct",
    15: "NullableStruct",
    16: "Struct",
    17: "EndStruct",
    18: "ValueCollection",
    19: "KeyValueCollection",
    20: "ObjectTable",
    21: "NullableVarInt",
    22: "NullableVarInt128",
    23: "NullableF32",
    24: "NullableF32Vec2",
    25: "NullableF32Vec3",
    26: "NullableF64",
    27: "NullableF64Vec2",
    28: "NullableF64Vec3",
    29: "NullableFloat32",
    30: "NullableFloat64",
    31: "MetaGuid",
    32: "NullableMetaGuid",
}


class Reader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def read(self, size: int) -> bytes:
        end = self.pos + size
        if end > len(self.data):
            raise ValueError(f"unexpected end at {self.pos}, need {size} bytes")
        value = self.data[self.pos:end]
        self.pos = end
        return value

    def u8(self) -> int:
        return self.read(1)[0]

    def uint(self) -> int:
        value = 0
        shift = 0
        while True:
            byte = self.u8()
            value |= (byte & 0x7F) << shift
            if byte < 0x80:
                return value
            shift += 7
            if shift > 126:
                raise ValueError("varint is too long")

    def sint(self) -> int:
        value = self.uint()
        return (value >> 1) ^ -(value & 1)


@dataclass(frozen=True)
class ArchiveEntry:
    name: str
    checksum: str
    compression: int
    stored_size: int
    data: bytes


@dataclass(frozen=True)
class Archive:
    version: int
    checksum: str
    created_at: str
    entries: tuple[ArchiveEntry, ...]


def load_mpa(path: Path) -> bytes:
    if path.suffix.lower() == ".mpa":
        return path.read_bytes()
    with zipfile.ZipFile(path) as xapk:
        manifest = json.loads(xapk.read("manifest.json"))
        base_name = next(item["file"] for item in manifest["split_apks"] if item["id"] == "base")
        with zipfile.ZipFile(io.BytesIO(xapk.read(base_name))) as base_apk:
            return base_apk.read("assets/SharedGameConfig.mpa")


def parse_archive(data: bytes) -> Archive:
    reader = Reader(data)
    if reader.read(4) != b"MCA!":
        raise ValueError("not a Metaplay config archive")
    version = struct.unpack(">I", reader.read(4))[0]
    checksum = reader.read(16).hex().upper()
    created_ms = struct.unpack(">Q", reader.read(8))[0]
    count = struct.unpack(">I", reader.read(4))[0]
    headers: list[tuple[str, str, int, int]] = []
    for _ in range(count):
        name = reader.read(reader.sint()).decode("utf-8")
        item_checksum = reader.read(16).hex().upper()
        compression, stored_size = struct.unpack(">II", reader.read(8))
        headers.append((name, item_checksum, compression, stored_size))

    entries: list[ArchiveEntry] = []
    for name, item_checksum, compression, stored_size in headers:
        stored = reader.read(stored_size)
        if compression == 0:
            payload = stored
        elif compression == 1:
            payload = zlib.decompress(stored, wbits=-15)
        else:
            raise ValueError(f"unsupported compression {compression} for {name}")
        entries.append(ArchiveEntry(name, item_checksum, compression, stored_size, payload))
    if reader.pos != len(data):
        raise ValueError(f"{len(data) - reader.pos} trailing archive bytes")
    created_at = datetime.fromtimestamp(created_ms / 1000, timezone.utc).isoformat()
    return Archive(version, checksum, created_at, tuple(entries))


def fixed(raw: int, fractional_bits: int) -> dict[str, int | float]:
    return {"raw": raw, "value": raw / (1 << fractional_bits)}


def parse_struct(reader: Reader) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    while True:
        wire = reader.u8()
        if wire == 17:
            return fields
        tag = reader.sint()
        fields[str(tag)] = {"wire": WIRE_NAMES.get(wire, str(wire)), "value": parse_payload(reader, wire)}


def parse_payload(reader: Reader, wire: int) -> Any:
    if wire == 1:
        return None
    if wire in (2, 3):
        return reader.sint()
    if wire == 4:
        return fixed(struct.unpack(">i", reader.read(4))[0], 16)
    if wire == 5:
        return [fixed(struct.unpack(">i", reader.read(4))[0], 16) for _ in range(2)]
    if wire == 6:
        return [fixed(struct.unpack(">i", reader.read(4))[0], 16) for _ in range(3)]
    if wire == 7:
        return fixed(struct.unpack(">q", reader.read(8))[0], 32)
    if wire == 8:
        return [fixed(struct.unpack(">q", reader.read(8))[0], 32) for _ in range(2)]
    if wire == 9:
        return [fixed(struct.unpack(">q", reader.read(8))[0], 32) for _ in range(3)]
    if wire == 10:
        return struct.unpack(">f", reader.read(4))[0]
    if wire == 11:
        return struct.unpack(">d", reader.read(8))[0]
    if wire == 12:
        return reader.read(reader.sint()).decode("utf-8")
    if wire == 13:
        return reader.read(reader.sint()).hex()
    if wire == 14:
        type_code = reader.sint()
        return None if type_code == 0 else {"type": type_code, "fields": parse_struct(reader)}
    if wire == 15:
        return parse_struct(reader) if reader.sint() else None
    if wire == 16:
        return parse_struct(reader)
    if wire == 18:
        count = reader.sint()
        element_wire = reader.u8()
        return [parse_payload(reader, element_wire) for _ in range(count)]
    if wire == 19:
        count = reader.sint()
        key_wire = reader.u8()
        value_wire = reader.u8()
        return [
            [parse_payload(reader, key_wire), parse_payload(reader, value_wire)]
            for _ in range(count)
        ]
    if wire == 20:
        return [parse_struct(reader) for _ in range(reader.sint())]
    if 21 <= wire <= 30:
        if not reader.sint():
            return None
        return parse_payload(reader, wire - 19)
    if wire == 31:
        return reader.read(16).hex()
    if wire == 32:
        return reader.read(16).hex() if reader.sint() else None
    raise ValueError(f"unsupported wire type {wire} at {reader.pos - 1}")


def parse_value(reader: Reader) -> dict[str, Any]:
    wire = reader.u8()
    if wire == 17:
        raise ValueError(f"unexpected EndStruct at {reader.pos - 1}")
    return {"wire": WIRE_NAMES.get(wire, str(wire)), "value": parse_payload(reader, wire)}


def parse_config(data: bytes) -> Any:
    reader = Reader(data)
    result = parse_value(reader)
    if reader.pos != len(data):
        raise ValueError(f"{len(data) - reader.pos} trailing config bytes")
    return result


def self_test() -> None:
    dungeon = bytes.fromhex("0f0202029e0602040411")
    parsed = parse_config(dungeon)
    assert parsed["value"]["1"]["value"] == 399
    assert parsed["value"]["2"]["value"] == 2

    enemy_age = bytes.fromhex("140202020010040202e8071110060202d8361111")
    parsed = parse_config(enemy_age)
    row = parsed["value"][0]
    assert row["1"]["value"] == 0
    assert row["2"]["value"]["1"]["value"] == 500
    assert row["3"]["value"]["1"]["value"] == 3500

    collection = parse_config(bytes.fromhex("120602020406"))
    assert collection["value"] == [1, 2, 3]
    assert parse_config(bytes.fromhex("120007"))["value"] == []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", nargs="?", type=Path)
    parser.add_argument("--entry")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        print("self-test: OK")
        return 0
    if not args.archive:
        parser.error("archive is required unless --self-test is used")

    archive = parse_archive(load_mpa(args.archive))
    if args.entry:
        wanted = args.entry if args.entry.endswith(".mpc") else f"{args.entry}.mpc"
        entry = next((item for item in archive.entries if item.name == wanted), None)
        if not entry:
            raise SystemExit(f"entry not found: {wanted}")
        print(json.dumps(parse_config(entry.data), indent=2, ensure_ascii=True))
        return 0

    print(f"version={archive.version}")
    print(f"checksum={archive.checksum}")
    print(f"created_at={archive.created_at}")
    print(f"entries={len(archive.entries)}")
    for entry in archive.entries:
        print(f"{entry.name}\t{len(entry.data)}\t{entry.compression}\t{entry.checksum}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
