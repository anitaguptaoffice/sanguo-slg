"""Audit one full DOM Go JSON stream against the reviewed fresh-catalog matrix."""
import argparse
import hashlib
import json
import math
from pathlib import Path

PACKAGE = "github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
PREFIX = "TestPGFreshCatalog"
OBJECTS = (
    "player_wallet", "player_wallet_pkey", "city_production_checkpoint",
    "city_production_checkpoint_pkey", "idx_city_production_player",
    "city_building", "city_building_pkey", "idx_city_building_cfg",
)
COLUMNS = (
    "server_id", "city_id", "player_id", "settled_at", "settled_submicro_ns",
    "food_remainder", "wood_remainder", "stone_remainder", "iron_remainder",
)
FAMILIES = {
    "ReadOnly": {f"quoted_{quoted}/seeded_{seeded}"
                 for quoted in ("false", "true") for seeded in ("false", "true")},
    "ExpectedIdentity": {
        "database_name", "database_oid", "schema_name", "schema_oid", "schema_owner",
        "current_name", "current_oid", "session_name", "session_oid",
    } | {f"{name}/{field}" for name in OBJECTS
         for field in ("oid", "owner", "missing", "substituted", "extra")},
    "OperationalErrors": {
        "wrong_binding", "nil_access", "zero_access", "nil_context",
        "canceled", "expired", "ended", "sql_aborted_transaction",
    },
    "HostileShape": {
        "building_varchar_length", "building_collation", "building_default",
        "building_missing_default", "timestamp_not_null", "timestamp_default",
        "extra_column", "dropped_column", "extra_check", "extra_index",
        "view_dependency", "foreign_key_dependency", "rule", "trigger",
        "wallet_default", "building_type", "building_nullable", "building_column_order",
        "building_storage", "index_storage", "checkpoint_extra_column",
        "checkpoint_extra_index", "checkpoint_view_dependency", "checkpoint_outgoing_fk",
        "checkpoint_incoming_fk", "stale_oid_replacement",
    } | {f"{kind}/{column}" for kind in ("checkpoint_type", "checkpoint_default")
         for column in COLUMNS}
      | {f"checkpoint_nullable/{column}" for column in COLUMNS[2:]}
      | {f"{kind}/{column}" for column in COLUMNS[4:] for kind in (
          "check_weakened", "check_missing_lower", "check_missing",
          "check_not_valid", "check_no_inherit")}
      | {f"index/{kind}" for kind in (
          "key_order", "target", "options", "include", "partial", "expression",
          "key_and_opclass", "method", "unique", "primary_order")},
}
EXPECTED = {PREFIX + family for family in FAMILIES}
EXPECTED |= {f"{PREFIX}{family}/{leaf}"
             for family, leaves in FAMILIES.items() for leaf in leaves}
LEGACY = {
    "TestBuildPendingRejectsWithoutMutation",
    "TestBuildPendingAllowsOtherSlotsAndCompletedUpgrade",
    "TestPGPendingBuildConcurrentStaleHubs",
    "TestPGPendingBuildFirstConstructionAndCompletion",
    "TestPGPendingBuildRollbackDoesNotReserveSlot",
}


# Reviewed source/PG matrix from #2446/#2447/#2448, never inferred from a log.
SOURCE_PREFIXES = ("TestPGFreshSource", "TestFreshSource")
SOURCE_FAMILIES = {
    "TestPGFreshSourceConstructorRejects": {
        "store_nil", "pool_nil", "shard_zero", "shard_wrong", "catalog_nil",
        "catalog_invalid", "profile_incomplete", "profile_wrong_database", "hub_nil",
    },
    "TestPGFreshSourceOperationalErrors": {
        "nil_access", "zero_access", "foreign_binding_same_pool", "nil_context",
        "canceled", "expired", "ended", "sql_aborted",
    },
    "TestPGFreshSourceDrift": {
        f"{table}/{kind}" for table in (
            "player_wallet", "city_production_checkpoint", "city_building")
        for kind in ("rename", "column")
    },
    "TestPGFreshSourceWiringReentry": {"wallet", "city"},
    "TestPGFreshSourceCityStageDrift": {"city_production_checkpoint", "city_building"},
    "TestPGFreshSourceBindingReadOnly": {"quoted_false", "quoted_true"},
    "TestPGFreshSourceOrder": {
        f"mask_{mask}/city_{city}" for mask in range(8) for city in ("false", "true")
    } | {"mode_" + mode for mode in (
        "ACCESS_SHARE", "ROW_SHARE", "SHARE_ROW_EXCLUSIVE", "ACCESS_EXCLUSIVE")},
    "TestPGFreshSourceBlockedPins": {
        "wallet_cancel", "checkpoint_cancel", "building_cancel", "checkpoint_lock_timeout",
    },
    "TestPGFreshSourceConcurrentTransactions": set(),
    "TestFreshSourceCatalogCopy": set(),
    "TestFreshSourceConcurrentRetirementCopies": set(),
    "TestFreshSourceFailureClassification": set(),
    "TestFreshSourceInvalidHandles": set(),
    "TestFreshSourcePinPlans": set(),
    "TestFreshSourceWiringRetiresAliases": {
        "catalog_changed", "catalog_nil", "catalog_removed", "pool_nil",
        "pool_replaced", "shard", "store_nil", "store_replaced",
    },
}
SOURCE_EXPECTED = set(SOURCE_FAMILIES) | {
    f"{root}/{leaf}" for root, leaves in SOURCE_FAMILIES.items() for leaf in leaves
}
REQUIRED = EXPECTED | LEGACY | SOURCE_EXPECTED
# Changing these bytes requires source review and an explicitly updated inventory.
SOURCE_HASHES = {
    "fresh_source.go":
        "681e41e673db015fad2d2c90997b80b256477b6436ca2fc9d2c968109f7d0314",
    "fresh_template.go":
        "b5fa58f3a2f876656b21e28bba6334b68aca98b86316e08e88bf9cab7aeb2b8d",
    "fresh_source_test.go":
        "ad9dff2b7c9472ae8bdc60c24d99a7951afeb13883d35f0962ab068c44ec7289",
    "fresh_source_binding_pg_test.go":
        "8c3ab8972575c8b32e11ac17f53acc2fbb143d0cf366d60a3c6b76b10a762ee7",
    "fresh_source_pins_pg_test.go":
        "98e0d79d47ecb55e767997d2918d31daac353d5091c1f8518aee92b358888146",
}


def check_sources(root):
    for name, expected in SOURCE_HASHES.items():
        path = root / "internal/domestic" / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError("unreviewed lifecycle source: " + name)


IDENTITY_FILES = tuple("internal/domestic/" + name for name in (
    "fresh_source_catalog.go", "fresh_city_catalog.go",
    "fresh_source_catalog_test.go", "fresh_source_catalog_pg_test.go",
)) + tuple("internal/domestic/" + name for name in SOURCE_HASHES)


def check_identity(root, tracked, entries, hashes, commit, commit_file):
    raw = Path(commit_file).read_bytes()
    actual = hashlib.sha1(f"commit {len(raw)}\0".encode() + raw).hexdigest()
    if actual != commit:
        raise ValueError("commit object does not match captured identity")
    expected_entries, expected_hashes = [], []
    for name in IDENTITY_FILES:
        path = root / name
        if path.is_symlink() or not path.is_file() or path.stat().st_mode & 0o111:
            raise ValueError("expected regular non-executable source: " + name)
        data = path.read_bytes()
        blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        expected_entries.append(f"100644 blob {blob}\t{name}")
        expected_hashes.append(f"{hashlib.sha256(data).hexdigest()}  {name}")
    for label, actual, expected in (
        ("tracked paths", tracked, IDENTITY_FILES),
        ("commit entries", entries, expected_entries),
        ("source hashes", hashes, expected_hashes),
    ):
        if sorted(actual.splitlines()) != sorted(expected):
            raise ValueError("incomplete or inconsistent identity: " + label)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key: " + key)
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("non-JSON numeric constant: " + value)


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("non-finite JSON number: " + value)
    return number


def check(text):
    states = {}
    started = ended = False
    for line in text.splitlines():
        event = json.loads(line, object_pairs_hook=unique_object,
                           parse_constant=reject_constant, parse_float=finite_float)
        if not isinstance(event, dict) or event.get("Package") != PACKAGE or ended:
            raise ValueError("invalid package/event or event after package pass")
        action, name = event.get("Action"), event.get("Test")
        if action not in ("start", "run", "pause", "cont", "output", "pass"):
            raise ValueError("failed, skipped or unknown action")
        if "Test" in event and (not isinstance(name, str) or not name):
            raise ValueError("invalid test name")
        if action == "start":
            if started or name is not None:
                raise ValueError("duplicate/invalid package start")
            started = True
            continue
        if not started:
            raise ValueError("missing package start")
        if action == "run":
            if name is None or name in states:
                raise ValueError("missing/duplicate test run")
            if name.startswith(PREFIX) and name not in EXPECTED:
                raise ValueError("unknown fresh-catalog family or child: " + name)
            if name.startswith(SOURCE_PREFIXES) and name not in SOURCE_EXPECTED:
                raise ValueError("unknown fresh-source family or child: " + name)
            ancestors = [parent for parent in states if name.startswith(parent + "/")]
            if "/" in name and (not ancestors or any(states[p] != "run" for p in ancestors)):
                raise ValueError("child without live parent: " + name)
            states[name] = "run"
        elif action == "pass" and name is None:
            if any(state != "pass" for state in states.values()):
                raise ValueError("package pass before test completion")
            ended = True
        elif action == "output":
            if not isinstance(event.get("Output"), str):
                raise ValueError("missing or non-string Output")
            if name is not None and states.get(name) not in ("run", "pause"):
                raise ValueError("output without active test")
        else:
            required = "pause" if action == "cont" else "run"
            if name is None or states.get(name) != required:
                raise ValueError("invalid test transition")
            if action == "cont" and any(
                name.startswith(parent + "/") and state != "run"
                for parent, state in states.items()
            ):
                raise ValueError("continue without active parent: " + name)
            if action == "pass" and any(
                child.startswith(name + "/") and state != "pass"
                for child, state in states.items()
            ):
                raise ValueError("parent pass before child completion")
            states[name] = "run" if action == "cont" else action
    missing = REQUIRED - states.keys()
    if not ended or missing:
        raise ValueError(f"incomplete evidence: missing={sorted(missing)}")
    return len(states)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("ordinary", "race"))
    parser.add_argument("log", type=Path)
    args = parser.parse_args()
    check_sources(Path(__file__).resolve().parents[2])
    count = check(args.log.read_text(encoding="utf-8"))
    print(f"PASS {args.mode}: 4 fresh families, 147 leaves, 5 legacy roots; "
          f"62 lifecycle PG names, 14 lifecycle pure names; "
          f"{count} complete tests, one package pass, zero skips/fails")
