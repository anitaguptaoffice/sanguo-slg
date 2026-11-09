# Process-local march bookkeeping

API-MARCH-INDEX-SYNC-001 protects the legacy API army counter, player ownership
index and march/hero binding map with one zero-value usable mutex. Concurrent
gateway connections and MIL scheduler callbacks cannot race their map accesses,
first-use initialization or counter increments. Allocation returns the chosen
value while locked, so a handler never rereads another caller's increment.
Lists copy their selected row data, including troop slices, before unlocking.
Existing actor/city filtering, insertion order, totals and pagination are retained.

The lock is held only inside memory helpers. Never carry it into MIL, HERO, DOM,
SQL or any callback: MIL invokes finish under Hub.mu, so an API-lock -> MIL call
would invert the existing MIL-lock -> API finish path. StartMarch and ListMarches
release bookkeeping locks before calling CreateMarch or SnapshotMarch.

Tests cover concurrent first use and allocation, record/list/take/delete, unique
IDs, player/city separation, pagination and snapshot isolation. The gateway test
uses distinct heroes and synthetic stock, dispatches concurrently, then runs real
MIL finish callbacks concurrently with history reads and other index writes.
The bounded scheduler advance is not natural gameplay or browser acceptance.
Existing API ordinary/race CI must execute these tests on the final head; local
source inspection alone is not a Go compilation or race-detector result.

API-MARCH-REGISTRATION-001 adds atomic complete server/player/hero registration.
After CreateMarch, registration snapshots MIL outside the index lock and consumes
an already-finished binding once. Terminal arrived and returned orders reconcile;
returning orders keep their heroes until return finishes. The finish callback and
reconciliation use the same atomic take, preventing duplicate old release after a
hero is claimed again. Reconciliation uses a lifecycle context, not the request.
The active gateway has no Recall route; a future route must revisit these terminal
arrival assumptions. Ownership history and copied troop slices remain retained.

Deterministic real Hub/HERO tests cover both registration orders, returning versus
returned, terminal no-battle arrival, concurrent release consumption, a later
re-claim and canceled request lifetime. These use synthetic stock/bounded scheduler
advances, not native browser, natural gameplay or restart acceptance. Unchanged
ordinary/race API CI and all required checks must pass on the final source.

This is not persistent allocation, atomic dispatch, durable release success or
crash recovery. Ignored HERO release errors, concurrent same-hero claims and claim
before a later failure remain separate work. Callback semantics are unchanged.
No durable route, restore, orphan recovery, automatic retry, profile or deployment
is enabled. Existing durable/native acceptance gates and historical holds remain.
