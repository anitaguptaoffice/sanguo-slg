// Package account implements the global account center: registration, login,
// session refresh, and per-server player lookup (one account, many shards).
//
// Wire into the WebSocket gateway with GatewayHandlers and SessionValidator;
// merge PublicRoutes into gateway.Config.PublicRoutes.
package account
