# Explicit registration native acceptance

CI-EXPLICIT-REGISTRATION-NATIVE-001 (#2428) is separate from existing-account
history. It requires reviewed CLIENT #2427 and CLIENT #2429 browser scenario. Missing
product/scenario or failed cases are blockers, never an existing-account PASS.

Official Actions builds actual cmd/server and client with Go 1.23.12, PG17,
Redis7, Node22, Playwright1.49.1 and Chromium1148 with verified namespace/seccomp
sandbox. Both 1280x720 and 1600x900 execute natural UI registration. Only known
A/B/empty/demo fixtures use setup RPCs. Fresh registration identities are never
preseeded. Separate explicit Login must create its real player and no city.

The browser receives fresh and freshInterrupted credentials in memory only,
known accounts, and ordered checkpoint(stage, {accountId, playerId?}) callbacks:
registered, logged-in, finished. PG verifies every known actor/city unchanged,
exact new-account/player counts and zero new cities. The lost-reply case drops only the actual successful Register response; its
separate account must persist (receipt ID matches PG), with no player/city.
The caller must not claim rollback. No retry, production policy or new city API.

Artifacts contain source/tool hashes, redacted route facts, DB IDs and cleanup;
no passwords, sessions, raw frames, HAR or traces. Failures use fixed stage labels.
Control tests are not native evidence. Final source/evidence independent review,
all required CI and current-main composition remain mandatory before merge.
