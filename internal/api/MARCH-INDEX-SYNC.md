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

Tests cover concurrent first use and allocation, record/list/bind/delete, unique
IDs, player/city separation, pagination and snapshot isolation. The gateway test
uses distinct heroes and synthetic stock, dispatches concurrently, then runs real
MIL finish callbacks concurrently with history reads and other index writes.
The bounded scheduler advance is not natural gameplay or browser acceptance.
Existing API ordinary/race CI must execute these tests on the final head; local
source inspection alone is not a Go compilation or race-detector result.

This is not persistent allocation, restart recovery, atomic dispatch or a hero
lifecycle fix. Finish before API registration, finish between record and bind,
ignored release errors and claim before a later failure remain separate work.
The callback semantics and legacy no-battle behavior are unchanged. No durable
route, restore, orphan recovery, automatic retry, profile or deployment is enabled.
The separate origin-precheck fix and all durable/native acceptance gates remain.
