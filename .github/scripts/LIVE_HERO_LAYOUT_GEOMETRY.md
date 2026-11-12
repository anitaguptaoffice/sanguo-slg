# CI-HERO-LAYOUT-GEOMETRY-001

Independent CI observation component C, registered under [authority #2279](https://github.com/anitaguptaoffice/sanguo-slg/issues/2279). This implementation requires source review, actual mapping and Draft validation before B may use it; it is not live approval.

C owns only read-only DOM observation and pure geometry, readiness, direction and movement decisions. It never launches a browser, starts a service, chooses product data, mutates DOM, sends input or calls game APIs. It has no runtime A dependency. Its Node tests import the actual production exports and use browser-free DOM samples.

Frozen exports: inspect, visibleTarget, usableRoster, layoutSignature, hasFullVisibility, wheelReady, wheelPlan, targetDelta, toggleDirection, assertDirections and wheelPosition. No other exports. B alone owns scenario order, fixed 13-case completeness, native input and bounded retries.

inspect(element) reads timestamp, own open state, rectangles, clipping ancestors, sampled hits and scroll dimensions. visibleTarget(sample, full=false) rejects empty, clipped or occluded targets; full=true also requires full width/height. usableRoster(geometry) requires at least64px visible height, panel containment and toolbar clearance.

layoutSignature(frame) ignores only the capture timestamp. hasFullVisibility(sample) is the boolean form of the complete visibility assertion. wheelPlan(sample, top|bottom|finiteDelta) returns a sampled hit point and real-extent delta but never sends input. targetDelta(geometry) plans vertical roster movement and rejects non-vertical clipping repairs.

wheelReady(current) requires current hit, open state where applicable and actual overflow. toggleDirection(before,after) distinguishes open, close and no observed change; assertDirections requires both observed directions.

wheelPosition({selector,top,start=null}) reads the actual current node. It requires open/overflow and target end position. With a recorded start, downward progress must increase scrollTop and upward progress must decrease it to at most1; a closed reset, unchanged positive position, missing overflow or wrong direction cannot pass.

The complete tests preserve B's original clipping, null/occluded hit, zero/partial geometry,64px/panel/toolbar, wheel planning, screenshot-state, direction-completeness and target-delta negatives, and add actual directional-movement controls. Missing import/tests must fail. These are pure checks, never a live PASS.

B must check out the exact approved C commit, full tree and sole parent; copy the unchanged module, compare it byte-for-byte and execute this whole test file before every one of its four official cells. B retains all13 cases, original run1 FAIL artifacts, actual service/protocol/economy and strict A cleanup. A stays exact7dc; products stay a7cd/3bbd. Full C, B and A/B/C/product compositions require independent review. All QA Drafts never merge.
