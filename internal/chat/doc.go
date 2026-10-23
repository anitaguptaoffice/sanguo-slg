// Package chat implements world and private chat channels (M3 / CHAT-001).
// Guild channel send/list returns forbidden until GUILD-002 wires membership checks.
// PG persistence follows SPEC-005 m3_003_chat; mute deadlines use chat_player_mute (pg_mute.go) until DDL lands in spec/db.
package chat
