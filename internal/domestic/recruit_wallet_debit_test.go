package domestic

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"testing"
)

func TestRecruitDebitInvalidHandlesAndCosts(t *testing.T) {
	for _, w := range []*RecruitWallet{nil, {}} {
		if h, err := w.Lock(context.Background(), &recruittx.Access{}, 1); h != nil || err == nil {
			t.Fatal("invalid wallet")
		}
	}
	for _, h := range []*LockedRecruitWallet{nil, {}} {
		if h.Debit(context.Background(), &recruittx.Access{}, Resources{}) == nil {
			t.Fatal("invalid handle")
		}
	}
	for _, r := range []Resources{{Food: -1}, {Wood: -1}, {Iron: -1}, {Stone: -1}} {
		if validRecruitResources(r) {
			t.Fatal(r)
		}
	}
	if !validRecruitResources(Resources{}) {
		t.Fatal("zero")
	}
}
