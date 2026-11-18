"""Independent recovery reservations for the enrolled local browser."""

import argparse
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlsplit
from uuid import uuid4


SCHEMA = """
CREATE TABLE enrollment(id TEXT PRIMARY KEY, origin TEXT NOT NULL, gateway TEXT NOT NULL);
CREATE TABLE attempt(
    id TEXT PRIMARY KEY, scope TEXT NOT NULL, command TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('outstanding','granted','consumed','settled')),
    evidence TEXT, outcome TEXT
);
CREATE UNIQUE INDEX active_attempt ON attempt(scope) WHERE state IN ('outstanding','granted');
PRAGMA user_version=1;
"""
KEY = re.compile(r"[0-9a-f]{32}")


def local_url(value, schemes, path):
    url = urlsplit(value)
    if (url.scheme not in schemes or url.hostname not in ("127.0.0.1", "::1", "localhost")
            or not url.port or url.path != path or url.username or url.password
            or url.query or url.fragment or value != f"{url.scheme}://{url.netloc}{path}"):
        raise ValueError("invalid local enrollment URL")


def canonical(values, maxima):
    if (not isinstance(values, list) or len(values) != len(maxima)
            or any(not isinstance(x, str) or not re.fullmatch(r"[1-9][0-9]{0,18}", x)
                   or int(x) > maximum for x, maximum in zip(values, maxima))):
        raise ValueError("invalid numeric identity or intent")
    return json.dumps(values, separators=(",", ":"))


def command_json(values):
    if not isinstance(values, list) or len(values) != 5:
        raise ValueError("invalid command")
    key, version, *intent = values
    if not isinstance(key, str) or not KEY.fullmatch(key) or key == "0" * 32 or version != "1":
        raise ValueError("invalid command")
    canonical(intent, (2**63 - 1, 4, 2**31 - 1))
    return json.dumps(values, separators=(",", ":"))


def open_db(path):
    db = sqlite3.connect(path.as_uri() + "?mode=rw", uri=True, timeout=2, isolation_level=None)
    db.execute("PRAGMA synchronous=FULL")
    if db.execute("PRAGMA journal_mode").fetchone()[0] != "delete":
        db.close()
        raise ValueError("guard requires the enrolled rollback journal")
    db.row_factory = sqlite3.Row
    return db


def initialize(path, origin, gateway):
    local_url(origin, ("http",), "")
    local_url(gateway, ("ws",), "/ws")
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb"):
        pass
    enrollment = uuid4().hex
    with closing(open_db(path)) as db:
        db.executescript(SCHEMA)
        db.execute("INSERT INTO enrollment VALUES(?,?,?)", (enrollment, origin, gateway))
    return enrollment


def file_identity(path):
    st = path.stat()
    return st.st_dev, st.st_ino


class Guard:
    def __init__(self, path):
        self.path = path
        self.file_identity = file_identity(path)
        self.db = open_db(path)
        rows = self.db.execute("SELECT * FROM enrollment").fetchall()
        if (self.db.execute("PRAGMA user_version").fetchone()[0] != 1
                or self.db.execute("PRAGMA quick_check").fetchone()[0] != "ok"
                or len(rows) != 1 or not KEY.fullmatch(rows[0]["id"])):
            raise ValueError("invalid enrolled guard")
        self.enrollment = dict(rows[0])
        local_url(self.enrollment["origin"], ("http",), "")
        local_url(self.enrollment["gateway"], ("ws",), "/ws")
        self.live = set()

    @contextmanager
    def transaction(self):
        if file_identity(self.path) != self.file_identity:
            raise ValueError("enrolled guard file changed")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def execute(self, operation, data):
        if not isinstance(data, dict) or any(data.get(k) != self.enrollment[k] for k in ("id", "gateway")):
            raise ValueError("wrong enrollment")
        scope = canonical(data.get("scope"), (2**63 - 1, 2**31 - 1, 2**53 - 1))
        with self.transaction():
            active = self.db.execute(
                "SELECT id,command,state FROM attempt WHERE scope=? AND state IN ('outstanding','granted')",
                (scope,),
            ).fetchone()
            if operation == "/availability":
                return {"available": active is None}
            if operation == "/reserve":
                saved = command_json(data.get("command"))
                if active:
                    if active["state"] != "granted" or active["command"] != saved:
                        raise ValueError("outstanding reservation")
                    self.db.execute("UPDATE attempt SET state='consumed' WHERE id=?", (active["id"],))
                reservation = uuid4().hex
                self.db.execute("INSERT INTO attempt VALUES(?,?,?,'outstanding',NULL,NULL)",
                                (reservation, scope, saved))
            else:
                reservation, outcome = data.get("reservation"), data.get("outcome")
                if (not isinstance(reservation, str) or reservation not in self.live
                        or not active or active["state"] != "outstanding" or active["id"] != reservation
                        or outcome not in ("accepted", "rejected")):
                    raise ValueError("settlement requires the live attempt")
                self.db.execute("UPDATE attempt SET state='settled',outcome=? WHERE id=?", (outcome, reservation))
        if operation == "/reserve":
            self.live.add(reservation)
            return {"reservation": reservation}
        self.live.discard(reservation)
        return {"settled": True}

    def grant(self, reservation, evidence):
        if not KEY.fullmatch(reservation) or not evidence.strip() or len(evidence) > 512:
            raise ValueError("exact reservation and verified evidence reference required")
        with self.transaction():
            result = self.db.execute(
                "UPDATE attempt SET state='granted',evidence=? WHERE id=? AND state='outstanding'",
                (evidence, reservation),
            )
            if result.rowcount != 1:
                raise ValueError("reservation is not outstanding")


def serve(guard, port):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(4)
            super().setup()

        def reply(self, code, body):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Vary", "Origin")
            if self.headers.get("Origin") == guard.enrollment["origin"]:
                self.send_header("Access-Control-Allow-Origin", guard.enrollment["origin"])
                self.send_header("Access-Control-Allow-Methods", "POST")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def permitted(self):
            return (self.headers.get("Origin") == guard.enrollment["origin"]
                    and self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"
                    and self.path in ("/availability", "/reserve", "/settle"))

        def do_OPTIONS(self):
            self.reply(200 if self.permitted() else 403, {})

        def do_POST(self):
            if not self.permitted() or self.headers.get("Content-Type") != "application/json":
                self.reply(403, {})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1024:
                    raise ValueError("invalid request size")
                result = guard.execute(self.path, json.loads(self.rfile.read(length)))
            except (ValueError, OSError, sqlite3.Error):
                self.reply(409, {"unavailable": True})
                return
            self.reply(200, result)

        def log_message(self, *_):
            pass

    with HTTPServer(("127.0.0.1", port), Handler) as server:
        print(f"http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    commands = parser.add_subparsers(dest="action", required=True)
    init = commands.add_parser("init")
    init.add_argument("origin")
    init.add_argument("gateway")
    run = commands.add_parser("serve")
    run.add_argument("--port", type=int, default=0)
    commands.add_parser("inspect")
    grant = commands.add_parser("grant")
    grant.add_argument("reservation")
    grant.add_argument("evidence")
    args = parser.parse_args()
    path = args.database.resolve()
    if args.action == "init":
        print(initialize(path, args.origin, args.gateway))
        return
    guard = Guard(path)
    with closing(guard.db):
        if args.action == "serve":
            serve(guard, args.port)
        elif args.action == "grant":
            guard.grant(args.reservation, args.evidence)
        else:
            with guard.transaction():
                rows = guard.db.execute("SELECT * FROM attempt ORDER BY rowid").fetchall()
                print(json.dumps({"enrollment": guard.enrollment, "attempts": [dict(row) for row in rows]}))


if __name__ == "__main__":
    main()
