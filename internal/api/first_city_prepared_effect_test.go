package api

import (
	"context"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

func TestFirstCityCreationEffectSelectsPreparedWhenWired(t *testing.T) {
	s := NewServer(nil, nil, nil, nil, nil)
	if _, ok := s.FirstCityCreationEffect().(firstCityPreparedCreationEffect); ok {
		t.Fatal("expected legacy effect without wiring")
	}
	s.WireFirstCityPreparedCreation(&FirstCityPreparedCreationSource{})
	if _, ok := s.FirstCityCreationEffect().(firstCityPreparedCreationEffect); !ok {
		t.Fatal("expected prepared effect when wired")
	}
}

func TestFirstCityPreparedEffectUnavailableWithoutParticipants(t *testing.T) {
	s := NewServer(nil, nil, nil, nil, nil)
	s.WireFirstCityPreparedCreation(&FirstCityPreparedCreationSource{})
	eff := s.FirstCityCreationEffect()
	scope := &worldv1.FirstCityScope{ServerId: 1, PlayerId: 1, AccountId: 1}
	name, x, y := "城", int32(1), int32(2)
	prop := &worldv1.FirstCityProposal{Name: &name, X: &x, Y: &y, CommandId: "11111111-1111-4111-8111-111111111111"}
	_, _, err := eff.Create(context.Background(), scope, prop)
	if err == nil {
		t.Fatal("expected unavailable without binding/participants")
	}
}
