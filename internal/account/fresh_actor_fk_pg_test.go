package account

import (
	"context"
	"testing"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/freshsource"
	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5/pgxpool"
)

func actorFKFixture(t *testing.T) (*pgxpool.Pool, *recruittx.Binding, freshsource.Profile) {
	t.Helper()
	pool, b, p := freshActorFixture(t)
	var pk freshsource.ObjectIdentity
	actorOK(t, pool.QueryRow(context.Background(), `SELECT oid,relowner FROM pg_catalog.pg_class WHERE relnamespace=$1 AND relname='account_pkey'`, p.SchemaOID).Scan(&pk.OID, &pk.OwnerOID))
	p.Objects["account_pkey"] = pk
	return pool, b, p
}

func TestPGFreshActorFKIdentity(t *testing.T) {
	pool, b, p := actorFKFixture(t)
	o, a, ctx := actorOwner(t, b)
	actorOK(t, validateFreshActorFK(ctx, a, b, p))
	for _, change := range []func(*freshsource.Profile){
		func(p *freshsource.Profile) { delete(p.Objects, "account_pkey") },
		func(p *freshsource.Profile) { v := p.Objects["account_pkey"]; v.OID++; p.Objects["account_pkey"] = v },
		func(p *freshsource.Profile) {
			v := p.Objects["account_pkey"]
			v.OwnerOID++
			p.Objects["account_pkey"] = v
		},
	} {
		bad, _ := freshsource.Snapshot(p)
		change(&bad)
		if validateFreshActorFK(ctx, a, b, bad) == nil {
			t.Fatal("wrong primary identity accepted")
		}
	}
	wrong, _ := recruittx.NewBinding(pool)
	if validateFreshActorFK(ctx, a, wrong, p) == nil {
		t.Fatal("wrong binding")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if validateFreshActorFK(canceled, a, b, p) == nil {
		t.Fatal("canceled access")
	}
	actorOK(t, o.Rollback(ctx))
	if validateFreshActorFK(ctx, a, b, p) == nil {
		t.Fatal("ended access")
	}
}

func TestPGFreshActorFKDrift(t *testing.T) {
	cases := map[string]string{
		"missing player FK":             "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey",
		"missing session FK":            "ALTER TABLE account_session DROP CONSTRAINT account_session_account_id_fkey",
		"cascade delete":                "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id) ON DELETE CASCADE",
		"cascade update":                "ALTER TABLE account_session DROP CONSTRAINT account_session_account_id_fkey; ALTER TABLE account_session ADD FOREIGN KEY(account_id) REFERENCES account(account_id) ON UPDATE CASCADE",
		"restrict instead of no action": "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id) ON DELETE RESTRICT",
		"deferrable":                    "ALTER TABLE player ALTER CONSTRAINT player_account_id_fkey DEFERRABLE",
		"initial deferred":              "ALTER TABLE account_session ALTER CONSTRAINT account_session_account_id_fkey DEFERRABLE INITIALLY DEFERRED",
		"unvalidated":                   "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id) NOT VALID",
		"match full":                    "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id) MATCH FULL",
		"wrong target":                  "CREATE TABLE other_account(id bigint PRIMARY KEY); ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES other_account(id)",
		"wrong column":                  "ALTER TABLE player DROP CONSTRAINT player_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(player_id) REFERENCES account(account_id)",
		"extra inbound":                 "CREATE TABLE extra_ref(id bigint REFERENCES account(account_id))",
		"extra outbound":                "CREATE TABLE other_account(id bigint PRIMARY KEY); ALTER TABLE player ADD FOREIGN KEY(player_id) REFERENCES other_account(id)",
		"one relation replacing both":   "ALTER TABLE account_session DROP CONSTRAINT account_session_account_id_fkey; ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id)",
		"extra duplicate FK":            "ALTER TABLE player ADD FOREIGN KEY(account_id) REFERENCES account(account_id)",
		"user trigger":                  "CREATE FUNCTION actor_extra() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$; CREATE TRIGGER extra BEFORE INSERT ON player FOR EACH ROW EXECUTE FUNCTION actor_extra()",
	}
	for name, ddl := range cases {
		t.Run(name, func(t *testing.T) {
			pool, b, p := actorFKFixture(t)
			o, a, ctx := actorOwner(t, b)
			actorOK(t, validateFreshActorFK(ctx, a, b, p))
			actorOK(t, o.Rollback(ctx))
			actorSQL(t, pool, ddl)
			_, a, ctx = actorOwner(t, b)
			if validateFreshActorFK(ctx, a, b, p) == nil {
				t.Fatal("FK/RI drift accepted")
			}
		})
	}
}

func TestPGFreshActorFKNamesNotAuthority(t *testing.T) {
	pool, b, p := actorFKFixture(t)
	actorSQL(t, pool, "ALTER TABLE player RENAME CONSTRAINT player_account_id_fkey TO renamed_player_fk; ALTER TABLE account_session RENAME CONSTRAINT account_session_account_id_fkey TO renamed_session_fk")
	_, a, ctx := actorOwner(t, b)
	actorOK(t, validateFreshActorFK(ctx, a, b, p)) // semantics, not generated names
}
