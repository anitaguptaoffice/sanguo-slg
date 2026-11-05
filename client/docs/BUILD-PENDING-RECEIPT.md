# Confirmed building submission protection

Task: CLIENT-BUILD-PENDING-RECEIPT-001, issue #2078.

## Verified problem

The server has one active building slot. Starting hall Lv2→3 then farm Lv1→2
charges for both, with the farm waiting. `GetCityState` returns existing buildings
and only active queue timestamps (`internal/domestic/pg_store.go`,
`activeFinishBySlot`). The ordinary post-submit refresh therefore removes the
farm's timestamp. Previously the confirm button reopened and another click
paid for the same target level again. New construction is absent from city
buildings until completion; its Start response's provisional Lv1 is not proof
of completion. `ValidateUpgrade` does not reject pending same-slot jobs.

## Bounded client mitigation

MainCity retains a separate confirmed pending slot after a successful Start
response. It captures requested configuration and target level, actor/city,
connection generation and scene lifetime. Both the existing button and submit
entry reject another submission for that slot. Other slots remain usable.
No queue entries or authoritative buildings are fabricated.

Only a genuine city read containing the matching slot and configuration at or
above the captured target clears protection. Both MainCity refresh/poll and
QueuePanels refresh reconcile their actual snapshots. An omitted buildings field
must not fall back to a local provisional receipt. Failed reads, lower/mismatched
snapshots and elapsed estimated finish times do not mean completion.

This does not recover unknown request outcomes or survive scene exit/reload.
The server remains authoritative. No command is canceled, replayed or refunded;
backend deduplication and an authoritative waiting-job read are separate work.
The existing button/status region is reused without new controls or layout.

## Verification

`buildPendingReceipt.test.ts` mounts MainCity, clicks real slot/confirm controls
and decodes production protobuf responses. Its source-grounded server fixture
models wallet deduction, one active slot, waiting omission and true completion.
Baseline: three guard assertions fail; active and completion controls pass and
a diagnostic repeat click sends another paid request. Final tests also cover
queue refresh, provisional Lv1, omitted state, elapsed deadline, ownership,
failed submission and valid next-level construction. This is not a live backend,
Postgres or real-browser acceptance claim.

Keep isolated combination verification with held #2000 and #2073; neither hold
is lifted by this repair. Exact source review, full client suite/build, required
PR CI and post-merge main CI remain release gates.
