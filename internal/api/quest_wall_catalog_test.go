package api

import (
	"context"
	"testing"
)

func TestWallCatalogPGWiringDoesNotHideMalformedConfiguration(t *testing.T) {
	for _, kind := range []string{"unknown-objective-field", "wrong-objective-type", "wrong-reward-type", "query-error"} {
		t.Run(kind, func(t *testing.T) {
			_, pool, _ := wallLevelFixture(t)
			switch kind {
			case "unknown-objective-field":
				tutorialSQL(t, pool, `UPDATE cfg_quest SET objectives='[{"type":"build_level","building_cfg_id":7,"level":1,"future_rule":true}]' WHERE quest_cfg_id=1006`)
			case "wrong-objective-type":
				tutorialSQL(t, pool, `UPDATE cfg_quest SET objectives='[{"type":"build_level","building_cfg_id":7,"level":"1"}]' WHERE quest_cfg_id=1006`)
			case "wrong-reward-type":
				tutorialSQL(t, pool, `UPDATE cfg_quest SET rewards='[]' WHERE quest_cfg_id=1006`)
			case "query-error":
				tutorialSQL(t, pool, `ALTER TABLE cfg_quest RENAME TO unavailable_quest_catalog`)
			}
			fresh := NewServer(nil, pool, nil, nil, nil)
			if err := fresh.WireM4Content(context.Background()); err == nil {
				t.Fatalf("%s silently replaced with dev catalog", kind)
			}
			if fresh.questSvc != nil {
				t.Fatal("failed wire installed quest service")
			}
		})
	}
}

func TestWallCatalogExplicitEmptyAndMemoryDevelopmentFallback(t *testing.T) {
	_, pool, _ := wallLevelFixture(t)
	tutorialSQL(t, pool, `TRUNCATE cfg_quest`)
	for _, s := range []*Server{NewServer(nil, pool, nil, nil, nil), NewServer(nil, nil, nil, nil, nil)} {
		if err := s.WireM4Content(context.Background()); err != nil || s.questSvc == nil || len(s.questChainIDs) == 0 {
			t.Fatalf("supported empty development catalog %v", err)
		}
	}
}
