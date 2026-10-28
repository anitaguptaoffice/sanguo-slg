package domestic

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitWalletInvalidInputs(t *testing.T) {
	p := freshsource.Profile{}
	if w, err := NewRecruitWallet(context.Background(), nil, nil, p); w != nil || err == nil {
		t.Fatal("invalid constructor")
	}
	var w *RecruitWallet
	if err := w.Pin(context.Background(), nil); err == nil {
		t.Fatal("nil wallet")
	}
	w = &RecruitWallet{}
	if err := w.Pin(context.Background(), &recruittx.Access{}); err == nil {
		t.Fatal("zero wallet")
	}
}
