package world

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
)

func TestFreshCityZeroProof(t *testing.T) {
	for _, proof := range []FreshCity{{}, {s: &freshCityState{}}, {s: &freshCityState{identity: CityIdentity{1, 1, 7}}}} {
		for _, ctx := range []context.Context{nil, context.Background()} {
			for _, access := range []*recruittx.Access{nil, {}} {
				if id, err := proof.Consume(ctx, access); err == nil || id != (CityIdentity{}) {
					t.Fatal("malformed proof accepted")
				}
			}
		}
	}
	if proof, err := (*FreshCityParticipant)(nil).Insert(context.Background(), nil, City{}); err == nil || proof.s != nil {
		t.Fatal("zero issuer")
	}
}
