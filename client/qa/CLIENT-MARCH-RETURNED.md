# CLIENT-MARCH-RETURNED-001 — returned-home consumer gate

Requires independently reviewed `spec/proto/MARCH-RETURNED.md`; client-only changes.
Wire5 is authoritative `已回城`, retained in all/default and destination history,
not pending, returning, active HUD/world count, countdown, or arrival notification.
Unknown future numeric values stay unknown. No time heuristic or phase1 rewrite.

Consumer audit:
- `militaryFormat`, info-card/recent labels and form read-only strip: explicit5 label;
  no countdown, including stale/future times. Neutral chip class, never active color.
- `worldMinimap` allowlist1–4 is inherited by HUD military counts, world-cell count,
  route/ETA marker, stacked markers and recent-cell summary. Pending1 stays active.
- `MarchListPanel` keeps history, phase filters, selection, replay/prefill links and
  phase-change pulses. Existing1/2/4 poll/tick predicate excludes5. Empty destination
  wording says records, not that every retained row is in progress.
- `MainCityScene` ETA tick uses the same predicate. Its existing unconditional
  minimap discovery refresh is unchanged; it also runs for an empty list and is not
  terminal-driven. Do not interpret component timer tests as zero app-wide requests.
- `marchArrival` remains2→3/4 (and its existing disappearance semantics).
  `marchArrivalPoll` separately clears observed5 tracked IDs, including direct2→5,
  4→5 and first snapshot5; this never fabricates a new battle/arrival reminder.
- `cityChiefOffice` removes5 as local busy evidence only. Server hero validation is
  unchanged; returned army is not an atomic/durable hero-idle guarantee.
- Remarch is an explicit user action and prefills coordinates/previous force text,
  never troop availability or automatic gameplay. `report_id` is an existing
  optional client extension, not a field in the current binary MarchSummary schema.

`marchReturned.test.ts` includes real protobuf decoding plus a synthetic Go codec
fixture generated with API binding ca091599. Neither is natural real-time acceptance.
Activation remains blocked on coordinated MIL/API/client reviews and lifecycle gates.

## CLIENT-MARCH-RETURNED-002 — renderer correction

Independent review found the actual `drawWorldMinimap` destination-dot loop bypassed
its shared active allowlist. The loop now filters before deduplication/draw, covering
both canvas fallback and sprite paths. A selected history row still shows its two
explicit origin/destination focus points and `已回城` caption, not an active marker.
`drawWorldMinimapReturned.test.ts` records actual canvas calls for returned/127,
mixed pending, all existing active1–4, sprite/fallback and selected-history focus.

## CLIENT-MARCH-RETURNED-003 — authoritative snapshot propagation

Both panel and background ListMarches reads now update the current matching
last-started row, closed-panel history/selection, world counts, chief busy hints
and military/HUD readouts. Absence never manufactures returned or hero-idle state.
Their shared latest-applied request watermark rejects late older replies but lets
slow successful reads apply while a newer request is pending; no phase ordering or
clock heuristic. Session/city/generation and scene/panel lifecycle guards reject
stale owners. Arrival tracking independently rejects late replies after newer
observed5, reset/track, or city switch without starving slow successful polls.
Actual MainCity + closed-panel tests exercise readouts and cross-reader ordering.

Snapshot propagation also preserves the existing2→3/4 destination-arrival reminder
before replacing the panel comparison snapshot. Shared session dedupe prevents a
repeat on panel reread;4→5/direct2→5/initial5 remain silent. This is not a new return
notification or a claim that phase3 implies returned home.
