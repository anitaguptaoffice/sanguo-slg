import json
import unittest

import dom_fresh_catalog_gate as gate


def event(action, name=None, **extra):
    row = {"Action": action, "Package": gate.PACKAGE, **extra}
    if name is not None:
        row["Test"] = name
    return row


def sample():
    rows = [event("start")]
    for root in sorted({name.split("/")[0] for name in gate.EXPECTED | gate.LEGACY}):
        rows.append(event("run", root))
        for child in sorted(name for name in gate.EXPECTED if name.startswith(root + "/")):
            rows.extend([event("run", child), event("pass", child)])
        rows.append(event("pass", root))
    return rows + [event("pass")]


def encode(rows):
    return "\n".join(json.dumps(row) for row in rows) + "\n"


class EvidenceTests(unittest.TestCase):
    def reject(self, rows):
        with self.assertRaises(ValueError):
            gate.check(encode(rows))

    def test_source_inventory_and_other_dom_tests(self):
        self.assertEqual({name: len(leaves) for name, leaves in gate.FAMILIES.items()},
                         {"ReadOnly": 4, "ExpectedIdentity": 49,
                          "OperationalErrors": 8, "HostileShape": 86})
        self.assertEqual(len(gate.EXPECTED), 151)
        self.assertEqual(gate.check(encode(sample())), 156)
        other = [event("run", "TestOther"), event("pause", "TestOther"),
                 event("cont", "TestOther"), event("run", "TestOther/a/b"),
                 event("output", "TestOther/a/b", Output='{"Action":"pass"}\n'),
                 event("pass", "TestOther/a/b"), event("pass", "TestOther")]
        self.assertEqual(gate.check(encode(sample()[:-1] + other + sample()[-1:])), 158)

    def test_every_required_name_needs_one_run_and_pass(self):
        good = sample()
        for name in sorted(gate.EXPECTED | gate.LEGACY):
            for action in ("run", "pass", "both"):
                with self.subTest(name=name, action=action):
                    self.reject([row for row in good if not (
                        row.get("Test") == name and
                        (action == "both" or row["Action"] == action))])

    def test_duplicate_run_pass_and_run_after_pass(self):
        good = sample()
        for action in ("run", "pass"):
            index = next(i for i, row in enumerate(good) if row["Action"] == action and row.get("Test"))
            self.reject(good[:index] + [good[index]] + good[index:])
        self.reject(good[:-1] + [next(row for row in good if row["Action"] == "run")] + good[-1:])

    def test_package_framing_and_bad_json(self):
        good = sample()
        for rows in ([], good[1:], good[:-1], good + [good[-1]], good + good,
                     good[:1] + [good[0]] + good[1:], [event("pass")],
                     [dict(row, Package="wrong") for row in good]):
            self.reject(rows)
        for text in ("", "{", "[]\n", "null\n", "\n", encode(good) + "{",
                     encode(good)[:-3]):
            with self.subTest(text=text[:30]), self.assertRaises(ValueError):
                gate.check(text)

    def test_skip_fail_unknown_name_and_action(self):
        good = sample()
        for action in ("skip", "fail", "unknown", None, []):
            for name in (None, "TestOther"):
                self.reject(good[:-1] + [event(action, name)] + good[-1:])
        for name in (gate.PREFIX + "Unknown", gate.PREFIX + "ReadOnly/unknown",
                     gate.PREFIX + "ReadOnly/quoted_false"):
            self.reject(good[:-1] + [event("run", name), event("pass", name)] + good[-1:])
        for name in ("", 1, [], None):
            self.reject(good[:-1] + [dict(event("pass"), Test=name)] + good[-1:])

    def test_output_is_not_evidence(self):
        good = sample()
        name = gate.PREFIX + "OperationalErrors/ended"
        fake = [event("output", Output=encode([row])) if row.get("Test") == name else row
                for row in good]
        self.reject(fake)
        self.reject(good[:-1] + [event("output", "TestNeverRun")] + good[-1:])
        self.reject(good[:-1] + [event("output", name)] + good[-1:])

    def test_duplicate_json_keys_and_output_schema(self):
        good = sample()
        for key, first, row in (
            ("Action", "fail", good[-1]),
            ("Package", "wrong", good[-1]),
            ("Test", "TestWrong", good[2]),
            ("Output", {"Action": "pass"}, event("output", Output="message")),
        ):
            duplicate = "{" + json.dumps(key) + ":" + json.dumps(first) + "," + json.dumps(row)[1:]
            if key == "Output":
                text = encode(good[:1]) + duplicate + "\n" + encode(good[1:])
            else:
                text = encode(good).replace(json.dumps(row), duplicate, 1)
            with self.subTest(key=key), self.assertRaises(ValueError):
                gate.check(text)
        for output in (None, {}, [], 1, True):
            self.reject(good[:-1] + [event("output", Output=output)] + good[-1:])
        self.reject(good[:-1] + [event("output")] + good[-1:])
        nested = '{"Action":"output","Package":' + json.dumps(gate.PACKAGE)
        nested += ',"Output":{"x":1,"x":2}}\n'
        with self.assertRaisesRegex(ValueError, "duplicate JSON key"):
            gate.check(encode(good[:1]) + nested + encode(good[1:]))

    def test_parent_child_order_and_parallel_transitions(self):
        good = sample()
        root, child = "TestOther", "TestOther/child"
        cases = [
            [event("run", child), event("pass", child)],
            [event("run", root), event("pass", root), event("run", child), event("pass", child)],
            [event("run", root), event("run", child), event("pass", root), event("pass", child)],
            [event("run", root), event("run", child), event("pass", child),
             event("run", child + "/late")],
            [event("run", root)],
            [event("pause", root)],
            [event("run", root), event("cont", root)],
            [event("run", root), event("pause", root), event("pause", root)],
            [event("run", root), event("pause", root), event("pass", root)],
            [event("run", root), event("pass", root), event("pause", root)],
            [event("run", root), event("pass", root), event("cont", root)],
        ]
        for index, rows in enumerate(cases):
            with self.subTest(index=index):
                self.reject(good[:-1] + rows + good[-1:])
        for action in ("run", "pause", "cont"):
            self.reject(good[:-1] + [event(action)] + good[-1:])

    def test_non_json_numeric_constants(self):
        good = sample()
        for constant in ("NaN", "Infinity", "-Infinity"):
            for field in ('"Elapsed":' + constant,
                          '"Metadata":{"value":' + constant + '}'):
                text = encode(good[:-1]) + json.dumps(good[-1])[:-1] + "," + field + "}\n"
                with self.subTest(constant=constant, field=field), self.assertRaises(ValueError):
                    gate.check(text)
            literal = event("output", Output=constant)
            self.assertEqual(gate.check(encode(good[:-1] + [literal] + good[-1:])), 156)


if __name__ == "__main__":
    unittest.main()
