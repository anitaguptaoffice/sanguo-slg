# Recovering an existing guild by explicit ID

CLIENT-GUILD-REENTRY-001 / #2076.

A fresh client has no guild context. The player may enter their known guild ID and click the
existing Join button. If JoinGuild returns GUILD_ALREADY_MEMBER (60002), that error alone proves
only membership somewhere: internal/guild/service.go checks membership before requested guild.

The client then performs one read-only ListGuildMembers for the captured ID, page 1. Recovery
requires matching returned guild ID, matching shard and the positive authenticated player ID in
the roster. A name match, missing identity, other guild/shard, empty page, or failed read is not
evidence. The current page size and normal guild limit are both 50; absence never starts an
unbounded search. Unknown guild IDs are not automatically discovered or persisted.

Verified recovery reuses the existing member-list and chat context, reports restored membership,
and does not repeat Join/Create or send chat automatically. The server's RequireGuildMember
still authorizes every guild chat operation. A roster is a current snapshot, not a permanent
permission grant. Existing actor/panel ownership and shared in-flight lock protect recovery
through re-login, panel replacement and repeated clicks. Create failures do not use this path.

Tests use production GatewayClient protobuf serialization/decode with source-grounded fixtures
and mounted SocialPanels: existing/fresh joins, wrong/missing identities, read failures, no replay,
pending locks, actor changes and explicit guild chat. No response-order inversion is required.
This is not live Go/PostgreSQL or browser acceptance. No protocol, backend, authentication,
persistent cache, layout or new control is added. Held ranking work #2006 remains separate.
