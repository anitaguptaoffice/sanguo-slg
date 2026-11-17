package api

import (
	"bytes"
	"crypto/sha256"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/domestic"
)

// TestFirstCityTemplateRefFCT1 pins starter bytes used at intake to FCT1 SHA on the template ref.
func TestFirstCityTemplateRefFCT1(t *testing.T) {
	ref := FirstCityTemplateRef("DATA-002")
	sum := sha256.Sum256(firstCityTemplateContent())
	if !bytes.Equal(ref.GetContentSha256(), sum[:]) {
		t.Fatalf("content sha mismatch")
	}
}

// TestFirstCityStarterMatchesDomesticWallet documents DOM starter parity until PreparedCity wires in.
func TestFirstCityStarterMatchesDomesticWallet(t *testing.T) {
	state := firstCityInitialState(42)
	want := domestic.Resources{Food: 8000, Wood: 8000, Stone: 5000, Iron: 5000}
	if state.Wallet != want {
		t.Fatalf("wallet = %+v", state.Wallet)
	}
	if len(state.Buildings) != len(firstCityStarterBuildings) {
		t.Fatalf("buildings = %d", len(state.Buildings))
	}
	for _, b := range firstCityStarterBuildings {
		got := state.Buildings[b.slot]
		if got == nil || got.CfgID != b.cfgID || got.Level != b.level {
			t.Fatalf("slot %s = %+v", b.slot, got)
		}
	}
}