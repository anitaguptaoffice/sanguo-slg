# API-SMOKE-DAILY-CLOCK-001

Scope: API test infrastructure only; production quest reset and all prior smoke
assertions remain unchanged. Card: https://github.com/anitaguptaoffice/sanguo-slg/issues/2211.

## Why there are two clocks

`startData002SmokeGateway` uses one fixed UTC quest calendar instant for initial
startup and restart. The explicit calendar variant accepts a separate clock.
The `*_test.go` export binds it after M4 wiring and before serving requests.
Existing SERVER/HERO/DOM/MIL time, including `AdvanceSmokeTimeTo`, is unchanged;
finishing a building or march must not accidentally advance the quest day.
Production `WireM4Content`, `Server.SetClock`, and `quest.SetClock` are unmodified.

The shared helper is called by INTG006–026 and indirectly INTG027–059. All
callers retain their original assertions and same-day restart semantics. The
only existing advance sites are quest_smoke_fixture, intg044 and intg046;
they exercise building/march time, not a requested next-day quest scenario.
INTG005 and other independently wired fixtures are unaffected.

## Evidence and verification

The immutable ordinary API failure on #2177, run42313368788/job128219974188,
crossed 23:59:52–00:00:03 UTC. Quest1012 was claimed at23:59:55, then legally reset
by HUD read before a same-day restart assertion. Raw SHA256:
`ed9862cd075ef1b2ce28bb1df0607c7639ee05c7e54e3965c0eee9f530c6963f`.
Diagnosis: https://github.com/anitaguptaoffice/sanguo-slg/pull/2177#issuecomment-6699399762.
The WORLD changes do not cause this failure; race success does not waive it.

`TestSmokeDailyCalendarClockPG` uses actual canonical DATA-002 gateway accept,
trusted food hook and claim. It checks injected timestamps, military-clock
isolation, same-day new-server/new-pool restart, exact UTC midnight through a
live gateway (including a UTC+9 source instant), cleared reset fields and no
reward replay. Storage states3/0 map to gateway COMPLETED/AVAILABLE, respectively.
No smoke assertion is weakened, and no new short-mode skip is introduced.

Tests-first checkpoint omits the binding call, so the deterministic timestamp
assertion must fail: quest still uses wall time. This is an expected red test,
not a locally executed result. Official CI can remove only that binding line in
an isolated mutation worktree to establish red, then run the final tree.

Required on official Go/PG17 with DATABASE_URL configured:
- `go test -count=1 -run '^TestSmokeDailyCalendarClockPG$' ./internal/api`
- The same command with `-race`.
- Full API ordinary/race, including all INTG smoke paths, plus required CI.

Local Go, gofmt and PostgreSQL execution are unavailable and not claimed.
Static diff/scope review is not runtime acceptance. Exact source/final heads,
independent review and official job evidence belong in the issue/PR record.
No workflow, deployment, production enablement or historical hold change.
