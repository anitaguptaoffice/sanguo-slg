package api

import (
	"net"
	"testing"
	"time"
)

func TestReturnBackendOwnershipFailClosed(t *testing.T) {
	owner, sentinel := net.Pipe()
	defer func() {
		if err := owner.Close(); err != nil {
			t.Errorf("close owned test pipe: %v", err)
		}
	}()
	defer func() {
		if err := sentinel.Close(); err != nil {
			t.Errorf("close sentinel test pipe: %v", err)
		}
	}()
	for _, b := range []*returnOwnedBackend{nil, {}, {transport: owner}, {pid: 1, transport: owner}, {pid: 1, started: "missing transport"}} {
		if b.close() == nil {
			t.Fatal("missing ownership accepted")
		}
	}
	returnPGOK(t, sentinel.SetReadDeadline(time.Now().Add(10*time.Millisecond)))
	_, err := sentinel.Read(make([]byte, 1))
	if timeout, ok := err.(net.Error); !ok || !timeout.Timeout() {
		t.Fatal("invalid ownership closed transport", err)
	}
}
