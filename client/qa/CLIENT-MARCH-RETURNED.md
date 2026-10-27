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
