# Current prepared Recruit queue

[SPEC-RECRUIT-QUEUE-READ-001 / #3121](https://github.com/anitaguptaoffice/sanguo-slg/issues/3121)
adds field 5 to `domestic.v1.GetCityState` on the prepared path. Fields 1–4 and
the request retain their existing meanings. Older clients can ignore field 5;
legacy servers and the ordinary local configuration omit it.

Absent `recruit_queue` means unavailable or unknown. A present message with
no jobs and false `has_more` represents a valid authoritative empty set. The
nonempty message shows up to the oldest 64 pending jobs in ascending FIFO
queue-ID order. A true `has_more` requires 64 displayed jobs and means more
pending work exists behind them. This response bound does not cap admission.

Each job reports its positive safe-integer queue ID, supported unit ID 1–4,
positive int32 count, current waiting (0) or active (1) status, and canonical
current finish in signed Unix milliseconds. A nonempty prefix starts with the
sole active job and is followed by waiting jobs. A waiting job's finish is an
estimate. Once promoted, use the persisted actual finish even when it is
later than estimates of younger jobs. Do not sort by time or manufacture
completion when a deadline passes. If a row disappears from the displayed
prefix, use the authoritative ready garrison for available troops.

Validate selected shard and WORLD ownership, then read under the prepared
city barrier used by stock and queue writers. Validate pending source data
and receipt/origin links under the adopted [queue rules](../rules/MIL_RECRUIT_QUEUE.md).
Missing or corrupt evidence must never be displayed as an empty queue.
Do not expose command keys, payment, raw job payloads or historical acceptance.
This is a read-only projection; querying cannot complete or promote a job,
allocate an identity, accrue military rewards or change the ready stock.

The client applies present snapshots to the currently selected city and actor.
Discard stale asynchronous responses and preserve absent versus empty. Explain
the bound when `has_more` is true. Refresh using the existing city-state path
after observed transitions and on fresh entry. The established wallet and
garrison fields remain independent of browser history.

Acceptance includes actual prepared current waiting/active observations,
promotion updating the live finish, process-restart reconstruction, queue
retirement only after the committed transition and corresponding ready stock,
time controls and invalid/foreign-source cases. Server and browser wiring are
separate delivery from this contract.
