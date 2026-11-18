# Recruit V2 server handler

API-RECRUIT-V2-HANDLER-001 (#3093) implements the packet-to-transaction
adapter for #1950. The caller must pass the gateway's live session
validation before dispatch. Account/player/shard come from the session
binding, and the transaction verifies actor ownership again. The full
typed intent and exact command ID reach the existing durable generation.

Only confirmed commits produce the immutable receipt response. Clean
count and unit rejections no longer close the generation. Exact, clean
business rejections are distinguishable from unavailable outcomes. WORLD
and ACCOUNT compound source/authorization errors remain unavailable.

The runtime router still omits V2. Shared-source composition, writer
fences, durable browser journal and end-to-end verification under
MIL_RECRUIT_TRANSPORT section 5 are prerequisites to enabling it.
