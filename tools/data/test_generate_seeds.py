#!/usr/bin/env python3
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEN = ROOT / "tools/data/generate_seeds.py"


class GenerateSeedsTest(unittest.TestCase):
    def run_gen(self, *extra: str):
        return subprocess.run(
            [sys.executable, str(GEN), *extra], cwd=ROOT, capture_output=True, text=True
        )

    def test_idempotent(self):
        self.assertEqual(self.run_gen().returncode, 0)
        r = self.run_gen()
        self.assertEqual(r.returncode, 0)
        self.assertIn("unchanged", r.stdout)

    def test_check(self):
        self.run_gen()
        r = self.run_gen("--check")
        self.assertEqual(r.returncode, 0)
        self.assertIn("check ok", r.stdout)


if __name__ == "__main__":
    unittest.main()
