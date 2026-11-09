// Package shard implements分服路由与 server_id 会话上下文（PLAT-004）。
//
// # 单服写边界
//
//   - 全局（无 server_id）：account、account_session、cfg_* 配置表。
//   - 分服（必须带 server_id）：player、player_wallet、地图/内政/军事/军团/聊天/排行等玩法态表。
//
// 网关鉴权后，装配层将 server_id 绑定到会话；业务 handler 只读写当前会话服的数据，
// 禁止跨服 UPDATE/DELETE。读列表（选服）可走全局 game_server 元数据表。
//
// EnterGameServer emits the positive account.account_id resolved from its valid
// session, using that same identity for player lookup and session binding. The
// ID is global across shards and session rotation, not a credential or token
// derivative. Missing wallets remain zero balances without creating a row.
// Sequential session checks do not promise linearizable concurrent revocation.
// This producer does not activate V2; API/client correlation and safe legacy
// fallback remain separate gates under spec/proto/AUTH-ACCOUNT-IDENTITY.md.
//
// Run authenticated identity regressions on a newly owned disposable PG17 DB:
//
//	SHARD_IDENTITY_TEST_DSN=<disposable-dsn> go test ./internal/platform/shard -count=1
//	SHARD_IDENTITY_TEST_DSN=<disposable-dsn> go test -race ./internal/platform/shard -count=1
//
// Tests create and remove isolated schemas from the canonical account/domestic
// migrations. Missing DSN skips are not acceptance; ordinary and race runs must
// pass both TestEnterGameServerAuthenticatedIdentity and
// TestEnterGameServerRejectsUnauthenticatedIdentity with every subtest and no skips.
package shard
