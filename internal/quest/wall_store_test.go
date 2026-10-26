package quest

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestWallProofShapes(t *testing.T) {
	now := time.Now()
	good := PlayerQuestRow{QuestCfgID: 1006, State: StateClaimable, AcceptedAt: &now, Progress: ProgressCounter{Count: 1, ServerVerifiedVersion: 2}}
	if err := validateProof(good); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*PlayerQuestRow){
		func(r *PlayerQuestRow) { r.QuestCfgID = 1005 }, func(r *PlayerQuestRow) { r.QuestCfgID = 1007 },
		func(r *PlayerQuestRow) { r.Progress.ServerVerifiedVersion = 1 }, func(r *PlayerQuestRow) { r.Progress.ServerVerifiedVersion = 3 },
		func(r *PlayerQuestRow) { r.Progress.Count = 99 }, func(r *PlayerQuestRow) { r.AcceptedAt = nil },
		func(r *PlayerQuestRow) { r.State = StateInProgress }, func(r *PlayerQuestRow) { r.State = 9 },
		func(r *PlayerQuestRow) { r.Progress.LegacyNoPayoutVerified = true },
	} {
		bad := good
		mutate(&bad)
		if !errors.Is(validateProof(bad), ErrProgressInvalid) {
			t.Fatalf("accepted %+v", bad)
		}
	}
	good.State, good.AcceptedAt, good.Progress.LegacyNoPayoutVerified = StateCompleted, nil, true
	if err := validateProof(good); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{`{"count":1,"server_verified_version":2,"legacy_no_payout_verified":false}`, `{"legacy_no_payout_verified":null}`, `{"legacy_no_payout_verified":1}`, `{"legacy_no_payout_verified":"true"}`, `{"unknown":true}`} {
		var p ProgressCounter
		if err := json.Unmarshal([]byte(raw), &p); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("accepted %s: %v", raw, err)
		}
	}
	for _, v := range []int32{0, 1} {
		good.Progress.ServerVerifiedVersion = v
		if !errors.Is(validateProof(good), ErrProgressInvalid) {
			t.Fatal("marker with old version")
		}
	}
}

func TestWallStoreTransitions(t *testing.T) {
	t.Run("mem", func(t *testing.T) { testWallStoreTransitions(t, NewMemStore()) })
	t.Run("pg", func(t *testing.T) {
		pool := openQuestTestDB(t)
		t.Cleanup(pool.Close)
		applyQuestSchema(t, pool)
		testWallStoreTransitions(t, NewPGStore(pool))
	})
}

func testWallStoreTransitions(t *testing.T, store Store) {
	ctx := context.Background()
	now := time.Now().UTC()
	actor := Actor{111, now.UnixNano()}
	put := func(r PlayerQuestRow) {
		t.Helper()
		if err := store.UpsertPlayerQuest(ctx, r); err != nil {
			t.Fatal(err)
		}
	}
	get := func() PlayerQuestRow {
		t.Helper()
		r, has, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006)
		if err != nil || !has {
			t.Fatalf("read %v %v", has, err)
		}
		return r
	}
	base := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateInProgress, AcceptedAt: &now, UpdatedAt: now}
	proof := base
	proof.State = StateClaimable
	proof.Progress = ProgressCounter{Count: 1, ServerVerifiedVersion: 2}
	if err := store.UpsertPlayerQuest(ctx, proof); !errors.Is(err, ErrNotInProgress) {
		t.Fatalf("missing eligibility %v", err)
	}
	if _, has, err := store.GetPlayerQuest(ctx, actor.ServerID, actor.PlayerID, 1006); err != nil || has {
		t.Fatalf("failed write created row %v %v", has, err)
	}
	verifier := store.(wallLegacyVerifier)
	if err := verifier.verifyLegacyWall(ctx, actor, now); !errors.Is(err, ErrNotInProgress) {
		t.Fatalf("missing legacy transition %v", err)
	}
	put(base)
	if err := verifier.verifyLegacyWall(ctx, actor, now); !errors.Is(err, ErrNotInProgress) {
		t.Fatalf("noncompleted legacy transition %v", err)
	}
	put(proof)
	put(base)
	if r := get(); r.Progress != proof.Progress || r.State != StateClaimable {
		t.Fatalf("lost proof %+v", r)
	}
	proof.State = StateCompleted
	proof.CompletedAt = &now
	proof.RewardClaimedAt = &now
	put(proof)
	put(base)
	if r := get(); r.State != StateCompleted || r.Progress != proof.Progress {
		t.Fatalf("lost completion %+v", r)
	}
	for _, accepted := range []*time.Time{nil, &now} {
		actor.PlayerID++
		tomb := PlayerQuestRow{ServerID: actor.ServerID, PlayerID: actor.PlayerID, QuestCfgID: 1006, State: StateCompleted, AcceptedAt: accepted, UpdatedAt: now, Progress: ProgressCounter{Count: 999}}
		put(tomb)
		tomb = get() // Compare stored timestamp precision/location, not the input clock.
		stale := base
		stale.PlayerID = actor.PlayerID
		put(stale)
		stale.State, stale.Progress = StateClaimable, proof.Progress
		put(stale)
		if r := get(); !reflect.DeepEqual(r, tomb) {
			t.Fatalf("tombstone changed %+v want %+v", r, tomb)
		}
		forged := legacyWallProposal(actor, now)
		if err := store.UpsertPlayerQuest(ctx, forged); !errors.Is(err, ErrProgressInvalid) {
			t.Fatalf("generic forged marker %v", err)
		}
		if err := verifier.verifyLegacyWall(ctx, actor, now); err != nil {
			t.Fatal(err)
		}
		verified := get()
		tomb.Progress = forged.Progress
		if !reflect.DeepEqual(verified, tomb) {
			t.Fatalf("legacy verification rewrote history %+v want %+v", verified, tomb)
		}
		put(stale)
		put(baseForActor(base, actor))
		if r := get(); !reflect.DeepEqual(r, verified) {
			t.Fatalf("stale erased no-payout %+v", r)
		}
	}
}
func baseForActor(r PlayerQuestRow, a Actor) PlayerQuestRow {
	r.ServerID, r.PlayerID = a.ServerID, a.PlayerID
	return r
}
