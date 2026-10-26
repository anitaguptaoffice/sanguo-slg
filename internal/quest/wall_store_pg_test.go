package quest

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Wait for a real backend lock wait, not a scheduler-dependent sleep. The
// writer uses its own pool/application_name so no unrelated process is observed.
func waitWallWriterBlocked(t *testing.T, pool *pgxpool.Pool, app string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	tick := time.NewTicker(5 * time.Millisecond)
	defer tick.Stop()
	for {
		var blocked bool
		err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock')`, app).Scan(&blocked)
		if err != nil {
			t.Fatal(err)
		}
		if blocked {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("writer never reached PostgreSQL row lock")
		case <-tick.C:
		}
	}
}

func TestPGWallLockedCurrentRowRaces(t *testing.T) {
	pool := openQuestTestDB(t)
	t.Cleanup(pool.Close)
	applyQuestSchema(t, pool)
	ctx := context.Background()
	for _, mode := range []string{"receipt_beats_normal", "receipt_beats_stale_accept", "new_claim_beats_normal", "legacy_marker_beats_stale_accept"} {
		t.Run(mode, func(t *testing.T) {
			actor := Actor{112, time.Now().UnixNano()}
			now := time.Now().Truncate(time.Microsecond)
			st := NewPGStore(pool)
			base := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
			missing := mode == "receipt_beats_stale_accept" || mode == "legacy_marker_beats_stale_accept"
			if !missing {
				if err := st.UpsertPlayerQuest(ctx, base); err != nil {
					t.Fatal(err)
				}
			}
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer func(rollback func(context.Context) error, ctx context.Context) {
				_ = rollback(ctx)
			}(tx.Rollback, ctx)
			completed := base
			completed.State = StateCompleted
			completed.CompletedAt, completed.RewardClaimedAt = &now, &now
			if missing {
				completed.AcceptedAt = nil
			}
			if mode == "new_claim_beats_normal" {
				completed.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 2}
			}
			if mode == "legacy_marker_beats_stale_accept" {
				completed.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 2, LegacyNoPayoutVerified: true}
				completed.CompletedAt, completed.RewardClaimedAt = nil, nil
			}
			if err := upsertPlayerQuest(ctx, tx, completed); err != nil {
				t.Fatal(err)
			} // Hold inserted/updated row uncommitted.
			app := fmt.Sprintf("wall-race-%d", actor.PlayerID)
			cfg := pool.Config()
			cfg.ConnConfig.RuntimeParams["application_name"] = app
			writerPool, err := pgxpool.NewWithConfig(ctx, cfg)
			if err != nil {
				t.Fatal(err)
			}
			defer writerPool.Close()
			stale := base
			if !missing {
				stale.State = StateClaimable
				stale.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 2}
			}
			done := make(chan error, 1)
			go func() { done <- NewPGStore(writerPool).UpsertPlayerQuest(ctx, stale) }()
			waitWallWriterBlocked(t, pool, app)
			if err := tx.Commit(ctx); err != nil {
				t.Fatal(err)
			}
			if err := <-done; err != nil {
				t.Fatal(err)
			}
			got, has, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
			if err != nil || !has || got.State != StateCompleted || got.Progress != completed.Progress || (got.AcceptedAt == nil) != (completed.AcceptedAt == nil) || (got.RewardClaimedAt == nil) != (completed.RewardClaimedAt == nil) {
				t.Fatalf("locked merge %+v err=%v", got, err)
			}
		})
	}
}

func TestPGWallRejectMalformedRowsAndGenericMarker(t *testing.T) {
	pool := openQuestTestDB(t)
	t.Cleanup(pool.Close)
	applyQuestSchema(t, pool)
	ctx := context.Background()
	st := NewPGStore(pool)
	for i, raw := range []string{`null`, `{"count":1,"server_verified_version":3}`, `{"count":1,"server_verified_version":1}`, `{"count":9,"server_verified_version":2}`, `{"count":1,"server_verified_version":2,"legacy_no_payout_verified":false}`, `{"count":1,"server_verified_version":2,"legacy_no_payout_verified":null}`, `{"count":1,"server_verified_version":2,"extra":1}`, `{"count":1,"server_verified_version":2}`} {
		actor := Actor{113, time.Now().UnixNano() + int64(i)}
		_, err := pool.Exec(ctx, `INSERT INTO player_quest(server_id,player_id,quest_cfg_id,state,progress) VALUES($1,$2,1006,3,$3)`, actor.ServerID, actor.PlayerID, raw)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := st.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("read %s: %v", raw, err)
		}
		if _, err := st.ListPlayerQuests(ctx, actor.ServerID, actor.PlayerID); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("list %s: %v", raw, err)
		}
		if err := st.UpsertPlayerQuest(ctx, PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateCompleted, UpdatedAt: time.Now()}); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("overwrite %s: %v", raw, err)
		}
	}
}
