# CLIENT-MARCH-HERO-RETURN-001

Task #2023 repairs a second-march blocker. StartMarch added its hero to a local busy set;
the only removal required ListPlayerHeroes.status=1. The real API omits status, so after
settled return the UI still disabled an option labeled idle and prevented the next RPC.

A successful request now records its requested hero ID → returned march ID in memory.
An accepted full snapshot releases only the exact mapped order when every matching row
explicitly says RETURNED. Absence, timestamps, ARRIVED/RETURNING, unrelated history and
contradictory duplicate phases cannot release it. A newer successful order replaces the
old binding, so an old returned record cannot unlock a new march. Local synthetic MARCH
becomes unknown, not authoritative idle; other known non-march statuses remain intact.
Server validation still owns whether a subsequent command is allowed.

MarchSummary has no hero_id; ListPlayerHeroes/GetHeroDetail have no status. No invented
wire fields are used. Hub.onMarchReturn marks RETURNED only after survivor credit and
emits the finished callback wired to ReleaseFromMarch. Release failure can still make
the next command fail; this does not promise a server status. Some zero-survivor/no-battle
orders finish at ARRIVED, which the wire cannot distinguish from active arrival. This
card deliberately does not infer release for that branch or claim full lifecycle repair.

Production creates a fresh Hub with incrementing IDs. Durable store/restore helpers are
not wired into this path, and IDs are not assumed permanent across server restarts.
Bindings are never persisted. Scene entry/exit and actor/token/server/session-generation
changes clear bindings, local hero hints and pending UI state. Late submit/list replies
cannot change a newer actor's tracking; already submitted server commands are not canceled.

Actual-scene regression first failed on main: hero7/march9 → returned → status-less hero
refresh still blocked. Tests cover second submission, repeated orders, old history,
other phases/absence, failures, actor changes, stale list replies and scene exit. They
use mocked gateways and do not establish live/backend/browser acceptance. Independent
review, full tests/build, exact-head CI and applicable acceptance remain required.

MainCityScene overlaps held #2000 only by file. This branch does not modify its selector,
unit validation or troop payload. Direct application of its patch conflicts once at the
startMarch entry: actor initialization versus unitCfgId reading. In an isolated combined
tree, retaining both statements in that order resolves it; 51 tests and build pass. This
is not a clean rebase or a release of its hold. Future integration must explicitly retain
both and rerun verification; the held branch was not changed. No deployment.
