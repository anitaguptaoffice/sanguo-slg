package domestic

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Opt-in two-process fixture: the harness cleanly restarts its own disposable PG
// between prepare and resume. Never point this test at a shared/live database.
func TestPGQueuePhysicalRestart(t *testing.T) {
	phase := os.Getenv("DOM_QUEUE_RESTART_PHASE")
	if phase == "" {
		t.Skip("two-phase disposable-PG restart harness required")
	}
	if phase != "prepare" && phase != "resume" {
		t.Fatal("invalid restart phase")
	}
	base := openDomesticTestDB(t)
	defer base.Close()
	if phase == "prepare" {
		productionSQL(t, base, "CREATE SCHEMA queue_restart")
	}
	cfg := base.Config()
	cfg.ConnConfig.RuntimeParams["search_path"] = "queue_restart"
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	now := time.Unix(1700000000, 0)
	if phase == "prepare" {
		applyDomesticSchema(t, pool)
		h, c := queueCity(t, pool, 1, 1, 42, &now)
		for i, slot := range []string{"lumber", "stone"} {
			result, err := h.StartBuildingUpgrade(c.ID, slot, int32(i+3))
			if err != nil || result.JobID != int64(i+1) {
				t.Fatal(result, err)
			}
		}
		t.Log("persisted active ID 1 and waiting ID 2; fixture awaits physical restart")
		return
	}
	h := NewHub(func() time.Time { return now })
	h.UseStore(NewPGStore(pool), 1, 0)
	c, err := h.LoadCity(context.Background(), 1, 42)
	if err != nil || len(c.BuildJobs) != 2 || c.BuildJobs[0].ID != 1 || c.BuildJobs[1].ID != 2 {
		t.Fatal(c, err)
	}
	now = now.Add(45 * time.Second)
	if h.Tick() != 1 || c.Buildings["lumber"].Level != 1 {
		t.Fatal("active ID did not resume")
	}
	now = now.Add(50 * time.Second)
	if h.Tick() != 1 || c.Buildings["stone"].Level != 1 {
		t.Fatal("waiting ID did not resume")
	}
	result, err := h.StartBuildingUpgrade(c.ID, "iron", 5)
	if err != nil || result.JobID != 3 {
		t.Fatal("sequence state lost across PG restart", result, err)
	}
	t.Log("physical restart resumed IDs 1/2 and allocated ID 3 without reuse")
}
