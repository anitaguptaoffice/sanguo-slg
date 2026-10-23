package account

import (
	"context"
	"testing"
)

func TestRegisterRejectsEmptyFields(t *testing.T) {
	svc := NewService(NewStore(nil))
	_, err := svc.Register(context.Background(), "", "secret")
	if err == nil {
		t.Fatal("expected error for empty login name")
	}
	_, err = svc.Register(context.Background(), "user", "")
	if err == nil {
		t.Fatal("expected error for empty password")
	}
}

func TestLoginErrMapping(t *testing.T) {
	cases := []struct {
		err  error
		code int32
	}{
		{ErrLoginFailed, int32(20001)},
		{ErrBanned, int32(20002)},
		{ErrServerNotFound, int32(20003)},
		{ErrServerUnavailable, int32(20004)},
		{ErrNoPlayer, int32(20005)},
	}
	for _, c := range cases {
		pkt := loginErr("tr", c.err)
		if pkt.Code != c.code {
			t.Fatalf("%v: got code %d", c.err, pkt.Code)
		}
	}
}
