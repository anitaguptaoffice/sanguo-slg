# Queue speedup icon (#2508)

QueuePanels marks only its existing speedup button with the current item ID.
The existing MainCityScene reskin callback reaches the queue-only decorator
before primary skin's off/already-skinned guards. No scene changes are required.
Only cached item.icon.2003.v1 with matching ID/kind and nonempty source is used;
AssetLoader retains DPR selection. No additional request or action is introduced.

One decorative 20px image retains the original text, title, disabled state and
focus target. Scoped CSS permits wrapping rather than clipping text, hides the
icon immediately on skin-off, and restores it after off-mode redraws without
observers, timers or extra toggle listeners. Repeated reskins reuse the image;
errors remove it and suppress that source on that button until it changes.
Detached buttons and failure state are collectable. Shared primary skin behavior
and its existing disabled observer are unchanged.

Tests exercise the shared callback and actual mounted QueuePanels, refresh/reopen,
stock states, missing/invalid cache, image error, repeated reskin and skin toggles.
Official production-entry browser QA, independent review and exact-head CI are
separate required gates; unit tests do not establish clipping or native backend
acceptance. Contract: #2507, docs/art/queue-speedup-icon-host.md.
Rollback removes the marker/hook/helper and restores text-only UI.

Review correction: an error from a replaced/detached image cannot update the
current button's failure state. Both same-source replacement and a newer failed
source are regression-tested; the original review failure evidence is retained.
