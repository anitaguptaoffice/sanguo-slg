// Package account implements the global account center: registration, login,
// session refresh, and per-server player lookup (one account, many shards).
//
// Wire into the WebSocket gateway with GatewayHandlers and SessionValidator;
// merge PublicRoutes into gateway.Config.PublicRoutes.
//
// RecruitActorGuard.AccountHint is a dormant source-bound, unlocked discovery
// port, not session authentication or authorization. The fixed coordinator must
// pin all participants, then use Lock to recheck account status and association
// in account-before-player order. Stale hints require rollback and a fresh attempt;
// this package adds no production return caller or recovery activation.
package account
