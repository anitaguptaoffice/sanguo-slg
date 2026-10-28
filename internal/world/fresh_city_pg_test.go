package world

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func insertFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, *FreshCityParticipant, context.Context) {
	t.Helper()
	pool, b, p := freshFixture(t, false)
	body, err := os.ReadFile("../../spec/db/003_domestic.sql")
	insertOK(t, err)
	creationSQL(t, pool, string(body))
	creationSQL(t, pool, "INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,7,8000)")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	o, a := sequenceOwner(t, b, ctx)
	s, err := NewFreshCityParticipant(ctx, b, a, p)
	insertOK(t, err)
	insertOK(t, o.Rollback(ctx))
	return pool, b, s, ctx
}

// Only controlled fixture prerequisites, NOT production ACCOUNT/DOM/APP wiring.
func prepareInsert(ctx context.Context, a *recruittx.Access, s *FreshCityParticipant, player int64) error {
	q := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	if _, err := a.Exec(ctx, s.binding, "LOCK TABLE "+q("account")+","+q("player")+" IN ROW SHARE MODE"); err != nil {
		return err
	}
	if _, err := a.Exec(ctx, s.binding, "LOCK TABLE "+q("player_wallet")+" IN ROW EXCLUSIVE MODE"); err != nil {
		return err
	}
	if err := s.Pin(ctx, a); err != nil {
		return err
	}
	var status int
	var owner, food int64
	if err := a.Scan(ctx, s.binding, "SELECT status FROM "+q("account")+" WHERE account_id=$1 FOR SHARE", []any{player - 6}, &status); err != nil {
		return err
	}
	if err := a.Scan(ctx, s.binding, "SELECT account_id FROM "+q("player")+" WHERE server_id=1 AND player_id=$1 FOR SHARE", []any{player}, &owner); err != nil {
		return err
	}
	if status != 1 || owner != player-6 {
		return ErrInvalidCity
	}
	return a.Scan(ctx, s.binding, "SELECT food FROM "+q("player_wallet")+" WHERE server_id=1 AND player_id=$1 AND food=8000 FOR UPDATE", []any{player}, &food)
}

func TestPGFreshCityProofAliases(t *testing.T) {
	pool, b, s, ctx := insertFixture(t)
	o, a := sequenceOwner(t, b, ctx)
	insertOK(t, prepareInsert(ctx, a, s, 7))
	request := creationRequest(t, 1, 0)
	proof, err := s.Insert(ctx, a, request)
	if err != nil || proof.s == nil {
		t.Fatal("insert", err)
	}
	for _, id := range []CityIdentity{{0, 1, 7}, {1, 0, 7}, {1, 1, 0}} {
		bad := FreshCity{s: &freshCityState{access: *a, binding: b, identity: id}}
		if got, e := bad.Consume(ctx, a); e == nil || got != (CityIdentity{}) {
			t.Fatal("zero identity accepted")
		}
	}
	_, foreign := sequenceOwner(t, b, ctx)
	originalAccess := *a
	*a = *foreign
	if _, err = proof.Consume(ctx, a); err == nil {
		t.Fatal("handle overwrite rebound proof")
	}
	*a = originalAccess
	results := make(chan CityIdentity, 16)
	var group sync.WaitGroup
	for i := 0; i < 16; i++ {
		group.Add(1)
		go func(p FreshCity) {
			defer group.Done()
			id, e := p.Consume(ctx, o.Access())
			if e == nil {
				results <- id
			} else if id != (CityIdentity{}) {
				t.Error("identity on error")
			}
		}(proof)
	}
	group.Wait()
	close(results)
	wins := 0
	for id := range results {
		wins++
		if id != (CityIdentity{1, 1, 7}) {
			t.Fatal("wrong sealed identity", id)
		}
	}
	if wins != 1 {
		t.Fatal("copy replay", wins)
	}
	insertOK(t, o.Commit(ctx))
	creationCount(t, pool, 1)
}

func TestPGFreshCityRollbackAndReadback(t *testing.T) {
	pool, b, s, ctx := insertFixture(t)
	request := creationRequest(t, 1, 0)
	for attempt := int64(1); attempt <= 4; attempt++ {
		o, a := sequenceOwner(t, b, ctx)
		insertOK(t, prepareInsert(ctx, a, s, 7))
		c := request
		if attempt == 2 {
			c.Name = "city" + strings.Repeat(" ", 32)
		} // varchar tail-space normalization must not mint proof
		proof, err := s.Insert(ctx, a, c)
		if attempt == 2 {
			if !errors.Is(err, ErrFreshCityProof) || proof.s != nil {
				t.Fatal("readback mismatch", err)
			}
		} else {
			insertOK(t, err)
			if proof.s.identity.CityID != attempt {
				t.Fatal("reused sequence")
			}
			if attempt >= 3 {
				call, stop := context.WithCancel(ctx)
				probe := &claimContext{Context: call, state: proof.s, action: stop}
				if attempt == 4 {
					probe.action = func() {
						if e := o.Rollback(ctx); e != nil {
							t.Error(e)
						}
					}
				}
				id, e := proof.Consume(probe, a)
				stop()
				if e == nil || id != (CityIdentity{}) || !proof.s.consumed.Load() {
					t.Fatal("claim/end boundary", id, e)
				}
			}
		}
		if attempt != 4 {
			insertOK(t, o.Rollback(ctx))
		}
		if _, err = proof.Consume(ctx, a); err == nil {
			t.Fatal("rolled-back proof active")
		}
		creationCount(t, pool, 0)
	}
}

func TestPGFreshCityRejectsBeforeCreation(t *testing.T) {
	pool, b, s, ctx := insertFixture(t)
	request := creationRequest(t, 1, 0)
	o, a := sequenceOwner(t, b, ctx)
	if p, err := s.Insert(ctx, a, request); err == nil || p.s != nil {
		t.Fatal("missing pins")
	}
	request.ServerID = 2
	if p, err := s.Insert(ctx, a, request); !errors.Is(err, ErrInvalidCity) || p.s != nil {
		t.Fatal("cross-shard intent", err)
	}
	insertOK(t, o.Rollback(ctx))
	request.ServerID = 1
	wrong, _ := recruittx.NewBinding(pool)
	_, foreign := sequenceOwner(t, wrong, ctx)
	if p, err := s.Insert(ctx, foreign, request); err == nil || p.s != nil {
		t.Fatal("foreign binding")
	}
	creationCount(t, pool, 0)
}

func TestPGFreshCityConcurrentCoordinate(t *testing.T) {
	pool, b, s, ctx := insertFixture(t)
	creationSQL(t, pool, `WITH a AS (INSERT INTO account(login_name,password_hash) VALUES('other','unused') RETURNING account_id) INSERT INTO player(server_id,player_id,account_id,display_name) SELECT 1,8,account_id,'other' FROM a; INSERT INTO player_wallet(server_id,player_id,food) VALUES(1,8,8000)`)
	request := creationRequest(t, 1, 0)
	otherRequest := request
	otherRequest.PlayerID = 8
	second, z := sequenceOwner(t, b, ctx)
	first, a := sequenceOwner(t, b, ctx)
	insertOK(t, prepareInsert(ctx, a, s, 7))
	if _, err := s.Insert(ctx, a, request); err != nil {
		t.Fatal(err)
	}
	var pid int
	insertOK(t, z.Scan(ctx, b, "SELECT pg_catalog.pg_backend_pid()", nil, &pid))
	result := make(chan error, 1)
	go func() {
		if err := prepareInsert(ctx, z, s, 8); err != nil {
			result <- err
			return
		}
		p, err := s.Insert(ctx, z, otherRequest)
		if p.s != nil {
			result <- ErrFreshCityProof
			return
		}
		result <- err
	}()
	for {
		var blocked bool
		insertOK(t, pool.QueryRow(ctx, "SELECT EXISTS(SELECT FROM pg_catalog.pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted)", pid).Scan(&blocked))
		if blocked {
			break
		}
		select {
		case err := <-result:
			t.Fatal("second did not serialize", err)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(time.Millisecond):
		}
	}
	insertOK(t, first.Commit(ctx))
	if err := <-result; !errors.Is(err, ErrOccupied) {
		t.Fatal("coordinate conflict", err)
	}
	insertOK(t, second.Rollback(ctx))
	creationCount(t, pool, 1)
}

// Test-only context injects cancellation/end precisely after the shared claim.
type claimContext struct {
	context.Context
	state  *freshCityState
	once   sync.Once
	action func()
}

func (c *claimContext) Done() <-chan struct{} {
	if c.state.consumed.Load() {
		c.once.Do(c.action)
	}
	return c.Context.Done()
}

func insertOK(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
