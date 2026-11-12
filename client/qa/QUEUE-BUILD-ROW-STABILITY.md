# QA-QUEUE-ROW-STABILITY-001

Registered scope: https://github.com/anitaguptaoffice/sanguo-slg/issues/2520
Product dependency: #2518 / #2519.
Dedicated QA only; original #2513 files and all previous raw results remain unchanged.

## Immutable inputs

- Product: b9ec649833523887f84dccc862021465f83a4c8f
- Product tree: 95664daba694c631e9e1d635d37b7a2bc4c92095
- Product base: ddc80aab; actual source mapping independently reviewed.
- Art contract: docs/art/queue-speedup-icon-host.md in the pinned source.
- Baseline harness: #2513 head 1dcd1214f9ff51890c9575339cf94b0b218e4b74.
- Original baseline had strict identity failure, not accepted current-main pixels.
- Earlier acceptance 43154418624 applies only to product 93618e, not this product.

## Observation contract

The product preserves unchanged active build rows and their speedup button/image.
It still replaces rows for explicit loading refresh and structural/session changes.
The new harness does not wait for periodic host detachment: that is now a failure.
It retains the original current-node decode, two paint frames and fail-closed capture bracket.
No timer is frozen and no failed observation or capture is retried.

For each of twelve normal cases, finish explicit refresh and image loading first.
Ensure the observed gateway has no pending city read; focus the enabled button or disabled row.
Record exact row/button/image ownership and start one 6.5-second no-input interval.
A passive MutationObserver records any removal of a retained node or its ancestor.
A blur listener records even temporary focus loss. Other countdown/progress children may change.
Require unchanged connected ownership, loaded images, focus retention and both countdowns advancing.
Record progress and require numeric 0–100 with matching rendered fill width.
The hour-long fixture can legitimately clamp progress to zero; percent movement is not claimed.
Product mounted tests separately cover dynamic progress changes.

Observe actual sandbox WebSocket frames, not only mock request logs.
Decode pinned protobuf envelope and city response contracts using locked protobufjs.
Require a nonempty trace ID, matching successful response and retained slots in its buildings.
The request must start after observation begins and complete before it ends.
No action is sent during that interval, so the completed city read is unsolicited.
Record monotonic request/response timestamps; do not attribute a particular render to that poll.
Unknown decoding errors, missing response/countdown evidence or identity loss fail the run.

## Unchanged native acceptance gates

- Six viewport/DPR groups: 1280×720 and 1600×900, each DPR 1/1.5/2.
- Six disposable blank-page native-dimension preflights before app cases.
- Twelve enabled/disabled cases plus missing-image, missing-cache and image-error fallbacks.
- Thirty-nine full-viewport host PNGs; six separate raw preflight PNGs.
- 126 geometry observations: text ranges and image/button against every clipping ancestor.
- 48 same-owned-node off/on lifecycle checks, without waiting for replacement after a toggle.
- Actual toolbar, bag, queue, keyboard refresh and reopen navigation.
- Explicit refresh must disconnect the previous host and restore two new hosts.
- No enabled speedup click, mutation route or item consumption.
- Ordinary bootstrap is excluded; subsequent routes must all match the read allowlist.
- Current images must decode and remain identical/ready throughout native capture.
- Passive generation snapshots, source URLs, natural sizes and monotonic capture stages retained.
- Official sandbox Chromium only; no local native browser execution.
- Same configured viewport/DPR mirrored once onto capture session before navigation.
- Exact full viewport clip, lossless PNG, physical width/height assertions; no resampling.
- Raw capture is saved even if the postcapture identity assertion fails.
- Browser and fixture child cleanup, page errors, source head/tree and harness digest reported.

## Execution and evidence

The workflow checks out the exact product separately from this QA branch, verifies head/tree,
and copies only this harness into its QA directory. It installs locked official dependencies.
It uses the existing disposable local queue-build fixture and original production PNG assets.
No product/server tracked files are changed; local fixture copies are cleaned up.

Source review and negative controls are prerequisites, not native acceptance.
Download the complete official artifact, verify its SHA-256 before extraction, and preserve logs.
Independently inspect all native-resolution host images and all report gates before acceptance.
Any failure remains evidence; no partial-case success or previous run substitutes for completion.
A new product pin requires separate exact-source review and fresh applicable native evidence.
This card does not merge product or QA, deploy production, or release historical holds.
