# Guild interaction and summary visibility

Task #2302, CLIENT-GUILD-INTERACTION-VISIBILITY-001. New implementation on
main `757e43a9f40d7c92ded6a536ec334de94d69ff6f`.

The intentional role-group rerender replaces its native button. When that button
owned focus, restore focus to the same role's replacement with `preventScroll`.
Unfocused clicks do not steal focus. Escape remains handled only by the existing
panel-root listener. No navigation, chat, ranking or RPC semantics change.

The member-online summary now paints an opaque dark backing beneath its light
text instead of relying on ancestor colors hidden by the cream panel artwork.
The guild-only rule preserves text, recursive headers and role counts. Unknown
presence semantics remain a separate repair (#2290 / #2294).

`SocialPanels.guildInteraction.test.ts` mounts the actual component and decodes
production guild protobuf responses. It covers repeated role toggles, replacement
focus, Escape/trigger return, reopen without a fetch, explicit refresh, unrelated
focus, and normal/narrow local summary backing. Baseline: four failures (both
role focus checks and both transparent-background checks), one control passes.
JSDOM `.click()` exercises the real handler but does not prove trusted keyboard
activation, scrolling, pixels or native readability.

Before merge, independently review both this component on main and its exact
combination with #2294, run complete client tests/build and exact-head required
CI, and pass the corrected official four-case Chromium gate: untouched main
baseline defect controls versus the complete presence-plus-interaction repair,
each at 1280/1600. Source-alone validation is separate component coverage.
Preserve pointer collapse, Tab/Enter,
Escape, reopen/refresh, clipping, readable screenshots and economy/traffic/cleanup
checks. Failed run 42437155202 remains failure evidence, not a pass.
No historical hold, original art, production deployment or global key capture.
