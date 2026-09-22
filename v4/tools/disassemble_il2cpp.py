#!/usr/bin/env python3
"""Disassemble one IL2CPP method and label calls from Cpp2IL script.json."""

from __future__ import annotations

import argparse
import json
import re
import struct
from pathlib import Path

from capstone import CS_ARCH_ARM, CS_MODE_ARM, Cs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    parser.add_argument("script", type=Path)
    parser.add_argument("method", help="Exact or partial Cpp2IL method name")
    args = parser.parse_args()

    payload = json.loads(args.script.read_text(encoding="utf-8"))
    methods = [entry for entry in payload["ScriptMethod"] if entry.get("Address")]
    exact_matches = [entry for entry in methods if args.method == entry["Name"]]
    matches = exact_matches or [entry for entry in methods if args.method in entry["Name"]]
    if len(matches) != 1:
        names = "\n".join(entry["Name"] for entry in matches[:20])
        raise SystemExit(f"expected one method, found {len(matches)}\n{names}")

    method = matches[0]
    start = int(method["Address"])
    next_addresses = sorted({int(entry["Address"]) for entry in methods if int(entry["Address"]) > start})
    stop = next_addresses[0]
    data = args.binary.read_bytes()
    code = data[start:stop]
    names_by_address: dict[int, list[str]] = {}
    for entry in methods:
        names_by_address.setdefault(int(entry["Address"]), []).append(entry["Name"])

    decoder = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    print(f"{method['Name']} 0x{start:X}-0x{stop:X} ({stop - start} bytes)")
    for instruction in decoder.disasm(code, start):
        note = branch_note(instruction.op_str, names_by_address)
        literal = literal_note(instruction.address, instruction.mnemonic, instruction.op_str, data)
        suffix = "".join(f" ; {value}" for value in (note, literal) if value)
        print(f"0x{instruction.address:08X}  {instruction.mnemonic:8} {instruction.op_str}{suffix}")


def branch_note(operand: str, names_by_address: dict[int, list[str]]) -> str:
    match = re.fullmatch(r"#0x([0-9a-f]+)", operand)
    if not match:
        return ""
    names = names_by_address.get(int(match.group(1), 16), [])
    return " | ".join(names)


def literal_note(address: int, mnemonic: str, operand: str, data: bytes) -> str:
    if mnemonic != "ldr":
        return ""
    match = re.search(r"\[pc, #(?:0x)?([0-9a-f]+)\]", operand)
    if not match:
        return ""
    literal_address = address + 8 + int(match.group(1), 16)
    if literal_address + 4 > len(data):
        return ""
    value = struct.unpack_from("<I", data, literal_address)[0]
    return f"[0x{literal_address:X}] = 0x{value:X} ({value})"


if __name__ == "__main__":
    main()
