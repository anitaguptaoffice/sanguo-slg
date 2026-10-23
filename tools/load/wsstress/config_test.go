package wsstress

import (
	"testing"
	"time"
)

func TestConfigFromEnv(t *testing.T) {
	t.Setenv(envWSURL, "ws://127.0.0.1:8080/ws")
	t.Setenv(envConcurrency, "100")
	t.Setenv(envHandshakeTimeout, "5s")
	t.Setenv(envDialParallelism, "50")

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.WSURL != "ws://127.0.0.1:8080/ws" {
		t.Fatalf("ws url: %q", cfg.WSURL)
	}
	if cfg.Concurrency != 100 {
		t.Fatalf("concurrency: %d", cfg.Concurrency)
	}
	if cfg.HandshakeTimeout != 5*time.Second {
		t.Fatalf("handshake: %v", cfg.HandshakeTimeout)
	}
	if cfg.DialParallelism != 50 {
		t.Fatalf("parallelism: %d", cfg.DialParallelism)
	}
}

func TestConfigFromEnvDefaults(t *testing.T) {
	t.Setenv(envWSURL, "")
	t.Setenv(envConcurrency, "")
	t.Setenv(envHandshakeTimeout, "")
	t.Setenv(envDialParallelism, "")

	cfg, err := ConfigFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Concurrency != DefaultConcurrency {
		t.Fatalf("default concurrency: %d", cfg.Concurrency)
	}
	if cfg.HandshakeTimeout != 30*time.Second {
		t.Fatalf("default handshake: %v", cfg.HandshakeTimeout)
	}
	if cfg.DialParallelism != 200 {
		t.Fatalf("default parallelism: %d", cfg.DialParallelism)
	}
}

func TestConfigFromEnvInvalidConcurrency(t *testing.T) {
	t.Setenv(envConcurrency, "0")
	_, err := ConfigFromEnv()
	if err == nil {
		t.Fatal("expected error")
	}
}
