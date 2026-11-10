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
# Closed FCT1 matrix from the reviewed source, never from a passing stream.
CODEC_PREFIXES = ("TestFreshTemplateCodec", "FuzzFreshTemplateCodec")
CODEC_VECTORS = {"minimal-empty", "current-default", "int64-max", "unicode-32"}
CODEC_FAMILIES = {
    "TestFreshTemplateCodecDataContract": set(),
    "TestFreshTemplateCodecFailsClosed": set(),
    "TestFreshTemplateCodecGolden": CODEC_VECTORS,
    "TestFreshTemplateCodecMaximumAndIsolation": set(),
    "TestFreshTemplateCodecCanonicalRoundtrip": set(),
    "TestFreshTemplateCodecDoesNotSelectSemantics": set(),
    "TestFreshTemplateCodecAllTruncations": CODEC_VECTORS,
    "TestFreshTemplateCodecReferenceAndSize": set(),
    "TestFreshTemplateCodecInvalidSnapshots": {
        "existing_city", "negative_city", "zero_actor", "negative_actor",
        "nil_buildings", "nil_building", "zero_cfg", "unknown_cfg", "zero_level",
        "nil_job", "scheduled_job", "settled_epoch", "wallet_checkpoint",
        "saved_wallet", "job_sequence", "remainder", "catalog_mismatch",
        "negative_production", "negative_resource", "large_time",
    } | {f"{kind}-{index}" for kind in ("wallet", "cost") for index in range(4)},
    "TestFreshTemplateCodecMalformedBytes": {
        "magic", "encoding", "embedded_label", "empty_label", "long_label",
        "building_count", "catalog_count", "huge_count", "time_zero",
        "time_overflow", "resource_four", "resource_255", "missing_reference",
        "building_order", "duplicate_slot", "catalog_order", "duplicate_ID",
        "unused_catalog_cost",
    } | {f"signed64-{offset}-{value:x}"
         for offset in (16, 24, 32, 40, 66, 74, 82, 90, 98, 106)
         for value in (1 << 63, (1 << 64) - 1)}
      | {f"positive32-{offset}-{value:x}" for offset in (52, 56, 62)
         for value in (0, 1 << 31, (1 << 32) - 1)}
      | {"slot-" + name for name in (
          "empty", "nul", "bad_utf8", "overlong", "surrogate",
          "above_scalar_range", "truncated_utf8", "33_scalars", "129_bytes")},
    "FuzzFreshTemplateCodec": {f"seed#{index}" for index in range(4)},
}
CODEC_EXPECTED = set(CODEC_FAMILIES) | {
    f"{root}/{leaf}" for root, leaves in CODEC_FAMILIES.items() for leaf in leaves
}
# Complete captured-source method matrix, independent of successful output.
TEMPLATE_SOURCE_PREFIXES = ("TestFreshTemplateSource", "TestPGFreshTemplateSource")
TEMPLATE_CATALOG_CHANGES = {
    "time", "food", "wood", "stone", "iron", "rate", "resource", "removed", "added", "id",
}
TEMPLATE_SOURCE_FAMILIES = {
    "TestFreshTemplateSourceIsolation": set(),
    "TestFreshTemplateSourceCatalogEquality": TEMPLATE_CATALOG_CHANGES,
    "TestFreshTemplateSourceCapturedOnly": set(),
    "TestFreshTemplateSourceInvalidHandles": {
        "binding", "hub", "store", "pool", "shard", "catalog", "retired", "overcount",
    },
    "TestFreshTemplateSourceRejectsData": {
        "digest", "version", "metadata", "label", "truncated", "trailing", "magic", "oversize",
    },
    "TestFreshTemplateSourceEmptyAndLabels": set(),
    "TestFreshTemplateSourceConcurrentCopies": set(),
    "TestPGFreshTemplateSourceDataOnly": {"ordinary", "quoted"},
    "TestPGFreshTemplateSourceNoHubGate": set(),
    "TestPGFreshTemplateSourceReleaseCatalog": TEMPLATE_CATALOG_CHANGES,
    "TestPGFreshTemplateSourceRetainedData": set(),
    "TestPGFreshTemplateSourceRetirement": set(),
}
TEMPLATE_SOURCE_EXPECTED = set(TEMPLATE_SOURCE_FAMILIES) | {
    f"{root}/{leaf}" for root, leaves in TEMPLATE_SOURCE_FAMILIES.items() for leaf in leaves
}
REQUIRED = EXPECTED | LEGACY | SOURCE_EXPECTED | CODEC_EXPECTED | TEMPLATE_SOURCE_EXPECTED
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
    "fresh_template_codec.go":
        "9db858c2b99007326f6861fe42e2f31b6f17ddfb346d51b336f2ac6aab843a72",
    "fresh_template_codec_fuzz_test.go":
        "c51b44ee63bf42ac8b2390fe3291ce2a6b31a96632de9af840c4b147d9be7568",
    "fresh_template_codec_golden_test.go":
        "cb19af9496c39f16ce2436ceca8cc2e043ff00d80e5243e720fc7184e0280b70",
    "fresh_template_codec_negative_test.go":
        "59a1471a9314be70afb37abf19eff76ab9f5c8f03f82e4309caa949284a84cd2",
    "fresh_template_codec_oracle_test.go":
        "9e0b5823a82a8afd2af6dd1b04b170dc45d3b31bc3c86db79ed1af5d66075fb0",
    "fresh_template_codec_test.go":
        "b2cb708728fcfa9d74f1d602293868aa6de96d27e286602a9dda7bc9c4245af9",
    "fresh_template_source.go":
        "116db710ab48a1035b5a52701fe0ae190f969bfc719035730c06f7e3df4d67ab",
    "fresh_template_source_test.go":
        "e94dab9bc808d3b4e229bc3b6755657c1cce93e13d82c40c0012247534f0ea93",
    "fresh_template_source_pg_test.go":
        "e9ff92eae89768d2d8013ce3bd6c3a5897a3e4c888d6848b49f8bbe9d906c57d",
}


FIXTURE_PATH = "spec/rules/fixtures/fresh_city_template_codec_v1.json"
FIXTURE_HASH = "71b001356ade13454be8e9e9deb7f6a0a66041abd2fdf14dcc500192b7ec4259"


def check_sources(root):
    for name, expected in SOURCE_HASHES.items():
        path = root / "internal/domestic" / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError("unreviewed fresh source: " + name)
    if hashlib.sha256((root / FIXTURE_PATH).read_bytes()).hexdigest() != FIXTURE_HASH:
        raise ValueError("unreviewed FCT1 literal fixture")


IDENTITY_FILES = tuple("internal/domestic/" + name for name in (
    "fresh_source_catalog.go", "fresh_city_catalog.go",
    "fresh_source_catalog_test.go", "fresh_source_catalog_pg_test.go",
)) + tuple("internal/domestic/" + name for name in SOURCE_HASHES) + (FIXTURE_PATH,)


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
            if name.startswith(CODEC_PREFIXES) and name not in CODEC_EXPECTED:
                raise ValueError("unknown FCT1 codec family or child: " + name)
            if name.startswith(TEMPLATE_SOURCE_PREFIXES) and name not in TEMPLATE_SOURCE_EXPECTED:
                raise ValueError("unknown captured-template family or child: " + name)
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
          f"107 FCT1 names (11 roots, including four fuzz seeds); "
          f"50 captured-template names (33 pure, 17 constructor PG); "
          f"{count} complete tests, one package pass, zero skips/fails")
