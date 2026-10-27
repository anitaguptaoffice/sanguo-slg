import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

from validate_recruit_manifest import MAX_BYTES, MAX_INT64, validate

VERSION = "recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f"
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = ROOT / "spec/data/recruit_manifests" / (VERSION.replace(":", "-") + ".json")


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = ARTIFACT.read_bytes()
        cls.doc = json.loads(cls.raw)

    def reject_doc(self, change):
        doc = copy.deepcopy(self.doc)
        change(doc)
        with self.assertRaises(ValueError):
            validate(json.dumps(doc).encode())

    def test_golden_and_key_order(self):
        self.assertEqual(validate(self.raw), VERSION)
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(),
                         "90499740432ff308e3b7a6f2bd9f54ff5af127d98acc091a4c13af18fc561262")
        self.assertEqual(validate(json.dumps(self.doc, sort_keys=True, indent=4).encode()), VERSION)

    def test_duplicate_original_keys(self):
        for token in (b'"format": 1', b'"unit_cfg_id": 1', b'"food": 40'):
            with self.subTest(token=token):
                changed = self.raw.replace(token, token + b", " + token, 1)
                self.assertNotEqual(changed, self.raw)
                with self.assertRaises(ValueError):
                    validate(changed)

    def test_object_shape(self):
        for path in ((), ("rules", 0), ("rules", 0, "cost_per_unit")):
            for extra in (False, True):
                with self.subTest(path=path, extra=extra):
                    def change(doc):
                        target = doc
                        for key in path:
                            target = target[key]
                        if extra:
                            target["unexpected"] = 1
                        else:
                            del target[next(iter(target))]
                    self.reject_doc(change)
        for key in ("rules", "version", "format"):
            self.reject_doc(lambda doc: doc.__setitem__(key, None))

    def test_integer_grammar(self):
        for value in (True, None, "40", 1.5, 1.0, -1, MAX_INT64 + 1):
            with self.subTest(value=value):
                self.reject_doc(lambda doc: doc["rules"][0]["cost_per_unit"].__setitem__("food", value))
        self.reject_doc(lambda doc: doc.__setitem__("format", True))
        for token in (b"4e1", b"NaN", b"Infinity", b"-Infinity"):
            with self.assertRaises(ValueError):
                validate(self.raw.replace(b'"food": 40', b'"food": ' + token, 1))

    def test_rule_order_and_bounds(self):
        for rules in ([], self.doc["rules"][:3], self.doc["rules"] * 2,
                      self.doc["rules"][::-1], [self.doc["rules"][0]] * 4):
            self.reject_doc(lambda doc: doc.__setitem__("rules", rules))
        for unit in (0, 5, True):
            self.reject_doc(lambda doc: doc["rules"][0].__setitem__("unit_cfg_id", unit))
        for seconds in (0, -1, MAX_INT64 // 1_000_000_000 + 1):
            self.reject_doc(lambda doc: doc["rules"][0].__setitem__("seconds_per_unit", seconds))
        for key in ("wood", "iron", "stone"):
            self.reject_doc(lambda doc: doc["rules"][0]["cost_per_unit"].__setitem__(key, -1))

    def test_version_content_and_representation(self):
        for version in ("", VERSION.upper(), VERSION + "\x00", VERSION + " ", VERSION[:-1] + "0"):
            self.reject_doc(lambda doc: doc.__setitem__("version", version))
        self.reject_doc(lambda doc: doc["rules"][0]["cost_per_unit"].__setitem__("food", 41))
        for raw in (b"\xff", self.raw + b"{}", b"null", b"[]", b"[" * 5000 + b"]" * 5000,
                    b"\xef\xbb\xbf" + self.raw):
            with self.assertRaises(ValueError):
                validate(raw)

    def test_valid_maximum_integers(self):
        doc = copy.deepcopy(self.doc)
        doc["rules"][0]["cost_per_unit"]["food"] = MAX_INT64
        doc["rules"][0]["seconds_per_unit"] = MAX_INT64 // 1_000_000_000
        raw = b"sanguo/recruit-manifest/v1\0"
        for rule in doc["rules"]:
            values = [rule["cost_per_unit"][key] for key in ("food", "wood", "iron", "stone")]
            raw += b"sanguo/recruit-rule/v1\0" + struct.pack(
                ">IQQQQQ", rule["unit_cfg_id"], *values, rule["seconds_per_unit"])
        doc["version"] = "recruit-v1:" + hashlib.sha256(raw).hexdigest()
        self.assertEqual(validate(json.dumps(doc).encode()), doc["version"])

    def test_size_limit_and_read_only_cli(self):
        self.assertEqual(validate(b" " * (MAX_BYTES - len(self.raw)) + self.raw), VERSION)
        with self.assertRaises(ValueError):
            validate(b" " * (MAX_BYTES + 1))
        tool = ROOT / "tools/data/validate_recruit_manifest.py"
        result = subprocess.run([sys.executable, str(tool), str(ARTIFACT)], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(ARTIFACT.read_bytes(), self.raw)
        with tempfile.TemporaryDirectory() as folder:
            wrong = Path(folder) / "wrong.json"
            wrong.write_bytes(self.raw)
            result = subprocess.run([sys.executable, str(tool), str(wrong)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(wrong.read_bytes(), self.raw)


if __name__ == "__main__":
    unittest.main()
