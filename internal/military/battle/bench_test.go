package battle

import (
	"testing"
	"time"
)

func TestSimulateLatencyP99(t *testing.T) {
	inputs := BaselineInputs()
	const runs = 50
	durations := make([]time.Duration, 0, len(inputs)*runs)
	for _, in := range inputs {
		for r := 0; r < runs; r++ {
			start := time.Now()
			_ = Simulate(in)
			durations = append(durations, time.Since(start))
		}
	}
	p99 := percentileDuration(durations, 0.99)
	if p99 > 50*time.Millisecond {
		t.Fatalf("P99 %v exceeds 50ms", p99)
	}
}

func BenchmarkSimulateBaseline(b *testing.B) {
	inputs := BaselineInputs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Simulate(inputs[i%len(inputs)])
	}
}

func percentileDuration(d []time.Duration, p float64) time.Duration {
	if len(d) == 0 {
		return 0
	}
	cp := append([]time.Duration(nil), d...)
	for i := 1; i < len(cp); i++ {
		for j := i; j > 0 && cp[j-1] > cp[j]; j-- {
			cp[j-1], cp[j] = cp[j], cp[j-1]
		}
	}
	idx := int(float64(len(cp)-1) * p)
	if idx < 0 {
		idx = 0
	}
	if idx >= len(cp) {
		idx = len(cp) - 1
	}
	return cp[idx]
}
