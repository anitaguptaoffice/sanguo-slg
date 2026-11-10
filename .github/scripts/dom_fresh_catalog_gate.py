"""Audit one full DOM Go JSON stream against the reviewed fresh-catalog matrix."""
import argparse
import json
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


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key: " + key)
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("non-JSON numeric constant: " + value)


def check(text):
    states = {}
    started = ended = False
    for line in text.splitlines():
        event = json.loads(line, object_pairs_hook=unique_object,
                           parse_constant=reject_constant)
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
            ancestors = [parent for parent in states if name.startswith(parent + "/")]
            if "/" in name and (not ancestors or any(states[p] == "pass" for p in ancestors)):
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
            if action == "pass" and any(
                child.startswith(name + "/") and state != "pass"
                for child, state in states.items()
            ):
                raise ValueError("parent pass before child completion")
            states[name] = "run" if action == "cont" else action
    missing = (EXPECTED | LEGACY) - states.keys()
    if not ended or missing:
        raise ValueError(f"incomplete evidence: missing={sorted(missing)}")
    return len(states)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("ordinary", "race"))
    parser.add_argument("log", type=Path)
    args = parser.parse_args()
    count = check(args.log.read_text(encoding="utf-8"))
    print(f"PASS {args.mode}: 4 fresh families, 147 leaves, 5 legacy roots; "
          f"{count} complete tests, one package pass, zero skips/fails")
