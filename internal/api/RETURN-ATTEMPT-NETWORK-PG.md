# API-RETURN-ATTEMPT-NETWORK-PG-001

Task [#2148](https://github.com/anitaguptaoffice/sanguo-slg/issues/2148), depending on
source #2145, flow #2146 and the #2145 → PLATFORM panic repair #2147 gate.
Tests-first checkpoint: fe2ffc7963f405ba0e76d5dcd1630c8cecbed365. New API-only evidence.

Pinned pgx v5.7.4 BuildFrontend wraps supplied BGReader and post-TLS writer without
altering TLS, authentication or validators. It arms only after real initialization.
Exact complete COMMIT Query framing either cuts before any COMMIT byte is written,
or fully forwards COMMIT and withholds every backend acknowledgement byte. Bounded
CommandComplete(COMMIT) and ReadyForQuery(idle) parsing rejects other/truncated frames.
Normal, byte-fragmented and coalesced-frame tests preserve the same withholding rule.
Independent observer sees either unchanged rows/sequences after backend termination,
or credit 18/20/19/23 and terminal state with the retained graph unchanged. PG17,
synchronous_commit and fsync are checked read-only. This proves controlled response
loss, NOT PostgreSQL restart/crash durability or a production recovery algorithm.

Both APP results retain the identical unknown attempt, zero confirmed observation,
closed admission and pending lease despite observer knowledge. No later SQL or retry;
ErrTxClosed/ErrInactive cleanup is not rollback evidence. Request cancellation and an
independent abort close transports before caller/pgx cleanup joins and fixture teardown.
Local Go is unavailable: no compilation/runtime PASS is claimed. Exact independent
review, official Go1.23.12/PG17.11 ordinary/race with zero unexpected skips and all
required CI remain mandatory. No production activation or historical hold release.
