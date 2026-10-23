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
}

// Load reads configuration from environment variables with local-dev defaults.
func Load() (Config, error) {
	cfg := Config{
		LogLevel:    envOr("LOG_LEVEL", "info"),
		HTTPAddr:    envOr("HTTP_ADDR", ":8080"),
		DatabaseURL: envOr("DATABASE_URL", "postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable"),
		RedisAddr:   envOr("REDIS_ADDR", "localhost:6379"),
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
