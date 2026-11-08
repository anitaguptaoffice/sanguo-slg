# Radio boundary replay: prospective schema 2

This component is DOM-free deterministic validation; it cannot collect events, drive input, authorize execution or declare native success by itself.
Exports: `validateRadioPrecondition(snapshot,{variant,direction})`, `validateRadioTrial(trial,{variant,direction})`, `validateCompletion(report,{variant,width,provenance})`.
The precondition returns original/expected descriptors and must run on the saved immediate snapshot before any native Tab callback. The trial validator reuses it.
Variants are baseline/fixed; baseline permits forward only. Fixed permits forward/reverse. Trial indices are 1..3; after contains exactly three samples.
Schema 2 snapshots and event envelopes require null failure and false overflow. Legacy/missing capture, inventory, final boundary or mixed schema fails closed.
Raw descriptors require identities, ownership, selection, eligibility, geometry and ancestor states. Repeated same-ID candidate/inventory/active/held/submit records must agree within each synchronous snapshot.
Shared ancestor states must agree, without equating node-specific inSummary relations. Complete candidate-radio inventory membership/order and raw visibility eligibility are cross-checked.
Replay recomputes eligible IDs and checked-radio projection from raw records. Existing collector labels or trusted booleans never substitute for these structural tests.
The actual group must contain usable checked gold and unchecked item with the same name/form/root, matching the final two raw candidates and projected last gold.
Each before/capture/phase-zero-final/three-after frame independently validates. Stable first/gold IDs, complete relevant group order/state, root and disclosure state are required.
Unrelated middle candidate replacement is allowed only with unchanged true boundaries and group. Every raw candidate array is retained; changed actual boundary, group insertion/replacement or unusable held/active fails.
Mutable descriptors, including geometry, are not frozen across sample times. The same-frame event target/active and final active must match their corresponding boundary records.
Exactly one trusted Tab keydown must target the original active node with the requested modifiers. Event phases, ordering, timestamps, cancellation, held identity, focus events and absence of input/change remain mandatory.
The microtask checkpoint is never final. Final evidence requires retained actual-event phase zero and a fresh full boundary after the awaited action.
Baseline requires uncancelled escape to BODY; fixed requires cancellation and expected wrapping at all three samples. No repair, retry or inferred semantic success is permitted.
Completion schema 2 requires exact viewport (1280x720 or1600x900), ordered three baseline or six fixed trials and exact provenance.
Provenance requires qa/collector/replay/runtime/geometry/product entries, each clean:true with full head/tree/nonempty parents. External review must verify these claims against actual immutable objects.
Run `node .github/scripts/live_hero_radio_replay.test.mjs`; it imports the exact collector test fixture and thereby runs both complete suites. Production replay imports only node:assert/strict.
Preserved tests include all 62 original negatives, 22 shared preguards, 67 boundary mutations/missing boundaries and middle replacement positives.
Added tests cover all six sample positions and simultaneous conflicting snapshots, envelope/event mismatches, shared ancestor inconsistency and legitimate cross-frame geometry movement.
Fixtures explicitly set trusted:true only as synthetic validator input. Actual serialized collector fixture events remain untrusted; neither form proves native behavior.
A future runner must pin both complete components separately, verify copied bytes/clean mappings, run both suites plus unchanged runtime/geometry controls, save all evidence before verdicts and audit cleanup/DB/economy independently.
No current run is reclassified. This scratch pair requires independent review and scope registration before repository implementation, publication or native execution.
