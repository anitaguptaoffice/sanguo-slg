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

## CLIENT-MARCH-RETURNED-005 — display and component acceptance

Returned strip/subline uses an opaque neutral #383838 surface and #d2d2d2 ink
(7.75:1), independent of inherited paper/dark text. Phase-change outline pulses
remain, while pulse fills cannot make terminal text unreadable. No PNG/asset edits.

`marchReturnedPanel.test.ts` verifies production GatewayClient binary handling,
selected-history/report-session links, separate optional report_id extension,
4→5/direct2→5/initial5, mixedpending and repeated refresh, timers and reattach.
`marchReturned.test.ts` additionally decodes actual MIL settlement→API handler
wire with166 survivors and return deadline0 (synthetic engineering settlement).

`QA_OUT=/tmp/returned node qa/marchReturned.browser.mjs` runs sandboxed native
Chromium at1280×720 and1600×900 with fallback and installed paper skin. It decodes
Go5/1/4/127, uses production GatewayClient/Panel/rendering, verifies active/world
counts1→0, real canvas destination draws1→0, neutral contrast, no terminal timer,
selection/history after reload, repeat refresh, unknown127 and report-session link.
Its200ms polling is fixture-only, not a changed production/gameplay duration.
Browser reload is a component/sessionStorage fixture, **not native relogin or
natural elapsed-time return acceptance**. Production default remains5s; unrelated
background minimap discovery is intentionally retained. Coordinated activation
and natural same-process lifecycle acceptance remain external gates.

## CLIENT-RETURNED-READABILITY-001 — march history readability

March-specific CSS lets skinned row bars grow for multiline content and provides
opaque, legible phase/detail surfaces and 14px history text in both skins. The
existing returned neutral strip retains its colors. Component browser QA loads
assets for paper rows and checks row-bar fit, text size and contrast; it also
loads a manifest with row variants omitted to verify dark fallback in three states. Full
MainCityScene visual QA still checks the real scrolling and clipping hierarchy.
