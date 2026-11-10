import hashlib
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest

import dom_fresh_catalog_gate as gate


def event(action, name=None, **extra):
    row = {"Action": action, "Package": gate.PACKAGE, **extra}
    if name is not None:
        row["Test"] = name
    return row


def sample():
    rows = [event("start")]
    for root in sorted({name.split("/")[0] for name in gate.REQUIRED}):
        rows.append(event("run", root))
        for child in sorted(name for name in gate.REQUIRED if name.startswith(root + "/")):
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
        self.assertEqual(gate.check(encode(sample())), 339)
        other = [event("run", "TestOther"), event("pause", "TestOther"),
                 event("cont", "TestOther"), event("run", "TestOther/a/b"),
                 event("output", "TestOther/a/b", Output='{"Action":"pass"}\n'),
                 event("pass", "TestOther/a/b"), event("pass", "TestOther")]
        self.assertEqual(gate.check(encode(sample()[:-1] + other + sample()[-1:])), 341)

    def test_every_required_name_needs_one_run_and_pass(self):
        good = sample()
        for name in sorted(gate.REQUIRED):
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
            self.assertEqual(gate.check(encode(good[:-1] + [literal] + good[-1:])), 339)


    def test_lifecycle_closed_names(self):
        self.assertEqual(len(gate.SOURCE_EXPECTED), 76)
        good = sample()
        for name in sorted(gate.SOURCE_EXPECTED):
            for action in ("skip", "fail"):
                with self.subTest(name=name, action=action):
                    self.reject([dict(row, Action=action) if row.get("Test") == name
                                 and row["Action"] == "pass" else row for row in good])
            # Invented descendants also fail even with an existing live ancestor.
            index = next(i for i, row in enumerate(good)
                         if row.get("Test") == name and row["Action"] == "run") + 1
            unknown = name + "/unreviewed"
            self.reject(good[:index] + [event("run", unknown), event("pass", unknown)]
                        + good[index:])
            # A textual PASS cannot replace a required lifecycle execution.
            self.reject([event("output", Output=json.dumps(row))
                         if row.get("Test") == name else row for row in good])
        for prefix in gate.SOURCE_PREFIXES:
            self.reject(good[:-1] + [event("run", prefix + "Unreviewed"),
                                    event("pass", prefix + "Unreviewed")] + good[-1:])

    def test_lifecycle_source_identity_is_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            domestic = root / "internal/domestic"
            domestic.mkdir(parents=True)
            content = b"fixture bytes, not Go or execution evidence\n"
            hashes = {name: hashlib.sha256(content).hexdigest() for name in gate.SOURCE_HASHES}
            with patch.dict(gate.SOURCE_HASHES, hashes, clear=True):
                for name in hashes:
                    (domestic / name).write_bytes(content)
                fixture = root / gate.FIXTURE_PATH
                fixture.parent.mkdir(parents=True)
                fixture.write_bytes((Path(__file__).resolve().parents[2] / gate.FIXTURE_PATH).read_bytes())
                gate.check_sources(root)
                for name in hashes:
                    with self.subTest(name=name):
                        path = domestic / name
                        path.unlink()
                        with self.assertRaises(FileNotFoundError):
                            gate.check_sources(root)
                        path.write_bytes(content + b"unreviewed change")
                        with self.assertRaisesRegex(ValueError, "unreviewed fresh source"):
                            gate.check_sources(root)
                        path.write_bytes(content)
                gate.check_sources(root)


    def test_overflow_numbers_and_finite_values(self):
        good = sample()
        targets = (None, gate.PREFIX + "ReadOnly", "TestPGFreshSourceOrder",
                   "TestFreshSourcePinPlans")
        for target in targets:
            row = next(row for row in good if row.get("Test") == target)
            for number in ("1e999", "-1e999", "1e308", "-1e308", "0.0"):
                for field in ('"Elapsed":' + number,
                              '"Metadata":{"nested":[{"value":' + number + '}]}'):
                    changed = json.dumps(row)[:-1] + "," + field + "}"
                    text = encode(good).replace(json.dumps(row), changed, 1)
                    with self.subTest(target=target, number=number, field=field):
                        if "999" in number:
                            with self.assertRaises(ValueError):
                                gate.check(text)
                        else:
                            self.assertEqual(gate.check(text), 339)
                literal = event("output", Output=number)
                self.assertEqual(gate.check(encode(good[:-1] + [literal] + good[-1:])), 339)

    def test_parallel_ancestors_must_be_active(self):
        good = sample()
        root, child = "TestOther", "TestOther/literal/slash"
        invalid = [
            [event("run", root), event("pause", root), event("run", child)],
            [event("run", root), event("run", child), event("pause", child),
             event("pause", root), event("cont", child)],
        ]
        for rows in invalid:
            self.reject(good[:-1] + rows + [event("pass", child), event("cont", root),
                                          event("pass", root)] + good[-1:])
        # Go can pause a parallel child, then its parent; resume parent first.
        valid = [event("run", root), event("run", child), event("pause", child),
                 event("pause", root), event("cont", root), event("cont", child),
                 event("pass", child), event("pass", root)]
        self.assertEqual(gate.check(encode(good[:-1] + valid + good[-1:])), 341)


    def test_codec_closed_inventory_and_every_outcome(self):
        self.assertEqual(len(gate.CODEC_FAMILIES), 11)
        self.assertEqual(len(gate.CODEC_EXPECTED), 107)
        self.assertEqual(gate.CODEC_FAMILIES["FuzzFreshTemplateCodec"],
                         {"seed#0", "seed#1", "seed#2", "seed#3"})
        self.assertEqual(len(gate.IDENTITY_FILES), 16)
        self.assertEqual(sum(name.endswith(".go") for name in gate.IDENTITY_FILES), 15)
        good = sample()
        for name in sorted(gate.CODEC_EXPECTED):
            for action in ("skip", "fail"):
                self.reject([dict(row, Action=action) if row.get("Test") == name
                             and row["Action"] == "pass" else row for row in good])
            for action in ("run", "pass"):
                index = next(i for i, row in enumerate(good)
                             if row.get("Test") == name and row["Action"] == action)
                self.reject(good[:index] + [good[index]] + good[index:])
            index = next(i for i, row in enumerate(good)
                         if row.get("Test") == name and row["Action"] == "run") + 1
            unknown = name + "/unreviewed"
            self.reject(good[:index] + [event("run", unknown), event("pass", unknown)]
                        + good[index:])
            self.reject([event("output", Output=json.dumps(row))
                         if row.get("Test") == name else row for row in good])
        for name in ("TestFreshTemplateCodecUnknown", "FuzzFreshTemplateCodecUnknown",
                     "FuzzFreshTemplateCodec/seed#4"):
            self.reject(good[:-1] + [event("run", name), event("pass", name)] + good[-1:])

    def test_literal_fixture_identity_is_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = root / gate.FIXTURE_PATH
            fixture.parent.mkdir(parents=True)
            original = (Path(__file__).resolve().parents[2] / gate.FIXTURE_PATH).read_bytes()
            with patch.dict(gate.SOURCE_HASHES, {}, clear=True):
                with self.assertRaises(FileNotFoundError):
                    gate.check_sources(root)
                for data in (b"", original[:-1], original + b"\n", original.replace(b"493", b"494")):
                    fixture.write_bytes(data)
                    with self.assertRaisesRegex(ValueError, "literal fixture"):
                        gate.check_sources(root)
                fixture.write_bytes(original)
                gate.check_sources(root)

    def test_exact_source_identity_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entries, hashes = [], []
            for name in gate.IDENTITY_FILES:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(name.encode())
                data = path.read_bytes()
                blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
                entries.append(f"100644 blob {blob}\t{name}")
                hashes.append(f"{hashlib.sha256(data).hexdigest()}  {name}")
            good = [list(gate.IDENTITY_FILES), entries, hashes]
            metadata = root / "commit.raw"
            raw = b"synthetic commit bytes, not execution evidence\n"
            metadata.write_bytes(raw)
            commit = hashlib.sha1(f"commit {len(raw)}\0".encode() + raw).hexdigest()
            gate.check_identity(root, *("\n".join(rows) for rows in good), commit, metadata)
            for index, rows in enumerate(good):
                mutations = [[], rows[:-1], rows + rows[:1], rows[:-1] + rows[:1],
                             ["malformed"] + rows[1:], rows + ["unexpected"]]
                for changed in mutations:
                    bad = [list(values) for values in good]
                    bad[index] = changed
                    with self.subTest(index=index, changed=changed), self.assertRaises(ValueError):
                        gate.check_identity(root, *("\n".join(values) for values in bad), commit, metadata)
            for name in gate.IDENTITY_FILES:
                path = root / name
                path.write_bytes(b"different working-tree bytes")
                with self.subTest(name=name), self.assertRaises(ValueError):
                    gate.check_identity(root, *("\n".join(rows) for rows in good), commit, metadata)
                path.write_bytes(name.encode())
            path = root / gate.IDENTITY_FILES[0]
            path.chmod(0o755)
            with self.assertRaisesRegex(ValueError, "expected regular"):
                gate.check_identity(root, *("\n".join(rows) for rows in good), commit, metadata)
            path.unlink()
            path.symlink_to(root / gate.IDENTITY_FILES[1])
            with self.assertRaisesRegex(ValueError, "expected regular"):
                gate.check_identity(root, *("\n".join(rows) for rows in good), commit, metadata)
            metadata.write_bytes(raw.rstrip(b"\n"))
            with self.assertRaisesRegex(ValueError, "commit object"):
                gate.check_identity(root, *("\n".join(rows) for rows in good), commit, metadata)


if __name__ == "__main__":
    unittest.main()
