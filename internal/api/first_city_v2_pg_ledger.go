package api

import (
	"context"
	"errors"
	"time"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type pgFirstCityLedger struct {
	pool *pgxpool.Pool
}

// NewPGFirstCityLedger persists first-city intake and receipts in world_first_city_* tables.
func NewPGFirstCityLedger(pool *pgxpool.Pool) *pgFirstCityLedger {
	if pool == nil {
		return nil
	}
	return &pgFirstCityLedger{pool: pool}
}

func (l *pgFirstCityLedger) Head(scope *worldv1.FirstCityScope) (*worldv1.FirstCityHead, error) {
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return nil, errors.New("scope")
	}
	ctx := context.Background()
	var headID *string
	err := l.pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`,
		key.realm, key.shard, key.player).Scan(&headID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}}, nil
		}
		return nil, err
	}
	if headID == nil || *headID == "" {
		return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}}, nil
	}
	rec, ok, err := l.Record(scope, *headID)
	if err != nil || !ok {
		return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}}, err
	}
	return &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Command{Command: rec}}, nil
}

func (l *pgFirstCityLedger) Record(scope *worldv1.FirstCityScope, commandID string) (*worldv1.FirstCityRecord, bool, error) {
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return nil, false, errors.New("scope")
	}
	ctx := context.Background()
	rec, err := l.loadCommand(ctx, key, commandID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return rec, true, nil
}

func (l *pgFirstCityLedger) IntakePending(ctx context.Context, scope *worldv1.FirstCityScope, record *worldv1.FirstCityRecord) error {
	if record == nil || record.GetCanonical() == nil || record.GetTemplate() == nil {
		return errors.New("record")
	}
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return errors.New("scope")
	}
	c1, err := firstCityC1FromProto(record.GetCanonical())
	if err != nil {
		return err
	}
	tpl := record.GetTemplate()
	fct1 := firstCityTemplateContent()
	cmdID := record.GetCanonical().GetProposal().GetCommandId()
	if err := headAcceptsProposalIntake(ctx, l.pool, key, record); err != nil {
		return err
	}
	tx, err := l.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var acctStatus int
	if err := tx.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1 FOR SHARE`, key.account).Scan(&acctStatus); err != nil {
		return err
	}
	if acctStatus != 1 {
		return errors.New("account")
	}
	var bound int64
	if err := tx.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2 FOR SHARE`,
		key.shard, key.player).Scan(&bound); err != nil {
		return err
	}
	if bound != key.account {
		return errors.New("account binding")
	}

	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, key.realm, key.shard, key.player); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO world_first_city_actor_slot (realm_id,server_id,player_id,account_id,head_command_id)
VALUES ($1::uuid,$2,$3,$4,NULL) ON CONFLICT (realm_id,server_id,player_id) DO NOTHING`,
		key.realm, key.shard, key.player, key.account); err != nil {
		return err
	}
	var head *string
	if err := tx.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 FOR UPDATE`,
		key.realm, key.shard, key.player).Scan(&head); err != nil {
		return err
	}
	if err := intakeCAS(head, record.GetCanonical().GetProposal()); err != nil {
		return err
	}
	if existing, dup, err := l.existingCommandC1(ctx, tx, key, cmdID); err != nil {
		return err
	} else if dup {
		if bytesEqualC1(existing, c1) {
			return tx.Commit(ctx)
		}
		return errFirstCityHeadConflict
	}
	tag, err := tx.Exec(ctx, `INSERT INTO world_first_city_command (
realm_id,server_id,player_id,command_id,account_id,canonical_c1,durable_state,
template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,received_at)
VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,1,$7,$8,$9,$10,$11,$12,now())`,
		key.realm, key.shard, key.player, cmdID, key.account, c1,
		tpl.GetTemplateVersion(), tpl.GetRulesVersion(), tpl.GetCatalogVersion(),
		tpl.GetContentEncodingVersion(), fct1, tpl.GetContentSha256())
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return errFirstCityHeadConflict
		}
		return err
	}
	if tag.RowsAffected() != 1 {
		return errors.New("intake insert")
	}
	var pred *string
	if record.GetCanonical().GetProposal().GetPredecessor().GetRejectedCommandId() != "" {
		v := record.GetCanonical().GetProposal().GetPredecessor().GetRejectedCommandId()
		pred = &v
	}
	var upd pgconn.CommandTag
	if pred == nil {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND head_command_id IS NULL`,
			key.realm, key.shard, key.player, cmdID)
	} else {
		upd, err = tx.Exec(ctx, `UPDATE world_first_city_actor_slot SET head_command_id=$4::uuid
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3
AND (head_command_id IS NULL OR head_command_id=$5::uuid)`,
			key.realm, key.shard, key.player, cmdID, *pred)
	}
	if err != nil || upd.RowsAffected() != 1 {
		return errFirstCityHeadConflict
	}
	return tx.Commit(ctx)
}

func (l *pgFirstCityLedger) Settle(ctx context.Context, scope *worldv1.FirstCityScope, commandID string, next *worldv1.FirstCityRecord) error {
	if l == nil || l.pool == nil {
		return errors.New("ledger")
	}
	tx, err := l.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := l.settleOnTx(ctx, tx, scope, commandID, next); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// settleOnTx folds one terminal receipt into world_first_city_command inside an existing transaction.
func (l *pgFirstCityLedger) settleOnTx(ctx context.Context, tx pgx.Tx, scope *worldv1.FirstCityScope, commandID string, next *worldv1.FirstCityRecord) error {
	if l == nil || tx == nil {
		return errors.New("ledger")
	}
	key, ok := slotKeyFromScope(scope)
	if !ok {
		return errors.New("scope")
	}
	if commandID == "" || next == nil || next.GetCanonical() == nil {
		return errors.New("record")
	}
	if next.GetSucceeded() == nil && next.GetRejectedNoEffect() == nil {
		return errors.New("terminal")
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, key.realm, key.shard, key.player); err != nil {
		return err
	}
	var stored []byte
	var state int16
	if err := tx.QueryRow(ctx, `SELECT canonical_c1,durable_state FROM world_first_city_command
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid FOR UPDATE`,
		key.realm, key.shard, key.player, commandID).Scan(&stored, &state); err != nil {
		return errFirstCityHeadConflict
	}
	if state != 1 {
		return errFirstCityHeadConflict
	}
	nextC1, err := firstCityC1FromProto(next.GetCanonical())
	if err != nil || !bytesEqualC1(stored, nextC1) {
		return errFirstCityHeadConflict
	}
	var tag pgconn.CommandTag
	if success := next.GetSucceeded(); success != nil {
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command
SET durable_state=2, terminal_at=now(), success_city_id=$5, success_server_id=$2,
    success_player_id=$3, success_is_capital=true, success_wall_level=1, success_morale=100
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
			key.realm, key.shard, key.player, commandID, success.GetCityId())
	} else {
		reason := int16(1)
		if next.GetRejectedNoEffect().GetReason() == worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED {
			reason = 2
		}
		tag, err = tx.Exec(ctx, `UPDATE world_first_city_command
SET durable_state=3, terminal_at=now(), rejection_reason=$5
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid AND durable_state=1`,
			key.realm, key.shard, key.player, commandID, reason)
	}
	if err != nil || tag.RowsAffected() != 1 {
		return errFirstCityHeadConflict
	}
	return nil
}

func bytesEqualC1(a, b []byte) bool { return len(a) == len(b) && string(a) == string(b) }

func intakeCAS(head *string, proposal *worldv1.FirstCityProposal) error {
	if proposal == nil || proposal.GetPredecessor() == nil {
		return errors.New("proposal")
	}
	if proposal.GetPredecessor().GetEmpty() != nil {
		if head != nil {
			return errFirstCityHeadConflict
		}
		return nil
	}
	rej := proposal.GetPredecessor().GetRejectedCommandId()
	if rej == "" {
		return errors.New("predecessor")
	}
	if head == nil || *head != rej {
		return errFirstCityHeadConflict
	}
	return nil
}

func headAcceptsProposalIntake(ctx context.Context, pool *pgxpool.Pool, key firstCitySlotKey, record *worldv1.FirstCityRecord) error {
	var headID *string
	err := pool.QueryRow(ctx, `SELECT head_command_id::text FROM world_first_city_actor_slot
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`,
		key.realm, key.shard, key.player).Scan(&headID)
	if errors.Is(err, pgx.ErrNoRows) {
		return intakeCAS(nil, record.GetCanonical().GetProposal())
	}
	if err != nil {
		return err
	}
	if headID == nil {
		return intakeCAS(nil, record.GetCanonical().GetProposal())
	}
	rec, ok, err := (&pgFirstCityLedger{pool: pool}).Record(scopeFromKey(key), *headID)
	if err != nil {
		return err
	}
	if !ok {
		return intakeCAS(nil, record.GetCanonical().GetProposal())
	}
	return headAcceptsProposal(rec, record.GetCanonical().GetProposal())
}

func scopeFromKey(key firstCitySlotKey) *worldv1.FirstCityScope {
	return &worldv1.FirstCityScope{
		RealmId: key.realm, ServerId: key.shard, PlayerId: key.player, AccountId: key.account,
	}
}

func (l *pgFirstCityLedger) existingCommandC1(ctx context.Context, tx pgx.Tx, key firstCitySlotKey, cmdID string) ([]byte, bool, error) {
	var c1 []byte
	err := tx.QueryRow(ctx, `SELECT canonical_c1 FROM world_first_city_command
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		key.realm, key.shard, key.player, cmdID).Scan(&c1)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	return c1, true, err
}

func (l *pgFirstCityLedger) loadCommand(ctx context.Context, key firstCitySlotKey, commandID string) (*worldv1.FirstCityRecord, error) {
	var (
		c1, fct1, sha      []byte
		tplVer, rules, cat string
		enc                int32
		state              int16
		term               *time.Time
		cityID             *int64
		srv                *int32
		ply                *int64
		capital            *bool
		wall, morale       *int32
		reject             *int16
	)
	err := l.pool.QueryRow(ctx, `SELECT canonical_c1,durable_state,
template_version,rules_version,catalog_version,content_encoding_version,template_fct1,content_sha256,
terminal_at,success_city_id,success_server_id,success_player_id,success_is_capital,success_wall_level,success_morale,rejection_reason
FROM world_first_city_command
WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		key.realm, key.shard, key.player, commandID).Scan(
		&c1, &state, &tplVer, &rules, &cat, &enc, &fct1, &sha, &term,
		&cityID, &srv, &ply, &capital, &wall, &morale, &reject)
	if err != nil {
		return nil, err
	}
	decScope, proposal, err := firstCityScopeAndProposalFromC1(c1)
	if err != nil {
		return nil, err
	}
	canon, err := firstCityCanonicalMessage(decScope, proposal)
	if err != nil {
		return nil, err
	}
	tpl := &worldv1.FirstCityTemplateRef{
		TemplateVersion: tplVer, RulesVersion: rules, CatalogVersion: cat,
		ContentEncodingVersion: uint32(enc), ContentSha256: sha,
	}
	rec := &worldv1.FirstCityRecord{Canonical: canon, Template: tpl}
	switch state {
	case 1:
		rec.State = &worldv1.FirstCityRecord_Pending{Pending: &worldv1.FirstCityEmpty{}}
	case 2:
		if cityID == nil || srv == nil || ply == nil {
			return nil, errors.New("receipt")
		}
		rec.State = &worldv1.FirstCityRecord_Succeeded{Succeeded: &worldv1.FirstCitySuccess{
			CityId: *cityID, ServerId: *srv, PlayerId: *ply,
			IsCapital: capital, WallLevel: wall, Morale: morale,
		}}
	case 3:
		reason := worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_TERRAIN
		if reject != nil && *reject == 2 {
			reason = worldv1.FirstCityRejectionReason_FIRST_CITY_REJECTION_COORDINATE_OCCUPIED
		}
		rec.State = &worldv1.FirstCityRecord_RejectedNoEffect{RejectedNoEffect: &worldv1.FirstCityRejection{Reason: reason}}
	default:
		return nil, errors.New("durable_state")
	}
	_ = term
	_ = fct1
	return rec, nil
}
