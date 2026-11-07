"""Fail-closed verification of isolated process and PostgreSQL evidence."""
import json
import datetime
import hashlib
import tarfile
from pathlib import Path
import re
import sys


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def lifecycle(events):
    states = {}
    for event in events:
        require(event.get("Package") == "api", "unexpected Go package")
        action = event["Action"]
        name = event.get("Test", "package")
        require(action in {"start", "run", "output", "pass", "fail"}, "unknown/unsupported Go action")
        if "/" in name:
            require(states.get(name.rsplit("/", 1)[0]) == "running", "subtest outside parent lifecycle")
        if action in {"start", "run"}:
            require(name not in states and action == ("start" if name == "package" else "run"), "duplicate/invalid Go start")
            states[name] = "running"
        elif action != "output":
            require(states.get(name) == "running", "Go terminal without unique live start")
            require(not any(key.startswith(name + "/") and state == "running" for key, state in states.items()), "parent ended before subtest")
            states[name] = action
        else:
            require(states.get(name) == "running", "Go output outside lifecycle")
        require(name == "package" or states.get("package") == "running", "test outside package lifecycle")
    require(states and "running" not in states.values(), "unfinished Go event lifecycle")
    return states


def test_events(out, color):
    events = [json.loads(line) for line in (out / (color + ".json")).read_text().splitlines()]
    states = lifecycle(events)
    text = "".join(e.get("Output", "") for e in events)
    require(not any(word in text for word in ["WARNING: DATA RACE", "panic: test timed out", "build failed"]), color + " invalid runtime diagnostic")
    root = "TestPGRecruitCleanupFailureProcess"
    if color == "green":
        required = {root, "TestRecruitCleanupFailureGuard", "TestRecruitCleanupFailureRunner", "TestRecruitFailureOwnershipRejectsIncomplete",
                    "TestRecruitFailureAbsenceRequiresReap", "TestPGRecruitFailureAbsenceRejectsLiveBackend",
                    "TestRecruitPanicAbsenceRejectsInvalidIdentity"}
        required |= {root + "/" + m for m in ["original_fatal", "original_goexit", "original_panic", "spare_fatal", "raw-close_fatal"]}
        required |= {parent + "/" + m for parent in ["TestRecruitCleanupFailureGuard", "TestRecruitCleanupFailureRunner"]
                     for m in ["fatal", "goexit", "panic", "return"]}
        require(states == dict.fromkeys(required | {"package"}, "pass"), "green test inventory/terminal")
    else:
        require(states == dict.fromkeys({root, root + "/original_fatal", "package"}, "fail"), "red inventory/outcome")
        require("forbidden inherited fixture cleanup executed" in text, "red wrong failure")
    grouped = {}
    for event in events:
        if event["Action"] == "output":
            name = event.get("Test", "package")
            grouped[name] = grouped.get(name, "") + event.get("Output", "")
    observations = []
    for name, output in grouped.items():
        for line in output.splitlines():
            if line.startswith("RECRUIT_FAILURE_EVENT "):
                event = json.loads(line.removeprefix("RECRUIT_FAILURE_EVENT "))
                require(name == root + "/" + event["Case"].split("-", 1)[1].replace(":", "_"), "process event belongs to wrong test")
                observations.append(event)
    return observations


def check(out):
    settings_lines = (out / "settings.txt").read_text().splitlines()
    settings = dict(line.split("=", 1) for line in settings_lines)
    require(len(settings) == len(settings_lines), "duplicate logging settings")
    require(settings == {"logging_collector": "on", "log_destination": "jsonlog", "log_statement": "all",
                         "log_directory": "/tmp/process-failure-pg-log", "log_filename": "evidence.log",
                         "log_rotation_age": "0", "log_rotation_size": "0", "log_truncate_on_rotation": "off",
                         "log_connections": "on", "log_disconnections": "on", "log_timezone": "UTC", "log_min_messages": "debug1", "log_line_prefix": "PROCESS_FALLBACK %p %c ",
                         "lc_messages": "C", "log_error_verbosity": "default"}, "logging configuration mismatch")
    container = json.loads((out / "container.json").read_text())[0]
    state = container["State"]
    collector = json.loads((out / "collector.json").read_text())
    require(re.fullmatch(r"[0-9a-f]{64}", collector["container"]) and collector["container"] == container["Id"], "collector container ownership")
    times = [collector[key] for key in ["stop_started_ns", "logger_exited_ns", "archive_completed_ns"]]
    require(all(type(value) is int and value > 0 for value in times) and times[0] < times[1] < times[2], "collector capture order")
    require(collector["archive_sha256"] == hashlib.sha256((out / "server.tar").read_bytes()).hexdigest(), "collector capture hash")
    initial = json.loads((out / "initialization.json").read_text())
    require(set(initial) == {"pid", "start_ticks", "collector", "ready", "reaped", "exit", "fresh_logs"}, "initialization boundary incomplete")
    require(all(type(initial[k]) is int and initial[k] > 0 for k in ["pid", "start_ticks"]) and
            initial["pid"] > 1 and initial["collector"] == "off" and all(initial[k] is True for k in ["ready", "reaped", "fresh_logs"]) and
            type(initial["exit"]) is int and initial["exit"] == 0, "initialization not normally completed")
    logger, postmaster = collector["logger"], collector["postmaster"]
    require(initial["pid"] not in {logger["pid"], postmaster["pid"]} and initial["start_ticks"] <= postmaster["start_ticks"],
            "final server did not follow initialization")
    require(all(type(identity[key]) is int and identity[key] > 0 for identity in [logger, postmaster] for key in ["pid", "start_ticks"]), "collector process identity absent")
    require(logger["parent"] == postmaster["pid"] and logger["pid"] != postmaster["pid"] and
            postmaster["parent"] == 1 and postmaster["pid"] > 1 and logger["pid"] > 1 and all(type(i["parent"]) is int and type(i["exit_code"]) is int and
            i["exit_code"] == 0 and i["state"] in {"R", "S", "D", "I"} for i in [logger, postmaster]), "collector initial process ownership/state")
    require(all(type(i[k]) is int for i in [logger, postmaster] for k in ["start_code", "end_code"]) and
            all(1 < i["start_code"] < i["end_code"] for i in [logger, postmaster]), "masked live process identity")
    require(collector["logger_after"] is None and collector["logger_exit"] == "absent", "collector disappearance unverified")
    require(not state["Running"] and state["ExitCode"] == 0 and not state["OOMKilled"], "unclean server shutdown")
    files = {p.name: p.read_bytes() for p in (out / "server").iterdir() if p.is_file() and not p.is_symlink()}
    require(set(files) == {"evidence.json", "evidence.log"} and len(list((out / "server").iterdir())) == 2, "unexpected collector files or fallback output")
    with tarfile.open(out / "server.tar") as archive:
        members = archive.getmembers()
        names = [m.name.rstrip("/") for m in members]
        require(len(names) == len(set(names)), "duplicate collector archive member")
        require(all(m.isfile() or m.isdir() and m.name.rstrip("/") == "process-failure-pg-log" for m in members), "nonregular/unexpected archive entry")
        archived = {m.name: archive.extractfile(m).read() for m in members if m.isfile()}
    require(archived == {"process-failure-pg-log/" + n: data for n, data in files.items()}, "collector archive/copy mismatch")
    inventory = (out / "log-inventory.txt").read_text().splitlines()
    require(inventory == [hashlib.sha256(data).hexdigest() + "  " + name for name, data in sorted(files.items())], "collector hash inventory mismatch")
    raw = files["evidence.json"]
    require(raw.endswith(b"\n"), "truncated collector log")
    records = [json.loads(line) for line in raw.splitlines()]
    sessions = {}
    statements = []
    protocol = []
    for record in records:
        require(type(record["pid"]) is int and record["pid"] > 0 and type(record["line_num"]) is int and record["line_num"] > 0, "invalid server process/line identity")
        sid = record["session_id"]
        prior = sessions.setdefault(sid, [])
        require(not prior or record["line_num"] == prior[-1]["line_num"] + 1, "missing/duplicate/reordered session log")
        datetime.datetime.strptime(record["session_start"], "%Y-%m-%d %H:%M:%S UTC")
        require(not prior or (record["pid"], record["session_start"]) ==
                (prior[0]["pid"], prior[0]["session_start"]), "session identity changed")
        prior.append(record)
        require(not (record.get("statement") and re.search(r"\bDROP\s+SCHEMA\b", record["statement"], re.I)), "DROP error statement requires investigation")
        match = re.match(r"(?:statement: |execute [^:]*: )(.*)", record.get("message", ""), re.S)
        if match:
            statements.append((record, match[1]))
            if "RECRUIT_FAILURE_SQL" in match[1]:
                require(match[1].startswith("SELECT 'RECRUIT_FAILURE_SQL ") and match[1].endswith("'"), "malformed SQL marker")
                protocol.append((record, json.loads(match[1][len("SELECT 'RECRUIT_FAILURE_SQL "):-1].replace("''", "'"))))
    drain_records = [r for r in records if r.get("message") == "logger shutting down" and r["pid"] == collector["logger"]["pid"]]
    shutdown = [r for r in records if r.get("message") == "database system is shut down" and r["pid"] == collector["postmaster"]["pid"]]
    require(len(drain_records) == len(shutdown) == 1 and records.index(shutdown[0]) < records.index(drain_records[0]), "collector EOF/flush record missing")
    require(sum(r.get("message") == "logger shutting down" for r in records) == 1, "unexpected collector lifecycle")
    eof = drain_records[0]
    redirects = [r for r in records if r.get("message") == "ending log output to stderr"]
    ready = [r for r in records if r.get("message") == "database system is ready to accept connections"]
    require(len(redirects) == len(ready) == 1, "missing/duplicate startup boundary")
    start = redirects[0]
    hint = 'Future log output will go to log destination "jsonlog".'
    require(start["pid"] == ready[0]["pid"] == postmaster["pid"] and
            start["session_id"] == ready[0]["session_id"] == shutdown[0]["session_id"] and
            start.get("error_severity") == "LOG" and start.get("backend_type") == "postmaster" and
            start.get("hint") == hint and records.index(start) < records.index(ready[0]), "unbound startup fallback")
    prefix = f"PROCESS_FALLBACK {start['pid']} {start['session_id']} "
    fallback = prefix + "LOG:  ending log output to stderr\n" + prefix + "HINT:  " + hint + "\n"
    fallback += f"PROCESS_FALLBACK {eof['pid']} {eof['session_id']} DEBUG:  logger shutting down\n"
    require(files["evidence.log"] == fallback.encode(), "unexpected or missing logger fallback")
    for rows in sessions.values():
        require(len({r["dbname"] for r in rows if r.get("dbname")}) <= 1, "session database changed")
        if any(r.get("dbname", "").startswith("process_") for r in rows):
            require(rows[0]["line_num"] == 1 and "connection received:" in rows[0]["message"], "missing connection start")
            authorized = [i for i, r in enumerate(rows) if "connection authorized:" in r["message"]]
            require(len(authorized) == 1 and "disconnection:" in rows[-1]["message"], "missing connection lifecycle boundary")
            require(all(r.get("dbname") == rows[authorized[0]]["dbname"] for r in rows[authorized[0]:]), "authorized database missing/changed")
    boundaries = []
    for boundary in ["begin", "end"]:
        sql = f"SELECT 'PROCESS_LOG_{boundary}'; CREATE SCHEMA process_log_{boundary}; DROP SCHEMA process_log_{boundary}"
        hits = [r for r, s in statements if s == sql]
        require(len(hits) == 1, "missing statement/DROP positive control " + boundary)
        boundaries.append(records.index(hits[0]))
    begin, end_boundary = boundaries
    require(records.index(ready[0]) < begin < end_boundary, "startup/logging control order")
    require(all(begin < records.index(row) < end_boundary for row, _ in statements
                if row.get("dbname", "").startswith("process_")), "test statement outside log boundaries")
    require(any(i > end_boundary and r.get("message") == "database system is shut down"
                for i, r in enumerate(records)), "shutdown precedes end control")
    identity = (out / "source.txt").read_text().splitlines()
    require(len(identity) == 2 and all(re.fullmatch(r"[0-9a-f]{40}", x) for x in identity), "source/tree identity missing")
    bootstrap_output = (out / "bootstrap.log").read_text()
    for marker in ["POINT bootstrap:fatal", "EXIT panic=<nil>", "BARRIER guard"]:
        require(bootstrap_output.count("RECRUIT_CLEANUP_FAILURE_" + marker) == 1, "bootstrap protocol incomplete")
    require(not any(word in bootstrap_output for word in ["RECRUIT_CLEANUP_PANIC_", "FORBIDDEN_CLEANUP", "WARNING: DATA RACE", "failure barrier release", "panic: test timed out", "--- SKIP:"]), "bootstrap contradictory output")
    boot = json.loads((out / "bootstrap.json").read_text())
    require(boot["reaped"] is True and type(boot["exit"]) is int and boot["exit"] == 1 and "cleanup-unverified" in boot["result"], "bootstrap not verified")
    bootstrap_sql = [sql for row, sql in statements if row.get("dbname") == "process_bootstrap"]
    require(sum(sql.startswith("CREATE SCHEMA ") for sql in bootstrap_sql) == 1, "bootstrap did not reach real fixture")
    require(not any(re.search(r"\bDROP\s+SCHEMA\b", sql, re.I) for sql in bootstrap_sql), "bootstrap attempted DROP")
    boot_created = [row for row, sql in statements if row.get("dbname") == "process_bootstrap" and sql.startswith("CREATE SCHEMA ")]
    boot_absent = [row for row, sql in statements if sql == "SELECT 'PROCESS_BOOTSTRAP_REAP_ABSENT'"]
    require(len(boot_absent) == 1 and records.index(boot_created[0]) < records.index(boot_absent[0]) < end_boundary,
            "missing or premature bootstrap disposal boundary")
    success = [json.loads(line) for line in (out / "success.json").read_text().splitlines()]
    require(lifecycle(success) == {"package": "pass", "TestPGRecruitGenerationConstructorCleanupPanic": "pass"}, "success lifecycle")
    require(any("verified primary/live/unknown/retained slot" in e.get("Output", "") for e in success), "success witness missing")
    require(not any(word in e.get("Output", "") for e in success for word in ["WARNING: DATA RACE", "panic: test timed out", "build failed"]), "success runtime diagnostic")
    observed = {color: test_events(out, color) for color in ["green", "red"]}
    require(sorted(json.dumps(e, sort_keys=True) for es in observed.values() for e in es) ==
            sorted(json.dumps(e, sort_keys=True) for _, e in protocol), "unexpected/missing SQL marker inventory")
    for color, observations in observed.items():
        cases = {}
        for event in observations:
            cases.setdefault(event["Case"], []).append(event)
        require(len(cases) == (5 if color == "green" else 1), "case inventory mismatch")
        modes = {case.split("-", 1)[1] for case in cases}
        wanted = {"original:fatal", "original:goexit", "original:panic", "spare:fatal", "raw-close:fatal"}
        require(modes == (wanted if color == "green" else {"original:fatal"}), "checkpoint inventory mismatch")
        claimed_drops = []
        for case, events in cases.items():
            require(re.fullmatch(r"[1-9][0-9]*-(?:original:(?:fatal|goexit|panic)|spare:fatal|raw-close:fatal)", case), "invalid case identity")
            require(all(type(e["ExitCode"]) is int and type(e["SchemaLive"]) is bool and all(type(x) is bool for x in e["Live"]) for e in events), "invalid process observation types")
            require([e["Stage"] for e in events] == ["barrier-observed", "reaped-backends-absent", "case-end"], "stage order")
            first, absent, end = events
            require(first["Database"] == "process_" + color and first["ExitCode"] == -1, "case boundary mismatch")
            require(absent["ExitCode"] == end["ExitCode"] == 1, "child exit/reap mismatch")
            for key in ["Observer", "Owned", "Live", "Barrier", "Database", "SchemaLive"]:
                require(all(e[key] == first[key] for e in events), "mutable case identity " + key)
            observer = first["Observer"]
            require(observer["PID"] > 0 and re.fullmatch(r"\d{4}-.*T.*(?:Z|[+-]\d\d:\d\d)", observer["Start"]), "observer identity absent")
            owned = first["Owned"]
            require(re.fullmatch(r'api_return_[0-9]+_"Q', owned["Schema"]), "invalid schema")
            identities = [owned["Original"]] + (owned["Spares"] or [])
            require(len(first["Live"]) == len(identities) == (2 if case.endswith(("spare:fatal", "raw-close:fatal")) else 1), "liveness inventory mismatch")
            require(owned["Verified"] == "", "ownership contains success witness")
            require(all(i["PID"] > 0 and i["Start"] != "0001-01-01T00:00:00Z" for i in identities), "invalid owned identity")
            require(len({(i["PID"], i["Start"]) for i in identities}) == len(identities), "duplicate identity")
            markers = []
            for event in events:
                hits = [row for row, value in protocol if value == event]
                require(len(hits) == 1, "missing/duplicate SQL event " + case)
                markers.append(hits[0])
            identity_sessions = []
            for role, identity in enumerate([observer] + identities):
                exact = datetime.datetime.fromisoformat(identity["Start"].replace("Z", "+00:00"))
                require(exact.tzinfo is not None, "identity lacks timezone")
                second = exact.astimezone(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                matched = [rows for rows in sessions.values() if rows[0]["pid"] == identity["PID"]
                           and rows[0]["session_start"] == second and any(r.get("dbname") == first["Database"] for r in rows)]
                require(len(matched) == 1 and records.index(matched[0][0]) < records.index(markers[0]), "backend_start/session linkage missing")
                identity_sessions.append(matched[0][0]["session_id"])
                if role == 0:
                    require(matched[0][0]["session_id"] == markers[0]["session_id"] and records.index(matched[0][-1]) > records.index(markers[2]), "observer matched wrong/ended session")
                else:
                    closed = records.index(matched[0][-1])
                    require(not first["Live"][role - 1] or closed > records.index(markers[0]), "retained live backend disconnected before barrier")
            require(len(set(identity_sessions)) == len(identity_sessions), "observer/owned session alias")
            require(len({r["session_id"] for r in markers}) == 1, "observer session changed")
            require(all(r["pid"] == observer["PID"] and r["dbname"] == first["Database"] for r in markers), "observer log identity mismatch")
            require(markers[0]["line_num"] < markers[1]["line_num"] < markers[2]["line_num"], "SQL marker order")
            quoted = '"' + owned["Schema"].replace('"', '""') + '"'
            creates = [r for r, sql in statements if r.get("dbname") == first["Database"] and sql == "CREATE SCHEMA " + quoted]
            require(len(creates) == 1 and records.index(creates[0]) < records.index(markers[0]) and
                    creates[0]["session_id"] not in identity_sessions, "missing/late/non-admin CREATE session")
            drops = [r for r, sql in statements if r.get("dbname") == first["Database"]
                     and sql == "DROP SCHEMA IF EXISTS " + quoted + " CASCADE"]
            parent = [r for r in drops if r["session_id"] == markers[0]["session_id"]
                      and markers[1]["line_num"] < r["line_num"] < markers[2]["line_num"]]
            require(len(parent) == 1, "parent DROP not causally after reap/absence")
            if color == "green":
                require(len(drops) == 1 and first["Barrier"] == "guard" and first["SchemaLive"], "child DROP or wrong guard")
                require(first["Live"][0] == (not case.endswith("raw-close:fatal")) and all(first["Live"][1:]), "barrier live identities")
            else:
                require(first["Barrier"] == "cleanup" and first["Live"][0], "red lacks live original at cleanup barrier")
                child = [r for r in drops if r["session_id"] != parent[0]["session_id"]]
                require(len(drops) == 2 and len(child) == 1, "red lacks actual child admin DROP")
                require(records.index(child[0]) < records.index(markers[0]), "red DROP did not precede live barrier")
                require(creates[0]["session_id"] == child[0]["session_id"] and creates[0]["line_num"] < child[0]["line_num"], "red admin did not create owned schema")
            claimed_drops.extend(drops)
        actual = [r for r, sql in statements if r.get("dbname") == "process_" + color and re.search(r"\bDROP\s+SCHEMA\b", sql, re.I)]
        require(sorted((r["session_id"], r["line_num"]) for r in actual) ==
                sorted((r["session_id"], r["line_num"]) for r in claimed_drops), "unaccounted DROP")
    print("Verified actual children, red reproduction, bootstrap fail-closed and complete server evidence")


if __name__ == "__main__":
    check(Path(sys.argv[1]))
