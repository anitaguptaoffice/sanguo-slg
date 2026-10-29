package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("LOG_LEVEL", "")
	t.Setenv("HTTP_ADDR", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_ADDR", "")
	t.Setenv("MIL_FRESH_PROFILE_FILE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Fatalf("HTTPAddr: got %q", cfg.HTTPAddr)
	}
	if cfg.DatabaseURL == "" || cfg.RedisAddr == "" {
		t.Fatal("expected non-empty database and redis defaults")
	}
}

func TestLoadFromEnv(t *testing.T) {
	t.Setenv("HTTP_ADDR", ":9090")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("MIL_FRESH_PROFILE_FILE", "/run/reviewed/mil-profile.json")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTPAddr != ":9090" || cfg.LogLevel != "debug" ||
		cfg.MILFreshProfileFile != "/run/reviewed/mil-profile.json" {
		t.Fatalf("unexpected cfg: %+v", cfg)
	}
}
