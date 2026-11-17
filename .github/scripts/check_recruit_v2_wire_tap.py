#!/usr/bin/env python3
"""CI-RECRUIT-WIRE-001: fail closed on incomplete Node TAP contract evidence."""
import re
import sys
import unittest
from pathlib import Path

EXPECTED = (
    "exact adopted descriptor and distinct route",
    "all pre-existing message and enum descriptors remain unchanged",
    "request exact bytes and full uint32 versions survive without narrowing",
    "immutable acceptance exact field tags and bytes",
    "signed int64 and int32 extremes are lossless codec values, not admission approval",
    "missing success and malformed frames remain distinguishable",
    "legacy request and response golden bytes unchanged",
)
ACCOUNT_IDENTITY = (
    "one additive field; all baseline account and common descriptors unchanged",
    "fixed legacy bytes and old/new interoperability preserve all old fields",
    "missing and explicit zero both lack usable identity, without breaking entry wire",
    "positive int64 identities use exact tag6 fixtures without Number narrowing",
    "negative int64 values are representable, not valid authenticated identities",
    "truncated field6 varints reject rather than inventing identity",
)
SUMMARY = {"tests": 7, "suites": 0, "pass": 7, "fail": 0,
           "cancelled": 0, "skipped": 0, "todo": 0}


def validate(text, expected=EXPECTED):
    count = len(expected)
    plan = f"1..{count}"
    summary = {**SUMMARY, "tests": count, "pass": count}
    lines = text.splitlines()
    if not lines or lines[0] != "TAP version 13" or sum(
            line.startswith("TAP version") for line in lines) != 1:
        raise ValueError("missing or duplicate TAP header")
    if re.search(r"^\s*(?:not ok\b|Bail out!)|^\s*ok\b[^\n]*#\s*(?:SKIP|TODO)\b", text, re.M | re.I):
        raise ValueError("failed, skipped, todo or bailed-out test")
    result_lines = [line for line in lines if re.match(r"^\s*ok\b", line)]
    if any(not re.fullmatch(r"ok \d+ - .+", line) for line in result_lines):
        raise ValueError("malformed or nested result")
    results = re.findall(r"^ok (\d+) - (.+)$", text, re.M)
    wanted = [(str(i), name) for i, name in enumerate(expected, 1)]
    if results != wanted:
        raise ValueError(f"contract inventory differs: {results!r}")
    plans = [line for line in lines if re.match(r"^\s*\d+\.\.", line)]
    if plans != [plan]:
        raise ValueError(f"missing or invalid final plan: {plans!r}")
    if lines.index(plan) < lines.index(f"ok {count} - " + expected[-1]):
        raise ValueError("plan is not final")
    for key, value in summary.items():
        values = [line for line in lines if re.match(r"^# " + key + r"\b", line)]
        if values != [f"# {key} {value}"] or lines.index(values[0]) < lines.index(plan):
            raise ValueError(f"invalid {key} summary: {values!r}")
    return len(results)


def fixture(expected=EXPECTED):
    count = len(expected)
    summary = {**SUMMARY, "tests": count, "pass": count}
    return "\n".join(["TAP version 13"] +
                     [f"ok {i} - {name}" for i, name in enumerate(expected, 1)] +
                     [f"1..{count}"] + [f"# {k} {v}" for k, v in summary.items()])


class EvidenceGateTests(unittest.TestCase):
    def test_complete(self):
        for expected in (EXPECTED, ACCOUNT_IDENTITY):
            self.assertEqual(validate(fixture(expected), expected), len(expected))

    def test_negative_controls(self):
        for expected in (EXPECTED, ACCOUNT_IDENTITY):
            good = fixture(expected)
            count = len(expected)
            plan = f"1..{count}"
            cases = {
                "missing": good.replace("ok 1 - " + expected[0] + "\n", ""),
                "duplicate": good.replace("ok 2 - " + expected[1], "ok 1 - " + expected[0]),
                "renamed": good.replace(expected[0], "different test"),
                "failed": good.replace("ok 1 -", "not ok 1 -"),
                "skipped": good.replace(expected[0], expected[0] + " # SKIP"),
                "todo": good.replace(expected[0], expected[0] + " # TODO"),
                "cancelled": good.replace("# cancelled 0", "# cancelled 1"),
                "truncated": good.split(plan)[0],
                "plan": good.replace(plan, "1..0"),
                "extra": good.replace(plan, f"ok {count + 1} - surprise\n{plan}"),
                "bail": good + "\nBail out! stopped",
                "summary": good + f"\n# pass {count}",
                "header": good.replace("TAP version 13\n", ""),
                "header_order": good.replace("TAP version 13\n", "") + "\nTAP version 13",
                "malformed_result": good + "\nok 8",
                "malformed_duplicate": good + "\nok 1",
                "malformed_summary": good + "\n# fail nope",
                "early_summary": good.replace(f"# pass {count}", "") .replace(plan, f"# pass {count}\n{plan}"),
                "nested_result": good + "\n  ok 8 - nested",
                "malformed_plan": good + "\n1..nope",
            }
            for name, text in cases.items():
                with self.subTest(suite=len(expected), name=name), self.assertRaises(ValueError):
                    validate(text, expected)



if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        unittest.main(argv=[sys.argv[0]])
    elif len(sys.argv) == 3 and sys.argv[1] == "--account-identity":
        count = validate(Path(sys.argv[2]).read_text(encoding="utf-8"), ACCOUNT_IDENTITY)
        print(f"Verified {count} exact account identity tests; zero skips/failures/todo")
    elif len(sys.argv) == 2:
        count = validate(Path(sys.argv[1]).read_text(encoding="utf-8"))
        print(f"Verified {count} exact Recruit V2 contract tests; zero skips/failures/todo")
    else:
        raise SystemExit("usage: check_recruit_v2_wire_tap.py [--account-identity] TAP_FILE | --self-test")
