# Authenticated client identity

CLIENT-AUTH-IDENTITY-SESSION-001 / #2370 implements adopted
spec/proto/AUTH-ACCOUNT-IDENTITY.md in the real gateway and bootstrap path.
Only entry account_id is kept losslessly as a decimal string. Other numeric UI
fields retain their existing safe-number guards. Invalid, conflicting, negative,
overlong or overflowing selected identity wire fields disable identity; safely
decodable legacy entry remains available. Ordinary unknown fields are skipped.

GatewayClient.getAuthenticatedIdentity returns a frozen current account/server/
player/generation tuple, only from authenticated, trace-correlated successful
entry matching the requested scope. Connect, close, login and select attempts
clear it before waiting. Bootstrap's accessor rechecks the exact current identity
and generation every call; copying an old tuple never makes it authority.
Tokens, names, registration and cached actor data never establish identity.
Absent/zero old-server identity leaves legacy entry available without a scope.

No journal/storage or V2 route/command is added, enabled, deleted or replayed.
Future journal consumers must call the live accessor, retain old records across
scope changes and independently satisfy capability/reconciliation/rollout gates.
Run npm test and npm run build in client. Tests use real protobuf and gateway
RPC/trace/generation paths with event transport or isolated reply doubles.
They are not browser/native, real producer/API, durable restart or rollout proof.
