# Reconstructed retained focus observer

CI-HERO-FOCUS-PROBE-001, issue #2314. QA only, NEVER MERGE.
This is new source from the public #2283 contract, not recovered 747/72 source
or an implementation of the unavailable historical proposed 85-test manifest.
The three files, including tests and this document, share one 400-line cap.

The observer owns private retained panel/host/direct-summary/control references,
read-only capture listeners, first closure/rAF storage and bounded trace cleanup.
`withProbe` owns one handle, including late acquisition and partial failure.
The runner alone owns native actions, terminal/deadline policy, A and reporting.
`validate(stage, value, expected)` has explicit identity/preparation/input/arm/
trial/directions/complete stages. Live and tests use the same pure predicates.
Schema 1 carries named trials, exact provenance, snapshot node facts, input
brackets, copied safe requests, two arm snapshots/Node boundaries and trace
kind/target/related/snapshot. Browser mono and Node wall clocks are distinct.
Zero pending reads and no request crossing either arm boundary are mandatory.
A's first completed response is checked against the independently first sent poll.
Only first closure and next frame qualify; overflow or missing evidence fails.
Transient focusout BODY is valid trace evidence, not a fixed-frame PASS.
Node must guard before all effects and after awaits, harvest detached evidence,
then dispose successfully before converting a pure failure into report.errors.

Run `node .github/scripts/live_hero_focus_probe.test.mjs` without a browser.
Mock DOM tests exercise this actual installer, not trusted input or native focus.
The runner must retain unchanged A and all its tests; official native four-cell
acceptance and independent raw-archive review are separate required gates.
Focus success never clears layout/wheel/training or historical holds.
