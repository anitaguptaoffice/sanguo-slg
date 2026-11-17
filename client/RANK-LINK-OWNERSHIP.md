# Rank row navigation ownership

Task: CLIENT-RANK-LINK-OWNERSHIP-001, issue #2491.

A delayed rank-row hero lookup must not reopen Hero after the player closes Rank,
opens another panel, changes boards, refreshes the row snapshot, or chooses a newer row.
The former second hero lookup also wrote return-scroll before navigation was confirmed.

Each activation now captures actor/session generation, mounted panel, foreground intent,
board/read generation, row identity, and the latest activation version. Both lookup
continuations must retain ownership before dispatch. Hero return-scroll is written only
immediately before a valid handoff. Stale failure feedback is suppressed; a current custom
lookup failure is reported without an unhandled rejection. Ordinary empty/error fallback,
resource-board world/summary links, and successful hero return-scroll remain unchanged.

`SocialPanels.rankNavigation.test.ts` exercises actual DOM activation, MainCityScene's
production rank callbacks, HeroMailPanels, and GatewayClient serialization/session/trace
checks with production protobuf messages and ordered controlled WebSocket responses.
This is deterministic DOM/wire integration, not native-browser or live-server acceptance.
Run `npm test -- --run src/ui/SocialPanels.rankNavigation.test.ts` and the full client
suite/build. No new RPC, backend, contract, UI layout, or historical HOLD content is added.
