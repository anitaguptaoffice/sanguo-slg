// Package shard implements分服路由与 server_id 会话上下文（PLAT-004）。
//
// # 单服写边界
//
//   - 全局（无 server_id）：account、account_session、cfg_* 配置表。
//   - 分服（必须带 server_id）：player、player_wallet、地图/内政/军事/军团/聊天/排行等玩法态表。
//
// 网关鉴权后，装配层将 server_id 绑定到会话；业务 handler 只读写当前会话服的数据，
// 禁止跨服 UPDATE/DELETE。读列表（选服）可走全局 game_server 元数据表。
package shard
