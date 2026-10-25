package content

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type legacyReceiptStore struct{ Store }

func TestGrantReceiptUnsupported(t *testing.T) {
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	cached, legacy := NewService(cat), NewService(cat)
	if _, err := cached.Grant(PlayerRef{1, 1}, RewardPackage{}, "quest:1:1001:claim"); err != nil {
		t.Fatal(err)
	}
	// An embedded nil Store panics if a legacy grant method is incorrectly probed.
	legacy.UseStore(&legacyReceiptStore{})
	for _, svc := range []*Service{nil, NewService(cat), cached, legacy} {
		r, found, err := svc.FindGrantReceipt(context.Background(), PlayerRef{1, 1}, RewardPackage{}, "quest:1:1001:claim")
		if !errors.Is(err, ErrGrantReceiptUnsupported) || found || r.GrantID != 0 {
			t.Fatalf("unsupported: %+v %v %v", r, found, err)
		}
	}
}

func TestPGGrantReceiptReadOnly(t *testing.T) {
	pool := openContentTestDB(t)
	t.Cleanup(pool.Close)
	applyContentSchema(t, pool)
	ctx := context.Background()
	cat, err := EmbeddedCatalog()
	if err != nil {
		t.Fatal(err)
	}
	player := PlayerRef{ServerID: 1, PlayerID: time.Now().UnixNano()}
	key := fmt.Sprintf("quest:%d:1001:claim", player.PlayerID)
	pkg := RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{{ItemCfgID: 2001, Qty: 1}, {ItemCfgID: 2002, Qty: 2}}}
	writer := NewService(cat)
	writer.UseStore(NewPGStore(pool))
	granted, err := writer.Grant(player, pkg, key)
	if err != nil {
		t.Fatal(err)
	}
	// Runtime read-only transactions forbid all writes, including FOR UPDATE;
	// no role changes or permissions are needed. Use a fresh service, not caches.
	cfg := pool.Config().Copy()
	cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	readerPool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(readerPool.Close)
	reader := NewService(cat)
	reader.UseStore(NewPGStore(readerPool))
	check := func(t *testing.T, p PlayerRef, expected RewardPackage, k string, wantID int64, wantErr bool) {
		t.Helper()
		r, found, err := reader.FindGrantReceipt(ctx, p, expected, k)
		if (err != nil) != wantErr || found != (wantID > 0) || r.GrantID != wantID {
			t.Errorf("receipt=%+v found=%v err=%v; want id=%d error=%v", r, found, err, wantID, wantErr)
			return
		}
		if found && !reflect.DeepEqual(r.Rewards, expected) {
			t.Errorf("receipt package=%+v want=%+v", r.Rewards, expected)
		}
	}
	for _, tc := range []struct {
		name string
		p    PlayerRef
		key  string
		err  bool
	}{
		{"missing_key", player, key + ":other", false},
		{"wrong_server", PlayerRef{2, player.PlayerID}, key, false},
		{"wrong_owner", PlayerRef{1, player.PlayerID + 1}, key, true},
		{"empty_key", player, "", true},
		{"invalid_player", PlayerRef{1, 0}, key, true},
		{"invalid_server", PlayerRef{0, player.PlayerID}, key, true},
	} {
		t.Run(tc.name, func(t *testing.T) { check(t, tc.p, pkg, tc.key, 0, tc.err) })
	}
	insert := func(suffix, raw string, status int16) string {
		t.Helper()
		k := key + suffix
		_, err := pool.Exec(ctx, `INSERT INTO reward_grant_queue(server_id,grant_id,player_id,source_type,source_ref,rewards,status,idempotency_key)
			SELECT 1,COALESCE(MAX(grant_id),0)+1,$1,'quest','1001',$2,$3,$4 FROM reward_grant_queue WHERE server_id=1`, player.PlayerID, raw, status, k)
		if err != nil {
			t.Fatal(err)
		}
		return k
	}
	for _, status := range []int16{GrantStatusPending, GrantStatusProcessing, GrantStatusFailed, 99} {
		k := insert(fmt.Sprintf(":status:%d", status), `{"resources":{},"items":[]}`, status)
		check(t, player, RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{}}, k, 0, true)
	}
	for i, raw := range []string{
		`{"resources":"broken","items":[]}`, `{"resources":{},"items":[{"item_cfg_id":"bad","qty":1}]}`,
		`null`, `[]`, `{"resources":{},"items":[],"unexpected":true}`,
	} {
		k := insert(fmt.Sprintf(":malformed:%d", i), raw, GrantStatusSuccess)
		check(t, player, RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{}}, k, 0, true)
	}
	// Compare receipt results to actual Grant replay equality, rather than inventing
	// receipt-only normalization. Producer order, null/empty, zeros and aliases matter.
	for i, tc := range []struct {
		name           string
		stored, lookup RewardPackage
		match          bool
	}{
		{"nil", RewardPackage{}, RewardPackage{}, true},
		{"empty", RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{}}, RewardPackage{Resources: map[string]int64{}, Items: []RewardItem{}}, true},
		{"nil_empty_resources", RewardPackage{}, RewardPackage{Resources: map[string]int64{}}, false},
		{"nil_empty_items", RewardPackage{}, RewardPackage{Items: []RewardItem{}}, false},
		{"object_key_order", RewardPackage{Resources: map[string]int64{"food": 1, "wood": 2}}, RewardPackage{Resources: map[string]int64{"wood": 2, "food": 1}}, true},
		{"sorted_items", pkg, pkg, true},
		{"reordered_items", pkg, RewardPackage{Resources: pkg.Resources, Items: []RewardItem{pkg.Items[1], pkg.Items[0]}}, false},
		{"quantity", pkg, RewardPackage{Resources: pkg.Resources, Items: []RewardItem{{ItemCfgID: 2001, Qty: 2}, pkg.Items[1]}}, false},
		{"explicit_zero", RewardPackage{}, RewardPackage{Resources: map[string]int64{"food": 0}}, false},
		{"alias", RewardPackage{Resources: map[string]int64{"silver": 1}}, RewardPackage{Resources: map[string]int64{"gold": 1}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			k := fmt.Sprintf("%s:canonical:%d", key, i)
			first, err := writer.Grant(player, tc.stored, k)
			if err != nil {
				t.Fatal(err)
			}
			replay, err := writer.Grant(player, tc.lookup, k)
			if (err == nil) != tc.match || (tc.match && (!replay.Duplicate || replay.GrantID != first.GrantID)) {
				t.Fatalf("Grant replay=%+v err=%v match=%v", replay, err, tc.match)
			}
			id := int64(0)
			if tc.match {
				id = first.GrantID
			}
			check(t, player, tc.lookup, k, id, !tc.match)
		})
	}
	for _, bad := range []RewardPackage{{Resources: map[string]int64{"gems": 1}}, {Resources: map[string]int64{"food": -1}}, {Items: []RewardItem{{ItemCfgID: 2001, Qty: 0}}}} {
		check(t, player, bad, key, 0, true)
	}
	// All persistent rows, timestamps and tuple identities remain unchanged across
	// concurrent successful/missing/error reads; there is no player-cache hydration.
	snapshot := func() string {
		t.Helper()
		var raw string
		err := pool.QueryRow(ctx, `SELECT jsonb_build_array(
			(SELECT jsonb_agg(to_jsonb(w)||jsonb_build_object('tuple',ctid::text) ORDER BY player_id) FROM player_wallet w),
			(SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('tuple',ctid::text) ORDER BY player_id,item_cfg_id) FROM player_item i),
			(SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('tuple',ctid::text) ORDER BY grant_id) FROM reward_grant_queue g))::text`).Scan(&raw)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	before := snapshot()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			check(t, player, pkg, key, granted.GrantID, false)
			check(t, player, pkg, key+":absent", 0, false)
			check(t, PlayerRef{1, player.PlayerID + 1}, pkg, key, 0, true)
		}()
	}
	wg.Wait()
	if after := snapshot(); after != before {
		t.Fatal("receipt lookup changed durable state")
	}
	if len(reader.bags)+len(reader.wallets)+len(reader.idempotency)+len(reader.grantSeq) != 0 {
		t.Fatal("receipt lookup changed service caches")
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	r, found, err := reader.FindGrantReceipt(cancelled, player, pkg, key)
	if !errors.Is(err, context.Canceled) || found || r.GrantID != 0 {
		t.Fatalf("cancelled read: %+v %v %v", r, found, err)
	}
	readerPool.Close()
	check(t, player, pkg, key, 0, true)
}
