package march

import (
	"context"
	"github.com/anitaguptaoffice/sanguo-slg/internal/world"
	"testing"
	"time"
)

func TestInitializedCityInvalid(t *testing.T) {
	for _, proof := range []InitializedCity{{}, {s: &initializedCityState{}}, {s: &initializedCityState{identity: world.CityIdentity{ServerID: 1, CityID: 1, PlayerID: 1}}}} {
		if id, err := proof.Consume(context.Background(), nil); err == nil || id != (world.CityIdentity{}) {
			t.Fatal("invalid proof")
		}
	}
	for _, p := range []*FreshCityParticipant{nil, {}, {state: &freshMilitarySource{}}} {
		if proof, err := p.Initialize(context.Background(), nil, world.FreshCity{}, time.Now()); err == nil || proof.s != nil {
			t.Fatal("invalid initializer")
		}
	}
}
