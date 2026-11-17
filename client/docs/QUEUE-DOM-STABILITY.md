# Active build queue DOM stability (#2518)

Unchanged active-build renders retain the connected row, original speedup button
and optional cached image. This prevents per-second focus loss and image churn.
The renderer still generates fresh countdown, progress, linked quest actions,
selection/pulse classes, inventory availability and busy/recovery state.

Reuse requires the same ordered unique valid slot/building/level/finish/inferred
start identities, actor/session/lifecycle ownership, and original connected list
children with a speedup button. Invalid or duplicate identity, changed ordering,
addition/removal/completion, completed-todo rows, loading/error, actor/session or
mount change all retain the existing full replacement behavior. Replacing only
the authoritative buildings array with equivalent records does not lose focus.

Only non-speedup children are replaced on a retained row. The button and its
image never detach; title/disabled/item identity are updated explicitly, while
skin-owned attributes/styles/listeners remain intact. Existing image cache/error
fallback and consumption guards remain authoritative. No new RPC is introduced.
Recruit rows, other panels, layout and navigation behavior are unchanged.

Mounted tests verify connection/focus, live values and invalidations. Full client
tests, type/build, independent source review and applicable CI remain gates.
The old icon QA's tick-detachment assertion is no longer applicable: a separate
native observation must expect stable nodes during unchanged ticks and capture
live countdown/progress plus normal structural replacement. Historical #2513
artifacts must not be relabeled or edited to claim this behavior was tested.
Rollback restores the original per-render build-list replacement.
