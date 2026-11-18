package config

import (
	"fmt"
	"os"
)

// Config holds process-wide settings loaded from the environment.
type Config struct {
	LogLevel    string
	HTTPAddr    string
	DatabaseURL string
	RedisAddr   string
	// MILFreshProfileFile is the reviewed MIL startup profile path. Empty
	// leaves the durable military path disabled.
	MILFreshProfileFile string
	// PreparedFirstCity selects the isolated loopback startup path.
	PreparedFirstCity bool
	// PreparedRecruit enables the proven local Recruit V2 route and due worker.
	PreparedRecruit bool
	// PreparedMarch enables durable departure, battle and return on loopback.
	PreparedMarch bool
}

// Load reads configuration from environment variables with local-dev defaults.
func Load() (Config, error) {
	cfg := Config{
		LogLevel:    envOr("LOG_LEVEL", "info"),
		HTTPAddr:    envOr("HTTP_ADDR", ":8080"),
		DatabaseURL: envOr("DATABASE_URL", "postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable"),
		RedisAddr:   envOr("REDIS_ADDR", "localhost:6379"),

		MILFreshProfileFile: os.Getenv("MIL_FRESH_PROFILE_FILE"),
		PreparedFirstCity:   os.Getenv("SANGUO_FIRST_CITY_USE_PREPARED_CITY") == "1",
		PreparedRecruit:     os.Getenv("SANGUO_PREPARED_RECRUIT") == "1",
		PreparedMarch:       os.Getenv("SANGUO_PREPARED_MARCH") == "1",
	}
	if cfg.HTTPAddr == "" {
		return Config{}, fmt.Errorf("HTTP_ADDR must not be empty")
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
