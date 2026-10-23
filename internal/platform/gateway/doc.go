// Package gateway implements a stateless WebSocket edge: handshake, auth,
// heartbeat, reconnect, rate limiting, and IP allow/deny. Business logic lives
// behind RouteHandler; payloads use protobuf ClientPacket / ServerPacket from
// spec/proto (generated under pb/).
package gateway
