import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import api_pg_parallel as runner


def events(names):
    rows = [{"Action": action, "Package": runner.ROOT, "Test": name}
            for name in names for action in ("run", "pass")]
    return rows + [{"Action": "pass", "Package": runner.ROOT}]


class ParallelTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "events.json"
        self.names = ["TestAlpha", "TestBeta"]

    def verify(self, rows):
        self.path.write_text("".join(json.dumps(row) + "\n" for row in rows))
        return runner.verify_shard(self.path, self.names)

    def test_discovery_complete_disjoint_deterministic_future_tests(self):
        names = ["TestZ", "TestA", "TestNewOrigin", "FuzzX", "Example", "TestOther"]
        listing = "\n".join(names + [f"ok\t{runner.ROOT}\t0.002s"])
        groups = runner.partition(listing)
        self.assertEqual(sorted(sum(groups, [])), sorted(names))
        self.assertEqual(groups, runner.partition("\n".join(reversed(names))))
        self.assertEqual(len(groups), runner.SHARDS)
        for bad in ("", "TestOne", listing + "\nTestZ", listing + "\nFAIL", "PASS"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                runner.partition(bad)

    def test_commands_keep_both_modes_all_packages_and_exact_anchors(self):
        groups = runner.partition("\n".join("Test" + x for x in "ABCDEFGH"))
        packages = [runner.ROOT, runner.ROOT + "/pb/a", runner.ROOT + "/pb/b"]
        for mode in ("ordinary", "race"):
            plan = runner.commands(mode, groups, packages)
            self.assertEqual(len(plan), 5)
            for index, (command, names) in enumerate(plan):
                self.assertEqual("-race" in command, mode == "race")
                self.assertIn("-count=1", command)
                self.assertIn("-timeout=120m", command)
                self.assertNotIn("-short", command)
                if index < 4:
                    self.assertEqual(command[-1], runner.ROOT)
                    self.assertEqual(command[-2], "^(" + "|".join(names) + ")$")
                else:
                    self.assertEqual(command[-2:], packages[1:])
                    self.assertIsNone(names)
        for bad in ([], packages + [runner.ROOT], packages + ["other/package"]):
            with self.assertRaises(ValueError):
                runner.commands("ordinary", groups, bad)
        with self.assertRaises(ValueError):
            runner.commands("short", groups, packages)

    def test_audit_valid_roots_and_children(self):
        self.assertEqual(self.verify(events(self.names + ["TestAlpha/child"])), 3)

    def test_audit_rejects_incomplete_duplicate_foreign_skip_fail(self):
        good = events(self.names)
        cases = [[], good[:-1], good + [good[-1]], good + [good[0]], good + [good[1]],
                 good[1:], good[:1] + good[2:], events(["TestAlpha"]),
                 events(self.names + ["TestForeign"]), events(self.names + ["TestForeign/child"])]
        for action in ("skip", "fail"):
            cases.append(good + [{"Action": action, "Package": runner.ROOT, "Test": "TestAlpha"}])
        cases.append(good + [{"Action": "output", "Package": "other"}])
        for index, rows in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(ValueError):
                self.verify(rows)
        self.path.write_text("not json\n")
        with self.assertRaises(ValueError):
            runner.verify_shard(self.path, self.names)

    def test_actual_process_exit_timeout_and_raw_evidence(self):
        command = [sys.executable, "-c", "import sys; print('raw evidence'); sys.exit(7)"]
        self.assertEqual(runner.execute(command, self.path, os.environ), 7)
        self.assertEqual(self.path.read_text(), "raw evidence\n")
        with self.assertRaises(subprocess.TimeoutExpired):
            runner.execute([sys.executable, "-c", "import time; time.sleep(10)"],
                           self.path, os.environ, timeout=0.05)

    def test_orchestration_distinct_databases_complete_logs_and_failure(self):
        for fail in (False, True, "exception"):
            destination = Path(self.directory.name) / str(fail)
            observed = []

            def fake_execute(command, path, env):
                observed.append(env["DATABASE_URL"])
                names = command[-2][2:-2].split("|") if "-run" in command else []
                path.write_text("".join(json.dumps(e) + "\n" for e in events(names)))
                if fail == "exception" and path.name == "2.json":
                    raise subprocess.TimeoutExpired(command, 7200)
                return 9 if fail and path.name == "2.json" else 0

            listings = ["\n".join("Test" + x for x in "ABCDEFGH"),
                        runner.ROOT + "\n" + runner.ROOT + "/pb/a\n"]
            output = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
            with patch.object(subprocess, "check_output", side_effect=listings), \
                 patch.object(runner, "execute", side_effect=fake_execute), \
                 contextlib.redirect_stdout(output):
                if fail:
                    with self.assertRaises(ValueError):
                        runner.main("race", destination)
                else:
                    runner.main("race", destination)
            self.assertEqual(len(set(observed)), 5)
            self.assertEqual(set(observed), {
                f"postgres://sanguo:sanguo@localhost:{15432+i if i < 4 else 5432}/api_race_{i}?sslmode=disable"
                for i in range(5)})
            self.assertEqual((destination / "full.json").read_bytes(), b"".join(
                (destination / f"{i}.json").read_bytes() for i in range(5)))
            with self.assertRaises(FileExistsError):
                runner.main("race", destination)


if __name__ == "__main__":
    unittest.main()
