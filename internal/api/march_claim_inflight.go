package api

type marchStartKey struct {
	serverID int32
	playerID int64
	heroID   int64
}

// These short index operations never hold a mutex while calling another domain.
// The marker belongs to one handler, including its claim rejection cleanup.
func (s *Server) beginMarchStart(pc PlayerContext, heroID int64) bool {
	s.marchIndexMu.Lock()
	defer s.marchIndexMu.Unlock()
	key := marchStartKey{pc.ServerID, pc.PlayerID, heroID}
	if _, exists := s.marchStarting[key]; exists {
		return false
	}
	if s.marchStarting == nil {
		s.marchStarting = make(map[marchStartKey]struct{})
	}
	s.marchStarting[key] = struct{}{}
	return true
}

func (s *Server) endMarchStart(pc PlayerContext, heroID int64) {
	s.marchIndexMu.Lock()
	defer s.marchIndexMu.Unlock()
	delete(s.marchStarting, marchStartKey{pc.ServerID, pc.PlayerID, heroID})
}
