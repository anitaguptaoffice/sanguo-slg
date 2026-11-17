# Mail claim wallet ownership

CLIENT-MAIL-WALLET-POLL-001, issue #2389. New implementation from main
`5fdeb746eab9e56aa3f0ae47f36f7a6ab380e483`; no held source is adopted.

All three mail claim controls share `claimMailAttachmentsForId`. Previously that
helper applied authoritative `wallet_after` without advancing the shared asset
read generation. A real mounted panel plus production CityStateFetch,
CityStatePoll and MainCityScene application/patchSession reproduces food 30
being replaced by an older city snapshot of 10, whether its request began before
or during the claim. The original 14-case regression suite failed on the base.

The helper now uses the existing actor-owned `beginAssetMutation`: invalidate
reads before dispatch, settle immediately on success, and settle in finally for
errors. The one-shot settlement's freshness result governs receipt assets; a
newer asset observation wins while confirmed mail state is retained. Full-wallet
zero remains authoritative. Visibility is not ownership: hiding the panel does
not prevent settlement or a valid same-actor receipt. No command is replayed.
A failed response invalidates old reads but does not prove server rollback.

Actor/server/city/session-generation changes prevent old receipts, failure
messages, follow-up bag/unread reads and further batch dispatch from affecting
the new actor. An old settlement never invalidates that actor's reads. The
single-flight flag is released when the operation exits; this change does not
cancel an already-sent RPC or introduce an automatic retry. Explicit retry
remains available after failure.

Tests use mounted mail controls, deferred RPC seams and actual city application;
only unrelated HUD rendering is replaced with a DOM wallet witness. Separate
production GatewayClient/protobuf cases verify request encoding and decoded
success/unknown outcomes. They cover stale decoded reads, success/rejection,
hiding, all three controls, duplicate clicks, actor changes at claim and
follow-up boundaries, partial batch failure and newer asset observations.
These are deterministic client integration tests, not a live server, native
browser, production deployment or full-game acceptance claim. No layout,
protocol, reward rules, backend or held pagination/keyboard features change.

Final source, independent review, temporary held combination, exact remote head,
CI and merge/main mappings are recorded in the linked issue and PR. Changed
base/content requires renewed affected verification; historical holds remain.
