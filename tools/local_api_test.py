#!/usr/bin/env python3
"""Run all API tests locally against uniquely owned, disposable PostgreSQL."""
import argparse
import concurrent.futures
import importlib.util
import hashlib
import json
import os
import re
import signal
import sys
import threading
from pathlib import Path
import subprocess
import time
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
ENV = dict(os.environ)
ENV["GOFLAGS"] = " "  # Nonempty whitespace overrides persisted Go flags with zero flags.
ACTIVE = set()
LOCK = threading.RLock()
CANCELED = threading.Event()


def cancel(_signal=None, _frame=None):
    CANCELED.set()
    with LOCK:
        for process in list(ACTIVE):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


def execute(args, path, env):
    with path.open("w") as output:
        with LOCK:
            if CANCELED.is_set():
                return -1
            process = subprocess.Popen(args, cwd=ROOT, env=env, stdout=output,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            ACTIVE.add(process)
        try:
            return process.wait(timeout=2400)
        except BaseException:
            with LOCK:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait()
            raise
        finally:
            with LOCK:
                ACTIVE.discard(process)



def command(args, **kwargs):
    return subprocess.check_output(args, cwd=ROOT, env=ENV, text=True, **kwargs).strip()


def load_gate(jobs):
    spec = importlib.util.spec_from_file_location(
        "api_gate", ROOT / ".github/scripts/api_pg_parallel.py")
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    gate.SHARDS = jobs
    return gate


def discover_children(packages, flags, evidence):
    inventories = {}
    for package in packages:
        listing = command(["go", "test", *flags, package, "-list", "."])
        names = []
        for line in listing.splitlines():
            if re.fullmatch(r"(?:Test|Example|Fuzz)\w*", line):
                names.append(line)
            elif not (re.fullmatch(r"ok\s+" + re.escape(package) + r"\s+.+", line) or
                      re.fullmatch(r"\?\s+" + re.escape(package) + r"\s+\[no test files\]", line)):
                raise ValueError(f"Unexpected child inventory: {line!r}")
        if len(names) != len(set(names)):
            raise ValueError("Duplicate child test inventory")
        inventories[package] = names
    (evidence / "child-inventory.json").write_text(json.dumps(inventories, indent=2) + "\n")
    return inventories


def verify_children(path, inventories):
    events = [json.loads(line) for line in path.read_text().splitlines()]
    if not events or any(e.get("Package") not in inventories for e in events):
        raise ValueError("Missing or foreign child-package evidence")
    if any(e["Action"] == "fail" or (e["Action"] == "skip" and e.get("Test")) for e in events):
        raise ValueError("Failed or skipped child test")
    for package, names in inventories.items():
        rows = [e for e in events if e["Package"] == package]
        terminals = [e["Action"] for e in rows if not e.get("Test")
                     and e["Action"] in {"pass", "skip", "fail"}]
        if terminals != (["pass"] if names else ["skip"]):
            raise ValueError("Invalid child-package terminal")
        if not names and not any("[no test files]" in e.get("Output", "") for e in rows):
            raise ValueError("Empty child package lacks no-test evidence")
        runs = [e["Test"] for e in rows if e["Action"] == "run" and e.get("Test")]
        passes = [e["Test"] for e in rows if e["Action"] == "pass" and e.get("Test")]
        if sorted(runs) != sorted(passes) or len(runs) != len(set(runs)):
            raise ValueError("Incomplete or duplicate child tests")
        if sorted(n for n in runs if "/" not in n) != sorted(names):
            raise ValueError("Missing or unexpected child root")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["ordinary", "race"])
    parser.add_argument("evidence", type=Path, help="new directory; never overwrite a run")
    parser.add_argument("--jobs", type=int, choices=range(1, 9), default=4)
    args = parser.parse_args()
    evidence = args.evidence.resolve()
    evidence.mkdir(parents=True)  # Fail rather than mix runs.
    signal.signal(signal.SIGINT, cancel)
    signal.signal(signal.SIGTERM, cancel)
    gate = load_gate(args.jobs)
    started = time.monotonic()
    flags = ["-race"] if args.mode == "race" else []
    listing = command(["go", "test", *flags, gate.ROOT, "-list", "."])
    (evidence / "inventory.txt").write_text(listing + "\n")
    shards = gate.partition(listing)
    packages = command(["go", "list", gate.ROOT + "/..."]).splitlines()
    children = discover_children([p for p in packages if p != gate.ROOT], flags, evidence)
    plan = gate.commands(args.mode, shards, packages)
    (evidence / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    metadata = {"head": command(["git", "rev-parse", "HEAD"]),
                "tree": command(["git", "rev-parse", "HEAD^{tree}"]),
                "dirty": bool(command(["git", "status", "--porcelain"])),
                "ignored_goflags": bool(os.environ.get("GOFLAGS")),
                "mode": args.mode, "jobs": args.jobs, "root_count": sum(map(len, shards))}
    name = "sanguo-local-api-" + uuid.uuid4().hex[:16]
    metadata["container"] = name
    metadata["runner_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (evidence / "summary.json").write_text(json.dumps(metadata, indent=2) + "\n")
    created = False
    try:
        command(["docker", "run", "--detach", "--name", name,
                 "--label", "sanguo.local-api-owned=true",
                 "--tmpfs", "/var/lib/postgresql/data:rw,size=2g",
                 "--publish", "127.0.0.1::5432", "--env", "POSTGRES_USER=sanguo",
                 "--env", "POSTGRES_PASSWORD=sanguo", "--env", "POSTGRES_DB=postgres",
                 "postgres:17-alpine"])
        created = True
        if CANCELED.is_set():
            raise InterruptedError("Local API run canceled")
        for _ in range(100):
            ready = subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "sanguo"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("Owned PostgreSQL did not become ready")
        address = command(["docker", "port", name, "5432/tcp"])
        if not address.startswith("127.0.0.1:") or "\n" in address:
            raise ValueError("Unexpected non-loopback PostgreSQL binding")
        port = int(address.rsplit(":", 1)[1])
        metadata["postgres_settings"] = command([
            "docker", "exec", name, "psql", "-U", "sanguo", "-d", "postgres", "-At", "-c",
            "SELECT version(); SHOW fsync; SHOW synchronous_commit; SHOW full_page_writes;"])
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
            futures = []
            for index, (test_command, _) in enumerate(plan):
                database = f"api_{args.mode}_{index}"
                command(["docker", "exec", name, "createdb", "-U", "sanguo", database])
                dsn = f"postgres://sanguo:sanguo@127.0.0.1:{port}/{database}?sslmode=disable"
                env = dict(ENV, DATABASE_URL=dsn, FIRST_CITY_LEDGER_TEST_DSN=dsn,
                           ALLOW_OWNED_PG17_TEST="1", SANGUO_FIRST_CITY_PREPARED_PG_TEST="1",
                           SANGUO_PG_REUSE_SPEC="1", PGHOST="127.0.0.1", PGPORT=str(port),
                           PGUSER="sanguo", PGPASSWORD="sanguo", PGDATABASE=database)
                futures.append(executor.submit(execute, test_command,
                                               evidence / f"{index}.json", env))
            for future in futures:
                results.append(future.result())
        metadata["exits"] = results
        if results != [0] * len(plan):
            raise ValueError(f"API process failure: {results}; inspect raw evidence")
        metadata["outcomes"] = [gate.verify_shard(evidence / f"{i}.json", names)
                                for i, names in enumerate(shards)]
        verify_children(evidence / f"{len(shards)}.json", children)
        metadata["passed"] = True
    finally:
        cancel()
        metadata["elapsed_seconds"] = round(time.monotonic() - started, 3)
        (evidence / "summary.json").write_text(json.dumps(metadata, indent=2) + "\n")
        if created:
            subprocess.run(["docker", "logs", name], stdout=(evidence / "postgres.log").open("w"),
                           stderr=subprocess.STDOUT, check=False)
            subprocess.run(["docker", "rm", "--force", name], check=True,
                           stdout=subprocess.DEVNULL)
        print(json.dumps(metadata, indent=2), flush=True)


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
