package hero

import "math/rand"

// randomIntn retains the existing Intn distribution. Standalone rule functions
// accept caller-owned sources; Service routes every shared source draw below.
type randomIntn interface{ Intn(int) int }

type serviceRandom struct{ service *Service }

func (s *Service) random() randomIntn { return serviceRandom{service: s} }

func (r serviceRandom) Intn(n int) int {
	s := r.service
	s.rngMu.Lock()
	defer s.rngMu.Unlock()
	if s.RNG == nil {
		s.RNG = rand.New(rand.NewSource(1))
	}
	// Only this draw holds the mutex, never a store/inventory operation.
	return s.RNG.Intn(n)
}
