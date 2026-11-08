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
SUMMARY = {"tests": 7, "suites": 0, "pass": 7, "fail": 0,
           "cancelled": 0, "skipped": 0, "todo": 0}


def validate(text):
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
    wanted = [(str(i), name) for i, name in enumerate(EXPECTED, 1)]
    if results != wanted:
        raise ValueError(f"contract inventory differs: {results!r}")
    plans = [line for line in lines if re.match(r"^\s*\d+\.\.", line)]
    if plans != ["1..7"]:
        raise ValueError(f"missing or invalid final plan: {plans!r}")
    if lines.index("1..7") < lines.index("ok 7 - " + EXPECTED[-1]):
        raise ValueError("plan is not final")
    for key, expected in SUMMARY.items():
        values = [line for line in lines if re.match(r"^# " + key + r"\b", line)]
        if values != [f"# {key} {expected}"] or lines.index(values[0]) < lines.index("1..7"):
            raise ValueError(f"invalid {key} summary: {values!r}")
    return len(results)


def fixture():
    return "\n".join(["TAP version 13"] +
                     [f"ok {i} - {name}" for i, name in enumerate(EXPECTED, 1)] +
                     ["1..7"] + [f"# {k} {v}" for k, v in SUMMARY.items()])


class EvidenceGateTests(unittest.TestCase):
    def test_complete(self):
        self.assertEqual(validate(fixture()), 7)

    def test_negative_controls(self):
        good = fixture()
        cases = {
            "missing": good.replace("ok 1 - " + EXPECTED[0] + "\n", ""),
            "duplicate": good.replace("ok 2 - " + EXPECTED[1], "ok 1 - " + EXPECTED[0]),
            "renamed": good.replace(EXPECTED[0], "different test"),
            "failed": good.replace("ok 1 -", "not ok 1 -"),
            "skipped": good.replace(EXPECTED[0], EXPECTED[0] + " # SKIP"),
            "todo": good.replace(EXPECTED[0], EXPECTED[0] + " # TODO"),
            "cancelled": good.replace("# cancelled 0", "# cancelled 1"),
            "truncated": good.split("1..7")[0],
            "plan": good.replace("1..7", "1..6"),
            "extra": good.replace("1..7", "ok 8 - surprise\n1..7"),
            "bail": good + "\nBail out! stopped",
            "summary": good + "\n# pass 7",
            "header": good.replace("TAP version 13\n", ""),
            "header_order": good.replace("TAP version 13\n", "") + "\nTAP version 13",
            "malformed_result": good + "\nok 8",
            "malformed_duplicate": good + "\nok 1",
            "malformed_summary": good + "\n# fail nope",
            "early_summary": good.replace("# pass 7", "") .replace("1..7", "# pass 7\n1..7"),
            "nested_result": good + "\n  ok 8 - nested",
            "malformed_plan": good + "\n1..nope",
        }
        for name, text in cases.items():
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate(text)


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        unittest.main(argv=[sys.argv[0]])
    elif len(sys.argv) == 2:
        count = validate(Path(sys.argv[1]).read_text(encoding="utf-8"))
        print(f"Verified {count} exact Recruit V2 contract tests; zero skips/failures/todo")
    else:
        raise SystemExit("usage: check_recruit_v2_wire_tap.py TAP_FILE | --self-test")
