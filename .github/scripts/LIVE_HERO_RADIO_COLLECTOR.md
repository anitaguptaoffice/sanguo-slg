# Radio boundary collector: prospective schema 2

This independent component collects browser facts; it makes no acceptance verdict and schedules no input.
API: serialize `installRadioCollector({panelSelector,maxEvents=256})` into the page, obtaining `snapshot(heldId=null)`, `readEvents()` and idempotent `dispose()`.
It is self-contained, with no imports or closure dependency inside the serialized function.
Snapshots require a live installed collector. Disposal makes snapshot throw and readEvents return the frozen, deep-copied terminal archive.
Raw snapshot schema 2: at/mono, rootId, active/held descriptors, ordered candidates, eligibleIds/intendedIds projections, full tree-scope radios, submit, details, overflow and failure.
Descriptors contain id/tag/type/name/value/checked/disabled/effectiveDisabled/tabIndex/tabIndexAttribute/formId/scopeId/connected/inPanel/rect/own/ancestors.
Own style contains hidden/inert/ariaHidden/display/visibility/open. Ancestors add id/tag/inSummary; rect has finite x/y/width/height when valid.
WeakMap node identity is stable during collection; separate samples remain fresh observations, including mutable geometry and selection.
Raw candidate order uses the existing shared-selector semantics. Full radios include disabled/outside candidates so replay can test membership and ownership.
Projection arrays are observations to cross-check, never authoritative pass labels.
Window capture observes keydown/focusin/focusout/input/change without modifying DOM, events, focus, selection, scroll or attributes.
All event rows contain id/type/phase/at/mono/trusted/target/active/related. Keydown additionally contains key/code/modifiers/initialPrevented/boundary/captureCheckpoint/final.
Keydown boundary is synchronous during real window capture. The microtask checkpoint records phase/prevented/active/time but is never final propagation evidence.
Only a subsequent snapshot/readEvents finalizes a retained actual Event whose eventPhase is zero, recording prevented/active/time and a fresh full boundary.
The runner must await the native keyboard operation before that read. A collector cannot prove a caller awaited correctly or authenticate fabricated JSON.
readEvents returns schema 2, events, overflow and failure. Replay must reject overflow, any failure or missing required records.
Event budget is 1..2048; node budget is 2048. Overflow is sticky. Collection exceptions close listeners and retained references and archive a failure.
Disposal clears retained events/nodes and prevents queued callbacks from observing or changing archived rows. It neither finalizes nor invents missing records.
Run `node .github/scripts/live_hero_radio_collector.test.mjs` with the existing client jsdom dependency; no package or browser installation is needed.
Tests install the actual serialized function, retain all original collection tests, exercise middle replacement, limits, missing panel, invalid options, pending/finalized/double disposal and snapshot/capture/checkpoint/final failure cleanup.
The test exports the offline fixture for exact-pinned replay integration. Importing it deliberately runs its entire suite; JSDOM events remain untrusted.
Synthetic DOM/layout fixture mutations belong only to tests. Native acceptance needs independently audited source/provenance, real event/raw artifacts and the separate replay/runner/DB/economy gates.
No old native evidence is upgraded: the prior 3PASS/1FAIL and all original raw remain unchanged.
