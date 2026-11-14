package firstcityledgerpgintake

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// NotProductionRoute marks this writer as isolated-test-only for logs and audits.
const NotProductionRoute = true

var (
	ErrUnauthorized = errors.New("firstcityledgerpgintake: OID §6.12 route unauthorized (obligations)")
	ErrHeadConflict = errors.New("firstcityledgerpgintake: head/predecessor conflict")
)

// Payload is immutable C1 + template fields for PENDING intake (durable_state=1).
type Payload struct {
	CanonicalC1            []byte
	TemplateVersion        string
	RulesVersion           string
	CatalogVersion         string
	ContentEncodingVersion int16
	TemplateFCT1           []byte
	ContentSHA256          []byte
}

// Actor scopes one stable first-city slot namespace.
type Actor struct {
	RealmID   string
	ServerID  int32
	PlayerID  int64
	AccountID int64
}

// Writer performs companion §3 intake (PENDING + head CAS) inside the caller's tx.
type Writer struct {
	Evidence ObligationEvidence
}

// ApplyPendingIntake inserts PENDING command and CAS-advances head when authorized.
// Rolls back leave no durable mutation; never touches player_city or sequences.
func (w *Writer) ApplyPendingIntake(ctx context.Context, tx pgx.Tx, actor Actor, commandID string, pred *string, p Payload) error {
	if w == nil {
		return ErrUnauthorized
	}
	if !w.Evidence.authorized() {
		return ErrUnauthorized
	}
	if tx == nil || strings.TrimSpace(commandID) == "" || strings.TrimSpace(actor.RealmID) == "" || actor.ServerID <= 0 || actor.PlayerID <= 0 {
		return ErrUnauthorized
	}
	_, err := tx.Exec(ctx, `LOCK TABLE account, player IN ROW SHARE MODE`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE`)
	if err != nil {
		return err
	}
	var acctStatus int16
	err = tx.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1 FOR SHARE`, actor.AccountID).Scan(&acctStatus)
	if err != nil || acctStatus != 1 {
		return ErrUnauthorized
	}
	var bound int64
	err = tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR SHARE`, actor.ServerID, actor.PlayerID).Scan(&bound)
	if err != nil || bound != actor.AccountID {
		return ErrUnauthorized
	}
	_, err = tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, actor.RealmID, actor.ServerID, actor.PlayerID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
 VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		actor.RealmID, actor.ServerID, actor.PlayerID, actor.AccountID)
	if err != nil {
		return err
	}
	var head *string
	err = tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		actor.RealmID, actor.ServerID, actor.PlayerID).Scan(&head)
	if err != nil {
		return err
	}
	if pred == nil {
		if head != nil {
			return ErrHeadConflict
		}
	} else if head == nil || *head != *pred {
		return ErrHeadConflict
	}
	_, err = tx.Exec(ctx, `INSERT INTO world_first_city_command (
 realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
 template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,$13)`,
		actor.RealmID, actor.ServerID, actor.PlayerID, commandID, actor.AccountID,
		p.CanonicalC1, p.TemplateVersion, p.RulesVersion, p.CatalogVersion,
		p.ContentEncodingVersion, p.TemplateFCT1, p.ContentSHA256, time.Now().UTC())
	if err != nil {
		return err
	}
	var tag pgconn.CommandTag
	if pred == nil {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			actor.RealmID, actor.ServerID, actor.PlayerID, commandID)
	} else {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id=$5::uuid`,
			actor.RealmID, actor.ServerID, actor.PlayerID, commandID, *pred)
	}
	if err != nil || tag.RowsAffected() != 1 {
		return fmt.Errorf("%w: cas head", ErrHeadConflict)
	}
	return nil
}
