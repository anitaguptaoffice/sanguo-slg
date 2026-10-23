package wsstress

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config drives a WebSocket connection stress run.
type Config struct {
	WSURL              string
	Concurrency        int
	HandshakeTimeout   time.Duration
	DialParallelism    int
}

const (
	envWSURL            = "LOAD_WS_URL"
	envConcurrency      = "LOAD_CONCURRENCY"
	envHandshakeTimeout = "LOAD_HANDSHAKE_TIMEOUT"
	envDialParallelism  = "LOAD_DIAL_PARALLELISM"
)

// DefaultConcurrency is the PLAT-002 acceptance target.
const DefaultConcurrency = 3000

// ConfigFromEnv reads stress settings from the environment.
func ConfigFromEnv() (Config, error) {
	wsURL := os.Getenv(envWSURL)
	concurrency := DefaultConcurrency
	if v := os.Getenv(envConcurrency); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return Config{}, fmt.Errorf("%s must be a positive integer", envConcurrency)
		}
		concurrency = n
	}
	handshake := 30 * time.Second
	if v := os.Getenv(envHandshakeTimeout); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			return Config{}, fmt.Errorf("%s must be a positive duration", envHandshakeTimeout)
		}
		handshake = d
	}
	parallelism := 200
	if v := os.Getenv(envDialParallelism); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return Config{}, fmt.Errorf("%s must be a positive integer", envDialParallelism)
		}
		parallelism = n
	}
	return Config{
		WSURL:            wsURL,
		Concurrency:      concurrency,
		HandshakeTimeout: handshake,
		DialParallelism:  parallelism,
	}, nil
}
