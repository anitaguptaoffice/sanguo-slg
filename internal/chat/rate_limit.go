package chat

import (
	"sync"
	"time"
)

type rateKey struct {
	serverID    int32
	playerID    int64
	channelType int16
	channelID   int64
}

type rateState struct {
	lastSent   time.Time
	timestamps []time.Time
}

// rateLimiter tracks per-player per-channel send quotas.
type rateLimiter struct {
	mu     sync.Mutex
	limits Limits
	byKey  map[rateKey]*rateState
}

func newRateLimiter(limits Limits) *rateLimiter {
	return &rateLimiter{limits: limits, byKey: make(map[rateKey]*rateState)}
}

type rateDecision struct {
	Allowed          bool
	RemainingInWindow int32
	NextAllowedAtMS  int64
}

func (r *rateLimiter) check(key rateKey, now time.Time) rateDecision {
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.byKey[key]
	if !ok {
		st = &rateState{}
		r.byKey[key] = st
	}
	window := time.Duration(r.limits.WindowMS) * time.Millisecond
	cutoff := now.Add(-window)
	filtered := make([]time.Time, 0, len(st.timestamps))
	for _, t := range st.timestamps {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	st.timestamps = filtered

	remaining := r.limits.MaxMessagesPerWindow - int32(len(st.timestamps))
	if remaining < 0 {
		remaining = 0
	}

	var nextMS int64
	if !st.lastSent.IsZero() {
		interval := time.Duration(r.limits.MinIntervalMS) * time.Millisecond
		next := st.lastSent.Add(interval)
		if next.After(now) {
			nextMS = next.UnixMilli()
		}
	}
	if nextMS > 0 {
		return rateDecision{Allowed: false, RemainingInWindow: remaining, NextAllowedAtMS: nextMS}
	}
	if int32(len(st.timestamps)) >= r.limits.MaxMessagesPerWindow {
		oldest := st.timestamps[0]
		until := oldest.Add(window)
		if until.After(now) {
			return rateDecision{Allowed: false, RemainingInWindow: 0, NextAllowedAtMS: until.UnixMilli()}
		}
	}
	return rateDecision{Allowed: true, RemainingInWindow: remaining, NextAllowedAtMS: 0}
}

func (r *rateLimiter) record(key rateKey, now time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.byKey[key]
	if st == nil {
		st = &rateState{}
		r.byKey[key] = st
	}
	st.lastSent = now
	st.timestamps = append(st.timestamps, now)
}
