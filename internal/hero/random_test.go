package hero

import (
	"math/rand"
	"sync"
	"testing"
)

func TestServiceRandomConcurrentPreservesDraws(t *testing.T) {
	s := NewService()
	const count, size = 128, 37
	got := make(chan int, count)
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); got <- s.random().Intn(size) }()
	}
	wg.Wait()
	close(got)
	var actual, expected [size]int
	for v := range got {
		actual[v]++
	}
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < count; i++ {
		expected[rng.Intn(size)]++
	}
	if actual != expected {
		t.Fatalf("draws changed: %v != %v", actual, expected)
	}
}
