package domestic

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestRecruitDebitInvalidHandlesAndCosts(t *testing.T) {
	ctx, access := context.Background(), &recruittx.Access{}
	for _, w := range []*RecruitWallet{nil, {}} {
		if h, err := w.Lock(ctx, access, 1); h != nil || err == nil {
			t.Fatal("invalid wallet")
		}
	}
	for _, h := range []*LockedRecruitWallet{nil, {}} {
		if h.Debit(ctx, access, Resources{}) == nil {
			t.Fatal("invalid handle")
		}
	}
	if !validRecruitResources(Resources{}) || validRecruitResources(Resources{Food: -1}) || validRecruitResources(Resources{Wood: -1}) || validRecruitResources(Resources{Iron: -1}) || validRecruitResources(Resources{Stone: -1}) {
		t.Fatal("resource validation")
	}
}
