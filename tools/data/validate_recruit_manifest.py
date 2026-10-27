"""Offline integrity validation, not approval to trust or activate an artifact."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct

MAX_BYTES = 65536
MAX_INT64 = (1 << 63) - 1
VERSION = re.compile(r"recruit-v1:[0-9a-f]{64}")


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _noninteger(_token):
    raise ValueError("non-integer JSON number")


def _fields(value, names):
    if type(value) is not dict or set(value) != set(names):
        raise ValueError("missing or extra object field")


def _integer(value, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError("integer type/range mismatch")
    return value


def validate(raw: bytes) -> str:
    """Validate original UTF-8 bytes before normalization; never repair input."""
    if type(raw) is not bytes or len(raw) > MAX_BYTES:
        raise ValueError("bytes input exceeds offline validator limit")
    try:
        doc = json.loads(raw.decode("utf-8"), object_pairs_hook=_object,
                         parse_float=_noninteger, parse_constant=_noninteger)
    except RecursionError as exc:
        raise ValueError("JSON nesting exceeds offline validator limit") from exc
    _fields(doc, ("format", "version", "rules"))
    _integer(doc["format"], 1, 1)
    version = doc["version"]
    if type(version) is not str or VERSION.fullmatch(version) is None:
        raise ValueError("version grammar mismatch")
    rules = doc["rules"]
    if type(rules) is not list or len(rules) != 4:
        raise ValueError("exactly four ordered rules required")
    canonical = bytearray(b"sanguo/recruit-manifest/v1\x00")
    for unit, rule in enumerate(rules, 1):
        _fields(rule, ("unit_cfg_id", "cost_per_unit", "seconds_per_unit"))
        _integer(rule["unit_cfg_id"], unit, unit)
        costs = rule["cost_per_unit"]
        _fields(costs, ("food", "wood", "iron", "stone"))
        values = [_integer(costs[key], 0, MAX_INT64)
                  for key in ("food", "wood", "iron", "stone")]
        seconds = _integer(rule["seconds_per_unit"], 1, MAX_INT64 // 1_000_000_000)
        canonical.extend(b"sanguo/recruit-rule/v1\x00")
        canonical.extend(struct.pack(">IQQQQQ", unit, *values, seconds))
    expected = "recruit-v1:" + hashlib.sha256(canonical).hexdigest()
    if version != expected:
        raise ValueError("manifest version/content mismatch")
    return version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    try:
        # Bound the read too; do not allocate an unbounded file before checking.
        with args.manifest.open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
        version = validate(raw)
        if args.manifest.name != version.replace(":", "-", 1) + ".json":
            raise ValueError("filename/version mismatch")
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(f"PASS {version} rules=4 sha256={hashlib.sha256(raw).hexdigest()}")


if __name__ == "__main__":
    main()
