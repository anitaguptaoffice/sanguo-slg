#!/usr/bin/env python3
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEN = ROOT / "tools/data/generate_seeds.py"
DATA_DIR = ROOT / "tools/data"


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

    def test_core_subset_caps(self):
        sys.path.insert(0, str(DATA_DIR))
        import generate_seeds as gen

        params = gen.load_yaml(gen.PARAMS)
        heroes_src = gen.load_yaml(gen.SOURCE / "heroes.yml")
        items_src = gen.load_yaml(gen.SOURCE / "items.yml")
        quests_src = gen.load_yaml(gen.SOURCE / "quests.yml")
        shop_src = gen.load_yaml(gen.SOURCE / "shop.yml")
        items = gen.build_items(items_src)
        item_by_code = gen.item_code_index(items)
        quests = gen.build_quests(quests_src, item_by_code)
        shops, _, offers = gen.build_shop_tables(shop_src, item_by_code)
        gen.validate_core_subset(
            gen.build_heroes(heroes_src), items, quests, shops, offers
        )


if __name__ == "__main__":
    unittest.main()
