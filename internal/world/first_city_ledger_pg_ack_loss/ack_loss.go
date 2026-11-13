package firstcityledgerpgackloss

import (
	"context"
	"errors"
	"fmt"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

const (
	DefaultCityID      int64 = 88001
	DefaultMapX        int32 = 10
	DefaultMapY        int32 = 20
	cityMapAdvisoryKey       = int64(1128879193)
)

var ErrUnauthorized = errors.New("firstcityledgerpgackloss: route unauthorized (obligations)")

// Placement is disposable test fixture coordinates; not production enrollment.
type Placement struct {
	CityID int64
	MapX   int32
	MapY   int32
}

// Controller gates ack-loss matrix writers; default path is fail-closed without evidence.
type Controller struct {
	Evidence  firstcityledgerpgintake.ObligationEvidence
	RealmID   string
	ServerID  int32
	PlayerID  int64
	Placement Placement
}

func (c *Controller) authorized() bool {
	if c == nil || c.RealmID == "" || c.ServerID <= 0 || c.PlayerID <= 0 {
		return false
	}
	ev := c.Evidence
	if !ev.ProfileComplete || !ev.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range ev.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func (c *Controller) place() Placement {
	if c.Placement.CityID == 0 {
		return Placement{CityID: DefaultCityID, MapX: DefaultMapX, MapY: DefaultMapY}
	}
	return c.Placement
}

// InstallDisposableFixture creates mil_city_origin in the test schema only.
func InstallDisposableFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return ErrUnauthorized
	}
	_, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS mil_city_origin (
 server_id int NOT NULL CHECK (server_id>0), city_id bigint NOT NULL CHECK (city_id>0),
 owner_player_id bigint NOT NULL CHECK (owner_player_id>0), cohort_id bytea NOT NULL CHECK (octet_length(cohort_id)=16),
 format_version smallint NOT NULL CHECK (format_version=1), created_at timestamptz NOT NULL,
 PRIMARY KEY (server_id,city_id))`)
	return err
}

func (c *Controller) prepSlot(ctx context.Context, tx pgx.Tx, acct int64) (*string, error) {
	if !c.authorized() {
		return nil, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`, c.RealmID, c.ServerID, c.PlayerID, acct); err != nil {
		return nil, err
	}
	var head *string
	err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head)
	return head, err
}

func fixturePayload() (c1, fct1, sha string) {
	return `\x01`, `\x` + repeatHex("00", 52), `\x` + repeatHex("ab", 32)
}

func repeatHex(s string, n int) string {
	out := make([]byte, n*len(s))
	for i := 0; i < n; i++ {
		copy(out[i*len(s):], s)
	}
	return string(out)
}

// CommitIntakeInitial persists PENDING + head CAS (caller commits tx).
func (c *Controller) CommitIntakeInitial(ctx context.Context, tx pgx.Tx, acct int64, cmdID string) (bool, error) {
	head, err := c.prepSlot(ctx, tx, acct)
	if err != nil {
		return false, err
	}
	if head != nil {
		return false, nil
	}
	c1, fct1, sha := fixturePayload()
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1, fct1, sha)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	tag, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

// RollbackIntakeBeforeCommit exercises pre-commit disconnect (caller rolls back tx).
func (c *Controller) RollbackIntakeBeforeCommit(ctx context.Context, tx pgx.Tx, acct int64, cmdID string) error {
	if !c.authorized() {
		return ErrUnauthorized
	}
	if _, err := c.prepSlot(ctx, tx, acct); err != nil {
		return err
	}
	c1, fct1, sha := fixturePayload()
	_, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1, fct1, sha)
	return err
}

func (c *Controller) effectBusiness(ctx context.Context, tx pgx.Tx, pl Placement) error {
	q := []string{
		fmt.Sprintf(`INSERT INTO player_wallet (server_id,player_id,food,wood,iron,stone,gold) VALUES (%d,%d,1000,1000,1000,1000,100) ON CONFLICT DO NOTHING`, c.ServerID, c.PlayerID),
		fmt.Sprintf(`SELECT pg_advisory_xact_lock(%d,1)`, cityMapAdvisoryKey),
		fmt.Sprintf(`SELECT 1 FROM map_cell WHERE server_id=%d AND x=%d AND y=%d FOR UPDATE`, c.ServerID, pl.MapX, pl.MapY),
		fmt.Sprintf(`INSERT INTO player_city (server_id,city_id,player_id,name,x,y,is_capital,wall_level,morale) VALUES (%d,%d,%d,'ack-city',%d,%d,true,1,100)`,
			c.ServerID, pl.CityID, c.PlayerID, pl.MapX, pl.MapY),
		fmt.Sprintf(`INSERT INTO mil_city_origin (server_id,city_id,owner_player_id,cohort_id,format_version,created_at) VALUES (%d,%d,%d,decode(repeat('01',16),'hex'),1,now())`,
			c.ServerID, pl.CityID, c.PlayerID),
		fmt.Sprintf(`INSERT INTO city_troop (server_id,city_id,unit_cfg_id,count) VALUES (%d,%d,1,0)`, c.ServerID, pl.CityID),
		fmt.Sprintf(`INSERT INTO city_production_checkpoint (server_id,city_id,player_id,settled_at) VALUES (%d,%d,%d,now())`, c.ServerID, pl.CityID, c.PlayerID),
		fmt.Sprintf(`INSERT INTO city_building (server_id,city_id,slot_key,building_cfg_id,level) VALUES (%d,%d,'town_hall',1,1)`, c.ServerID, pl.CityID),
	}
	for _, sql := range q {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}

// CommitEffect applies business bundle + durable_state=2 terminal (caller commits tx).
func (c *Controller) CommitEffect(ctx context.Context, tx pgx.Tx, cmdID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	pl := c.place()
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return false, err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`, c.RealmID, c.ServerID, c.PlayerID).Scan(&head); err != nil || head == nil || *head != cmdID {
		return false, err
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdID).Scan(&st); err != nil || st != 1 {
		return false, err
	}
	if err := c.effectBusiness(ctx, tx, pl); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=2,terminal_at=now(),
 success_city_id=$2,success_server_id=$3,success_player_id=$4,success_is_capital=true,success_wall_level=1,success_morale=100
 WHERE command_id=$1::uuid AND durable_state=1`, cmdID, pl.CityID, c.ServerID, c.PlayerID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

// CommitFinalizerReject sets durable_state=3 + rejection_reason=1 (caller commits tx).
func (c *Controller) CommitFinalizerReject(ctx context.Context, tx pgx.Tx, cmdID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, c.RealmID, c.ServerID, c.PlayerID); err != nil {
		return false, err
	}
	var st int16
	if err := tx.QueryRow(ctx, `SELECT durable_state FROM world_first_city_command WHERE command_id=$1::uuid FOR UPDATE`, cmdID).Scan(&st); err != nil || st != 1 {
		return false, err
	}
	tag, err := tx.Exec(ctx, `UPDATE world_first_city_command SET durable_state=3,terminal_at=now(),rejection_reason=1 WHERE command_id=$1::uuid AND durable_state=1`, cmdID)
	if err != nil || tag.RowsAffected() != 1 {
		return false, err
	}
	return true, nil
}

// TryDuplicateIntakeInsert attempts a second command row with same PK (observes 23505).
func (c *Controller) TryDuplicateIntakeInsert(ctx context.Context, tx pgx.Tx, acct int64, cmdID string) (bool, error) {
	if !c.authorized() {
		return false, ErrUnauthorized
	}
	c1, fct1, sha := fixturePayload()
	_, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (realm_id,server_id,player_id,command_id,account_id,canonical_c1,
 durable_state,template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,'t','r','c',1,$7,$8,now())`,
		c.RealmID, c.ServerID, c.PlayerID, cmdID, acct, c1, fct1, sha)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

type CommandSnapshot struct {
	DurableState int16
	ContentSHA   string
}

func (c *Controller) ReadCommand(ctx context.Context, pool *pgxpool.Pool, cmdID string) (CommandSnapshot, error) {
	var s CommandSnapshot
	if pool == nil {
		return s, ErrUnauthorized
	}
	err := pool.QueryRow(ctx, `SELECT durable_state,encode(content_sha256,'hex') FROM world_first_city_command WHERE command_id=$1::uuid`, cmdID).
		Scan(&s.DurableState, &s.ContentSHA)
	return s, err
}

// BusinessRowSum counts wallet/city/MIL/DOM fixture rows for player (harness alignment).
func (c *Controller) BusinessRowSum(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	if pool == nil {
		return 0, ErrUnauthorized
	}
	pl := c.place()
	var n int
	err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM player_wallet WHERE server_id=$1 AND player_id=$2)+
 (SELECT count(*) FROM player_city WHERE server_id=$1)+(SELECT count(*) FROM city_troop WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM mil_city_origin WHERE server_id=$1 AND city_id=$3)+(SELECT count(*) FROM city_production_checkpoint WHERE server_id=$1 AND city_id=$3)+
 (SELECT count(*) FROM city_building WHERE server_id=$1 AND city_id=$3)`, c.ServerID, c.PlayerID, pl.CityID).Scan(&n)
	return n, err
}
