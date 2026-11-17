"""Run every discovered API root once, preserving raw JSON and the frozen gate."""
import concurrent.futures
import collections
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

ROOT = "github.com/anitaguptaoffice/sanguo-slg/internal/api"
SHARDS = 4


def partition(output):
    names = []
    for line in output.splitlines():
        if re.fullmatch(r"(?:Test|Example|Fuzz)\w*", line):
            names.append(line)
        elif not re.fullmatch(r"ok\s+" + re.escape(ROOT) + r"\s+.+", line):
            raise ValueError(f"Unexpected discovery line: {line!r}")
    if len(names) < SHARDS or len(names) != len(set(names)):
        raise ValueError("Empty, undersized or duplicate root inventory")
    return [sorted(names)[index::SHARDS] for index in range(SHARDS)]


def verify_shard(path, names):
    events = [json.loads(line) for line in path.read_text().splitlines()]
    if not events or any(e.get("Package") != ROOT for e in events):
        raise ValueError("Missing or foreign package evidence")
    if any(e["Action"] in {"skip", "fail"} for e in events):
        raise ValueError("Skipped or failed shard")
    runs, passes = (collections.Counter(e["Test"] for e in events
                   if e["Action"] == action and e.get("Test"))
                   for action in ("run", "pass"))
    if runs != passes or any(count != 1 for count in runs.values()):
        raise ValueError("Missing, duplicate or unfinished test")
    roots = {name for name in runs if "/" not in name}
    if roots != set(names) or any(name.split("/", 1)[0] not in roots for name in runs):
        raise ValueError("Missing or out-of-shard root")
    terminals = [e["Action"] for e in events if not e.get("Test")
                 and e["Action"] in {"pass", "skip", "fail"}]
    if terminals != ["pass"]:
        raise ValueError("Shard did not finish successfully exactly once")
    return len(passes)


def execute(command, path, env, timeout=7200):
    # Separate files prevent concurrent test2json writers from interleaving bytes.
    with path.open("w") as output:
        process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT,
                                   env=env, start_new_session=True)
        try:
            return process.wait(timeout=timeout)
        except BaseException:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise


def commands(mode, shards, packages):
    if mode not in {"ordinary", "race"}:
        raise ValueError("Unknown test mode")
    flags = ["-race"] if mode == "race" else []
    common = ["go", "test", *flags, "-count=1", "-timeout=120m", "-json"]
    result = [(common + ["-run", "^(" + "|".join(names) + ")$", ROOT], names)
              for names in shards]
    children = [package for package in packages if package != ROOT]
    if packages.count(ROOT) != 1 or len(packages) != len(set(packages)) or not children:
        raise ValueError("Incomplete or duplicate package inventory")
    if any(not package.startswith(ROOT + "/") for package in children):
        raise ValueError("Unexpected package inventory")
    return result + [(common + children, None)]


def main(mode, destination):
    if mode not in {"ordinary", "race"}:
        raise ValueError("Unknown test mode")
    destination.mkdir()  # Never reuse stale evidence from an earlier attempt.
    flags = ["-race"] if mode == "race" else []
    listing = subprocess.check_output(["go", "test", *flags, ROOT, "-list", "."],
                                      text=True, timeout=300)
    (destination / "inventory.txt").write_text(listing)
    shards = partition(listing)
    packages = subprocess.check_output(["go", "list", ROOT + "/..."],
                                       text=True, timeout=300).splitlines()
    plan = commands(mode, shards, packages)
    (destination / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    results = []
    started = time.monotonic()
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=SHARDS) as pool:
            futures = []
            for index, (command, _) in enumerate(plan):
                port = 15432 + index if index < SHARDS else 5432
                env = dict(os.environ, DATABASE_URL=(
                    f"postgres://sanguo:sanguo@localhost:{port}/api_{mode}_{index}?sslmode=disable"))
                futures.append(pool.submit(execute, command, destination / f"{index}.json", env))
            for index, future in enumerate(futures):
                try:
                    results.append(future.result())
                except Exception as error:
                    (destination / f"{index}.error.txt").write_text(type(error).__name__ + "\n")
                    results.append(-1)
    finally:
        # Raw events remain unchanged: root package has four genuine terminals.
        with (destination / "full.json").open("wb") as merged:
            for index in range(len(plan)):
                path = destination / f"{index}.json"
                if path.exists():
                    data = path.read_bytes()
                    merged.write(data)
                    sys.stdout.buffer.write(data)
        print(f"Parallel {mode}: {time.monotonic() - started:.1f}s; exits={results}", flush=True)
    if results != [0] * len(plan):
        raise ValueError("At least one API process failed")
    counts = [verify_shard(destination / f"{index}.json", names)
              for index, names in enumerate(shards)]
    print(f"Verified exact-once roots={sum(map(len, shards))}; outcomes per shard={counts}")


if __name__ == "__main__":
    main(sys.argv[1], Path(sys.argv[2]))
