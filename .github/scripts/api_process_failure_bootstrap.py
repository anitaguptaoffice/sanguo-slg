"""Run the actual bootstrap-failure child in the CI-owned database only."""
import json
import hashlib
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time

from verify_api_process_failure import require


def bootstrap(out):
    env = dict(os.environ, SANGUO_RECRUIT_CLEANUP_PANIC_CHILD="1",
               SANGUO_RECRUIT_CLEANUP_FAILURE="bootstrap:fatal",
               SANGUO_RECRUIT_CLEANUP_FAILURE_BARRIER="1")
    child = subprocess.Popen([str(out / "green.test"),
                              "-test.run=^TestPGRecruitGenerationConstructorCleanupPanic$",
                              "-test.v", "-test.timeout=30s"], env=env, stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = queue.Queue()
    captured = []
    read_errors = []

    def read():
        try:
            with (out / "bootstrap.log").open("w") as log:
                for line in child.stdout:
                    log.write(line)
                    log.flush()
                    captured.append(line)
                    lines.put(line)
                lines.put(None)
        except Exception as error:
            read_errors.append(str(error))
            lines.put(None)

    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    try:
        deadline = time.monotonic() + 20
        while True:
            line = lines.get(timeout=max(0.01, deadline - time.monotonic()))
            require(line is not None, "bootstrap exited before guard barrier")
            if line == "RECRUIT_CLEANUP_FAILURE_BARRIER guard\n":
                break
            require(time.monotonic() < deadline, "bootstrap barrier timeout")
        child.stdin.write("R")
        child.stdin.close()
        code = child.wait(timeout=15)
        reader.join(timeout=5)
        require(not reader.is_alive() and not read_errors, "bootstrap output incomplete: " + str(read_errors))
        text = "".join(captured)
        require(code == 1, "bootstrap was not reaped with exit1")
        for marker in ["RECRUIT_CLEANUP_FAILURE_POINT bootstrap:fatal",
                       "RECRUIT_CLEANUP_FAILURE_EXIT panic=<nil>",
                       "RECRUIT_CLEANUP_FAILURE_BARRIER guard"]:
            require(text.count(marker) == 1, "bootstrap missing/duplicate " + marker)
        for forbidden in ["RECRUIT_CLEANUP_PANIC_OWNED", "FORBIDDEN_CLEANUP",
                          "RECRUIT_CLEANUP_PANIC_WITNESS", "WARNING: DATA RACE", "timed out"]:
            require(forbidden not in text, "bootstrap unexpected " + forbidden)
        (out / "bootstrap.json").write_text(json.dumps({"reaped": True, "exit": code,
                                                       "result": "cleanup-unverified: no ownership; no schema DDL"}))
    finally:
        if child.poll() is None:
            child.kill()
            child.wait(timeout=10)
        reader.join(timeout=5)


def container_read(container, *args, user=None):
    command = ["docker", "exec"] + (["--user", user] if user else [])
    return subprocess.run(command + [container, *args], text=True, capture_output=True, timeout=75)


def process_identity(container, pid):
    result = container_read(container, "cat", f"/proc/{pid}/stat", user="postgres")
    if result.returncode != 0:
        require("No such file" in result.stderr, "cannot establish owned process absence")
        return None
    fields = result.stdout.rsplit(")", 1)[1].split()
    start_code, end_code = int(fields[23]), int(fields[24])
    require(fields[0] == "Z" or 1 < start_code < end_code, "protected live process fields unreadable")
    return {"pid": pid, "start_ticks": int(fields[19]), "state": fields[0], "start_code": start_code,
            "end_code": end_code, "parent": int(fields[1]), "exit_code": int(fields[49])}


def drain(out):
    container = os.environ["PG_CONTAINER"]
    pg = container_read(container, "bash", "-c", 'head -1 "$PGDATA/postmaster.pid"')
    require(pg.returncode == 0, "postmaster identity unavailable")
    postmaster = process_identity(container, int(pg.stdout.strip()))
    discover = container_read(container, "bash", "-c", r'''for file in /proc/[0-9]*/cmdline; do
      IFS= read -r -d "" title < "$file" || true
      if [[ "$title" == "postgres: logger"* ]]; then
        pid=${file#/proc/}; printf "%s\n" "${pid%/cmdline}"
      fi
    done''')
    require(discover.returncode == 0 and len(discover.stdout.splitlines()) == 1, "logger identity ambiguous")
    logger = process_identity(container, int(discover.stdout.strip()))
    require(postmaster and logger and logger["parent"] == postmaster["pid"], "logger/postmaster ownership mismatch")
    manifest = {"container": container, "postmaster": postmaster, "logger": logger,
                "stop_started_ns": time.monotonic_ns()}
    (out / "collector.json").write_text(json.dumps(manifest, indent=2))
    stopped = container_read(container, "bash", "-c", 'pg_ctl -D "$PGDATA" -m fast -w -t 60 stop', user="postgres")
    (out / "pg-stop.log").write_text(stopped.stdout + stopped.stderr)
    require(stopped.returncode == 0, "owned PostgreSQL did not stop normally")
    deadline = time.monotonic() + 30
    while True:
        current = process_identity(container, logger["pid"])
        require(current is None or current["start_ticks"] == logger["start_ticks"], "logger PID reused; exit unverified")
        if current is None:
            break
        require(time.monotonic() < deadline, "logger still running after postmaster stop")
        time.sleep(0.1)
    deadline = time.monotonic() + 30
    while True:
        status = container_read(container, "cat", "/tmp/keeper-postmaster-status")
        if status.returncode == 0 and status.stdout.strip():
            require(status.stdout.strip() == "0", "keeper reaped unsuccessful postmaster")
            break
        require(status.returncode == 0 or "No such file" in status.stderr, "keeper status read failed")
        require(time.monotonic() < deadline, "keeper reap publication timeout")
        time.sleep(0.1)
    manifest.update(logger_exited_ns=time.monotonic_ns(), logger_exit="absent", logger_after=current)
    (out / "collector.json").write_text(json.dumps(manifest, indent=2))


def archived(out):
    manifest = json.loads((out / "collector.json").read_text())
    require(manifest["logger_exited_ns"] > manifest["stop_started_ns"], "collector drain boundary missing")
    manifest.update(archive_completed_ns=time.monotonic_ns(), archive_sha256=hashlib.sha256((out / "server.tar").read_bytes()).hexdigest())
    (out / "collector.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    {"bootstrap": bootstrap, "drain": drain, "archived": archived}[sys.argv[1]](Path(sys.argv[2]))
