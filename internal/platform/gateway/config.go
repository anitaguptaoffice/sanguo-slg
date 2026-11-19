package gateway

import "time"

// Config tunes the WebSocket gateway (no env parsing here — callers map from platform config).
type Config struct {
	// WebSocket path, default "/ws".
	Path string
	// Max simultaneous connections (0 = unlimited).
	MaxConnections int
	// Per-connection inbound message rate limit (0 = disabled).
	MessagesPerSecond float64
	Burst             int
	// WebSocket ping interval and read timeout (pong must arrive within timeout).
	PingInterval time.Duration
	PongWait     time.Duration
	// Routes that do not require a valid session_id.
	PublicRoutes map[string]bool
}

// DefaultConfig returns production-ish defaults.
func DefaultConfig() Config {
	return Config{
		Path:              "/ws",
		MaxConnections:    10_000,
		MessagesPerSecond: 20,
		Burst:             40,
		PingInterval:      30 * time.Second,
		PongWait:          60 * time.Second,
		PublicRoutes: map[string]bool{
			"account.v1.Login": true,
			RoutePing:          true,
		},
	}
}

// RoutePing is the gateway heartbeat route (gateway.v1.Ping).
const RoutePing = "gateway.v1.Ping"
