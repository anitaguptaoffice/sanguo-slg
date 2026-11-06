package api

import (
	"net"
	"testing"
	"time"
)

func TestReturnBackendOwnershipFailClosed(t *testing.T) {
	owner, sentinel := net.Pipe()
	defer owner.Close()
	defer sentinel.Close()
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
