// Package guild implements per-shard legion lifecycle (GUILD-001) and guild-channel chat
// orchestration (GUILD-002). Chat storage and mute deadlines reuse internal/chat via
// ChatCoordinator; call RegisterM3Chat from assembly wiring instead of chat.GatewayHandlers.
package guild
