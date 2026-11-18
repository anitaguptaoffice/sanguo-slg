# Local Recruit recovery guard

Use the Python 3 standard library with SQLite support. Initialize an owned file
outside the browser profile and keep that exact file for the enrollment's
lifetime. Pair it with the prepared gateway and the browser's local origin.

```sh
python3 client/scripts/recruit_recovery_guard.py /absolute/local/guard.db init http://127.0.0.1:5173 ws://127.0.0.1:8080/ws
python3 client/scripts/recruit_recovery_guard.py /absolute/local/guard.db serve --port 5174
```

Keep the printed enrollment ID and the guard address for the subsequent game
client pairing. The browser sends JSON to `/availability`, `/reserve`, or
`/settle` with `id`, `gateway`, and `scope` (the account, server and player
decimal strings). For reservation it adds `command` (command hex, version,
city, unit and count as canonical strings). A terminal settlement uses the
returned `reservation` and validated `outcome` of accepted or rejected.
`409` leaves the action unavailable. Restart does not retire outstanding work.

The local owner can run `inspect` against the file, then `grant RESERVATION
EVIDENCE_REFERENCE` only after independently reconciling that exact abandoned
attempt under [the recovery rules](../../spec/rules/MIL_RECRUIT_CLIENT_JOURNAL.md).
Keep the positive evidence separately. The grant is for one retry of that
exact command. Ordinary browser requests cannot inspect or issue grants.
An unresolved contradiction stays outstanding. Do not reinitialize or restore
an older guard file to reenable the same pairing.

Run `python3 client/scripts/test_recruit_recovery_guard.py` for the owned
loopback and process-restart tests. This tool does not handle game packets or
activate the browser on its own.
