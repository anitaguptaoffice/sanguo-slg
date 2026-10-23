package api

import "testing"

func TestSessionRegistryPlayerLookup(t *testing.T) {
	r := NewSessionRegistry()
	r.Bind("a", PlayerContext{ServerID: 1, PlayerID: 10})
	r.Bind("b", PlayerContext{ServerID: 1, PlayerID: 10})
	r.Bind("c", PlayerContext{ServerID: 2, PlayerID: 10})

	if !r.IsPlayerOnline(1, 10) {
		t.Fatal("expected online")
	}
	ids := r.SessionIDsForPlayer(1, 10)
	if len(ids) != 2 {
		t.Fatalf("sessions: %v", ids)
	}
	r.Remove("a")
	if len(r.SessionIDsForPlayer(1, 10)) != 1 {
		t.Fatal("remove should drop one session")
	}
}
