package gateway

import (
	"sync"
	"time"
)

// tokenBucket is a lightweight per-connection rate limiter.
type tokenBucket struct {
	rate   float64
	burst  float64
	tokens float64
	last   time.Time
	mu     sync.Mutex
}

func newTokenBucket(rate float64, burst int) *tokenBucket {
	if rate <= 0 {
		return nil
	}
	if burst < 1 {
		burst = 1
	}
	return &tokenBucket{rate: rate, burst: float64(burst), tokens: float64(burst), last: time.Now()}
}

func (b *tokenBucket) allow() bool {
	if b == nil {
		return true
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(b.last).Seconds()
	b.last = now
	b.tokens += elapsed * b.rate
	if b.tokens > b.burst {
		b.tokens = b.burst
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
