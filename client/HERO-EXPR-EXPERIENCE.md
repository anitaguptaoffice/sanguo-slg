# Training settlement experience

CLIENT-HERO-EXPR-EXP-001 / #2015 fixes the existing training-to-upgrade flow without new controls or protocol changes.

FinishHeroExpr and FasterHeroExpr return authoritative total experience and gained experience, but not the progress used by the upgrade button. The existing helper changed only total EXP, leaving the button blocked by stale progress. The server's `ExpTowardNext` is total EXP minus the current level's cumulative threshold; `FinishExprOnce` does not auto-upgrade.

For a matching hero with known finite total EXP and progress, preserve that level threshold: next progress = old progress + (returned total − old total). Using total differences avoids double-adding a repeated reward response and includes other EXP already reflected in the server total. Preserve exp_to_next, level, attributes and allocations; clear the existing training timer/status as before. Do not clamp legitimate negative protocol progress. Unknown/mismatched/non-finite baselines retain their existing progress instead of guessing; this is not a fix for unrelated response ownership or missing initial detail fields.

Two initial actual-panel DOM tests reproduced blocked upgrades after normal finish and faster finish. Regression drives begin→finish/faster→manual upgrade, with threshold boundaries, cap, failure, overflow, repeated totals, later rewards, a newer level baseline, unknown data and negative progress. Existing gateway methods are mocked; these are client integration checks, not live-server or real-browser acceptance. No rewards, costs, level table, RPC, authentication, assets, deployment or held panel files change.
