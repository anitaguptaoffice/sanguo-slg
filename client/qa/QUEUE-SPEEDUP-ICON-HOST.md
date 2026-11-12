# QA-QUEUE-SPEEDUP-ICON-001

Registration #2511, CLIENT #2508, independent contract #2507 / #2510.
Immutable merged-main source 93618e18902ca2e54375069808281044b51b0889,
tree 7a1555da00470a54ec5f6c5dda9e4818e9a715eb, based on main e89520eb.
New execution remains gated on independent pin/composition review. Pin changes require renewed review and affected tests, not blind reruns.

This harness runs actual main.ts/MainCityScene/QueuePanels/AssetLoader and item
2003 production PNGs using locked Playwright Chromium with sandbox enabled on
official Ubuntu 22. No local browser retry, native economy or deployment claim.
A disposable copy of the repository mock uses existing queue-build fixtures.
A local file selects stock-present or stock-absent for each fresh session;
no mutating request seeds the fixture. Nothing changes production source/data.

Six viewport/DPR groups each exercise enabled and disabled controls, skin on,
off, off-redraw-on, keyboard refresh, Escape/reopen and three repeated refreshes.
Refresh requires an actual GetCityState route and replaced button DOM. All text
Ranges, image and button bounds are checked against viewport and every clipping
ancestor after scrolling; image identity, label/title/disabled, 20px size,
spacing, pointer behavior and non-focusability are asserted. Enabled speedup
buttons are never clicked. Missing PNG, absent manifest/cache entry and DOM image
error preserve text-only controls. Route logs, geometry, screenshots, source
head/tree and harness hash are preserved including failures. Entry boundary is
visible main toolbar. Read-only bag navigation loads real stock into the session
before opening the queue; every later route must match the explicit read allowlist, otherwise
acceptance fails. Earlier routes are retained separately for independent review.
Bounded TERM/KILL service cleanup and browser cleanup are recorded and asserted.

Independent raw artifact, pixels, geometry, route and cleanup review remains
mandatory. Syntax checks do not replace browser acceptance. Source full client
suite/type/build and all exact-head required CI must pass. Holds remain excluded.

## Preserved first run and observation correction

Run 43146975469 / job 130946958678 failed on disabled 1280x720 DPR1 after
successful off-redraw geometry: Playwright scrollIntoViewIfNeeded retained a node
while waiting for stability and QueuePanels' one-second render replaced it.
Artifact 13911603271 preserves report, logs and pixels, ZIP SHA256
f5915dee2977f5c7fe20da6c686b7c44caaeca86403ecae8106a8390852cf15e.
No geometry assertion or mutation gate failed; later groups were not completed.
Correction selects the current host, instant-scrolls it and measures every Range,
image, button and clipping ancestor in one synchronous evaluation with membership
checks. No retry, timer freeze, product change or relaxed geometry/route gate.
Partial current-case evidence is retained. Independent review precedes a new run.

## Merged-main provenance run

Previous successful run 43147599430 / artifact 13911888337 remains evidence for
product 85185e8d1d399e86dae5dcae20c76c601738490b, runtime tree
f0d9b40da03bafa01ba5d81b76892a51f7ef31f2. Its ZIP SHA256 is
559af86b226e1b68f5eb78cfd28ef2196936c0e00cf7461a3072cc6c95349e75.
The new pin targets normally merged main 93618e18902ca2e54375069808281044b51b0889;
its only difference from that product source is the independently accepted
67-line docs/art/queue-speedup-icon-host.md. Runtime and harness behavior are
unchanged. A new official run establishes merged-main provenance, not a retry
of a failed test. Preserve the prior success and original failed run separately.

## Preserved merged-main pixel gap and capture gate

Run 43148806420 / artifact 13912394287 completed with successful numeric gates,
but independent raw review found blank restored image slots in both 1280/DPR1.5
stock states. ZIP SHA256
3791a0d5edf8de729a431b0d90cc8a57dc9402d7bf02dfc16f265b022b865423
is preserved; that run is not accepted pixel evidence. Old loaded-node readiness
was not tied to the nodes in the PNG, so a redraw/decode race is plausible but
unproven; this does not exclude a real transient presentation defect.

Capture now waits for one natural redraw, decodes the current images, waits two
animation frames, measures unchanged geometry and captures exactly once. It
records current image intrinsic dimensions and verifies identical connected
host/image nodes after capture. Changed membership or readiness fails, preserving
the PNG rather than retrying. Timers/rendering remain live; no product, route or
geometry gate changes. The DOM-error fallback is injected on the aligned redraw.
All39 captures require this gate; independent pixel inspection remains mandatory.

## Capture-generation timing diagnostic

Run 43150168256 / artifact 13913326831 failed closed at capture13, 1280/DPR2
stock-present/on: sameHosts=false, sameImages=false, ready=true. The prior12
captures kept identity. Its ZIP SHA256 is
7f2d77ab2fa487b634ebd52efcb0225fb75b2ba02c1322d61a203499aad572fd.
Independent native-resolution inspection sees an icon in capture13; a downsampled
preview's initial blank interpretation was incorrect. The evidence proves a
crossed generation, not blank pixels or a screenshot taking longer than one second.

Diagnostic capture records monotonic phase times plus passive host-generation
observations and before/after current node tokens, sources and intrinsic readiness.
The observer only records DOM changes and dies with its page; timers stay live.
Locked Playwright1.49.1 Chromium protocol supports Page.captureScreenshot with
optimizeForSpeed:true: lossless PNG encoding favors speed over size. Native capture
uses the same sandbox browser, fromSurface:true and captureBeyondViewport:false;
it retains the full viewport at original DPR, checked via PNG signature/dimensions.
There is no unsupported-protocol fallback or retry. Postcheck runs immediately
following native screenshot return, before filesystem persistence. PNG bytes are
preserved even when postcheck fails. The identity gate still spans decode, geometry
and compositor capture completion, excluding later disk I/O. No gate is relaxed.
Timing explains only observation validity; independent native-resolution pixel
review is still mandatory and stable decoded identity alone is not painted proof.

## Preserved native-resolution diagnostic and explicit viewport clip

Run 43151435193 / artifact 13913942585 failed the physical PNG dimension gate at
1280/DPR1.5: un-clipped native capture returned1280x720, not1920x1080. ZIP SHA256
19721b1ca8a6bb0a1ce277cb7105470561f4ae9566dc915e86c625833c329b34
is preserved. Seven capture brackets stayed stable, native capture103–142ms;
this partial result does not establish final acceptance.
The correction follows locked Playwright crPage.takeScreenshot and
helper.enclosingIntSize: record Page.getLayoutMetrics.visualViewport; clip at its
pageX/pageY with floor(viewportSize/scale+0.001), using its scale unchanged.
No deviceScaleFactor division, blind DPR multiplication or image resampling.
Full-viewport/native-dimension, generation, readiness and geometry gates remain.
