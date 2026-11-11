# Explicit first-city transport

CLIENT-FIRST-CITY-GATEWAY-001 (#2495) exposes GatewayClient.requestFirstCity for the four world.v2 routes only when explicitly invoked.
Request shape is the adopted request codec shape; options accept signal, timeoutMs (default 15000) and optional knownIntent {scope, proposal} for exact Get C1 correlation.
Only this channel's strict Discovery response establishes lossless scope. It is bound to the socket/session/generation/shard; new Discovery supersedes old channel waits. Login/entry in progress cannot use old credentials.
The strict raw binary envelope precedes payload decoding. Error, abort, malformed response or lost connection rejects with fixed UNKNOWN, never durable rejection, raw server text or automatic retry.
Scope is an equality guard, not authority. ID_CONTENT_CONFLICT preserves the server's original record; different winners are never automatically continued.
The transport owns no journal and generates no command UUID. Before first Submit/Continue, a downstream consumer must crypto-generate a UUID, save the complete intent under its complete scope, and successfully read it back; an argument name or boolean proves nothing about storage.
Existing durable intent and terminal knowledge remain the consumer's responsibility and must survive UNKNOWN/EMPTY/NOT_OBSERVED. Authentication invalidation only clears this channel's temporary scope and waits.
Tests use actual production GatewayClient; native tests use Node WebSocket with a controlled ws loopback peer. They are not Chromium or real V2 handler/city creation evidence. No UI, v1 fallback, server activation or production deployment is included.
