import concurrent.futures
from contextlib import contextmanager
import json
from pathlib import Path
import select
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen


SCRIPT = Path(__file__).with_name("recruit_recovery_guard.py")
ORIGIN = "http://127.0.0.1:5173"
GATEWAY = "ws://127.0.0.1:8080/ws"
SCOPE = ["9223372036854775807", "1", "9007199254740991"]
COMMAND = ["ab" * 16, "1", "9223372036854775807", "4", "420"]


class RecoveryGuardTest(unittest.TestCase):
    def setUp(self):
        fixture = tempfile.TemporaryDirectory()
        self.addCleanup(fixture.cleanup)
        self.database = Path(fixture.name) / "guard.db"
        self.enrollment = self.cmd("init", ORIGIN, GATEWAY).stdout.strip()
        self.request = {"id": self.enrollment, "gateway": GATEWAY, "scope": SCOPE}

    def cmd(self, *args, check=True):
        return subprocess.run([sys.executable, SCRIPT, self.database, *args], text=True,
                              capture_output=True, check=check, timeout=5)

    @contextmanager
    def server(self):
        with subprocess.Popen([sys.executable, SCRIPT, self.database, "serve"],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as child:
            try:
                self.assertTrue(select.select([child.stdout], [], [], 5)[0], "guard did not announce a listener")
                url = child.stdout.readline().strip()
                self.assertRegex(url, r"^http://127\.0\.0\.1:[0-9]+$")
                yield url
            finally:
                child.kill()  # Owned process. Verify SQLite committed state after abrupt termination.
                child.wait(5)

    def call(self, url, path, origin=ORIGIN, **data):
        body = json.dumps(self.request | data).encode()
        req = Request(url + path, body, headers={"Origin": origin, "Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=3) as response:
                self.assertEqual(response.headers["Access-Control-Allow-Origin"], ORIGIN)
                return response.status, json.load(response)
        except HTTPError as err:
            with err:
                return err.code, json.load(err)

    def test_fresh_guard_and_fail_closed_origins(self):
        with self.server() as url:
            self.assertEqual(self.call(url, "/availability"), (200, {"available": True}))
            self.assertEqual(self.call(url, "/reserve", "http://127.0.0.1:1", command=COMMAND)[0], 403)
            self.assertEqual(self.call(url, "/reserve", command=COMMAND, id="b" * 32)[0], 409)
            self.assertEqual(self.call(url, "/reserve", command=COMMAND, gateway="ws://127.0.0.1:1/ws")[0], 409)
            self.assertEqual(self.call(url, "/reserve", command=COMMAND, scope=["01", "1", "1"])[0], 409)
            self.assertEqual(self.call(url, "/grant", reservation="b" * 32)[0], 403)
            self.assertEqual(json.loads(self.cmd("inspect").stdout)["attempts"], [])
            self.database.unlink()  # This isolated fixture owns the file.
            self.assertEqual(self.call(url, "/reserve", command=COMMAND)[0], 409)
        self.assertNotEqual(self.cmd("inspect", check=False).returncode, 0)
        self.assertFalse(self.database.exists())

    def test_crash_exact_recovery_concurrency_and_terminal_settlement(self):
        with self.server() as first, self.server() as second:
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                results = list(pool.map(lambda u: self.call(u, "/reserve", command=COMMAND), [first, second]))
            self.assertEqual(sorted(status for status, _ in results), [200, 409])
            original = next(value["reservation"] for status, value in results if status == 200)
        with self.server() as after_restart:
            self.assertEqual(self.call(after_restart, "/availability"), (200, {"available": False}))
            self.assertEqual(self.call(after_restart, "/reserve", command=COMMAND)[0], 409)
            self.assertEqual(self.call(after_restart, "/settle", reservation=original, outcome="accepted")[0], 409)
            self.cmd("grant", original, "owned-suite: independently reconciled exact fixture")
            self.assertEqual(self.call(after_restart, "/reserve", command=COMMAND[:-1] + ["421"])[0], 409)
            status, result = self.call(after_restart, "/reserve", command=COMMAND)
            self.assertEqual(status, 200)
            retry = result["reservation"]
            self.assertNotEqual(original, retry)
            self.assertEqual(self.call(after_restart, "/reserve", command=COMMAND)[0], 409)
            self.assertNotEqual(self.cmd("grant", original, "stale", check=False).returncode, 0)
            self.assertEqual(self.call(after_restart, "/settle", reservation=original, outcome="accepted")[0], 409)
            self.assertEqual(self.call(after_restart, "/settle", reservation=retry, outcome="unknown")[0], 409)
            self.assertEqual(self.call(after_restart, "/settle", reservation=retry, outcome="accepted"),
                             (200, {"settled": True}))
            self.assertEqual(self.call(after_restart, "/availability"), (200, {"available": True}))
        rows = json.loads(self.cmd("inspect").stdout)["attempts"]
        self.assertEqual([row["state"] for row in rows], ["consumed", "settled"])
        self.assertEqual(rows[0]["evidence"], "owned-suite: independently reconciled exact fixture")
        self.assertEqual(rows[0]["command"], rows[1]["command"])
        with self.server() as continuing:
            distinct = ["cd" * 16, *COMMAND[1:]]
            status, result = self.call(continuing, "/reserve", command=distinct)
            self.assertEqual(status, 200)
            self.assertEqual(self.call(continuing, "/settle", reservation=result["reservation"], outcome="rejected"),
                             (200, {"settled": True}))


if __name__ == "__main__":
    unittest.main()
