// Package firstcityledgerpgdiscover is an isolated PG17 read-only head/command discoverer (not production).
package firstcityledgerpgdiscover

import (
	"context"
	"errors"
	"strings"

	firstcityledgerpgintake "github.com/anitaguptaoffice/sanguo-slg/internal/world/first_city_ledger_pg_intake"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const NotProductionRoute = true

var ErrUnauthorized = errors.New("firstcityledgerpgdiscover: OID §6.12 route unauthorized (obligations)")

type Outcome int

const (
	OutcomeUnauthorized Outcome = iota
	OutcomeUnknown
	OutcomeFirstCityEmpty
	OutcomePendingHead
)

type LocalPath struct {
	LeaseReleased bool
	Cleanup       bool
	Timeout       bool
}

type Head struct {
	Outcome   Outcome
	CommandID string
	Payload   firstcityledgerpgintake.Payload
	Durable   int16
}

type Discoverer struct {
	Evidence  firstcityledgerpgintake.ObligationEvidence
	LocalPath LocalPath
}

type rowQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (d *Discoverer) DiscoverSnapshot(ctx context.Context, pool *pgxpool.Pool, actor firstcityledgerpgintake.Actor) (Head, error) {
	if d == nil || !evidenceAuthorized(d.Evidence) {
		return Head{Outcome: OutcomeUnauthorized}, ErrUnauthorized
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return Head{Outcome: OutcomeUnknown}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := certifiedHistory(ctx, tx, actor); err != nil {
		return Head{Outcome: OutcomeUnknown}, err
	}
	var held bool
	if err := tx.QueryRow(ctx, `SELECT pg_try_advisory_xact_lock(hashtextextended(
 world_first_city_slot_key_text($1::uuid,$2,$3),0))`, actor.RealmID, actor.ServerID, actor.PlayerID).Scan(&held); err != nil {
		return Head{Outcome: OutcomeUnknown}, err
	}
	if !held {
		return Head{Outcome: OutcomeUnknown}, nil
	}
	return readHead(ctx, tx, actor, true, d.LocalPath)
}

func (d *Discoverer) DiscoverWithLockBoundary(ctx context.Context, tx pgx.Tx, actor firstcityledgerpgintake.Actor) (Head, error) {
	if d == nil || !evidenceAuthorized(d.Evidence) {
		return Head{Outcome: OutcomeUnauthorized}, ErrUnauthorized
	}
	if err := certifiedHistory(ctx, tx, actor); err != nil {
		return Head{Outcome: OutcomeUnknown}, err
	}
	if _, err := tx.Exec(ctx, `SELECT world_first_city_slot_advisory_lock($1::uuid,$2,$3)`, actor.RealmID, actor.ServerID, actor.PlayerID); err != nil {
		return Head{Outcome: OutcomeUnknown}, err
	}
	return readHead(ctx, tx, actor, true, d.LocalPath)
}

func evidenceAuthorized(e firstcityledgerpgintake.ObligationEvidence) bool {
	if !e.ProfileComplete || !e.ThroughCommitDrainOK {
		return false
	}
	for _, ok := range e.InventoryDrainEvidence {
		if !ok {
			return false
		}
	}
	return true
}

func certifiedHistory(ctx context.Context, q rowQuerier, actor firstcityledgerpgintake.Actor) error {
	if strings.TrimSpace(actor.RealmID) == "" || actor.ServerID <= 0 || actor.PlayerID <= 0 || actor.AccountID <= 0 {
		return ErrUnauthorized
	}
	var st int16
	if err := q.QueryRow(ctx, `SELECT status FROM account WHERE account_id=$1`, actor.AccountID).Scan(&st); err != nil || st != 1 {
		return ErrUnauthorized
	}
	var bound int64
	if err := q.QueryRow(ctx, `SELECT account_id FROM player WHERE server_id=$1 AND player_id=$2`, actor.ServerID, actor.PlayerID).Scan(&bound); err != nil || bound != actor.AccountID {
		return ErrUnauthorized
	}
	return nil
}

func readHead(ctx context.Context, q rowQuerier, actor firstcityledgerpgintake.Actor, forUpdate bool, local LocalPath) (Head, error) {
	var slotFound bool
	var head *string
	slotSQL := `SELECT head_command_id::text FROM world_first_city_actor_slot
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3`
	if forUpdate {
		slotSQL += ` FOR UPDATE`
	}
	err := q.QueryRow(ctx, slotSQL, actor.RealmID, actor.ServerID, actor.PlayerID).Scan(&head)
	if err == nil {
		slotFound = true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Head{Outcome: OutcomeUnknown}, err
	}
	var pendingCmds int
	_ = q.QueryRow(ctx, `SELECT count(*) FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND durable_state=1`,
		actor.RealmID, actor.ServerID, actor.PlayerID).Scan(&pendingCmds)
	if !slotFound {
		if pendingCmds > 0 {
			return Head{Outcome: OutcomeUnknown}, nil
		}
		return Head{Outcome: OutcomeFirstCityEmpty}, nil
	}
	if head == nil {
		if pendingCmds > 0 {
			return Head{Outcome: OutcomeUnknown}, nil
		}
		return Head{Outcome: OutcomeFirstCityEmpty}, nil
	}
	var cmdID string
	var p firstcityledgerpgintake.Payload
	var durable int16
	err = q.QueryRow(ctx, `SELECT command_id::text,durable_state,canonical_c1,template_version,rules_version,
 catalog_version,content_encoding_version,template_fct1,content_sha256
 FROM world_first_city_command
 WHERE realm_id=$1::uuid AND server_id=$2 AND player_id=$3 AND command_id=$4::uuid`,
		actor.RealmID, actor.ServerID, actor.PlayerID, *head).Scan(
		&cmdID, &durable, &p.CanonicalC1, &p.TemplateVersion, &p.RulesVersion, &p.CatalogVersion,
		&p.ContentEncodingVersion, &p.TemplateFCT1, &p.ContentSHA256)
	if err != nil {
		if pendingCmds > 0 {
			return Head{Outcome: OutcomeUnknown}, nil
		}
		return Head{Outcome: OutcomeUnknown}, err
	}
	if durable == 1 {
		_ = local
		return Head{Outcome: OutcomePendingHead, CommandID: cmdID, Payload: p, Durable: durable}, nil
	}
	return Head{Outcome: OutcomeUnknown}, nil
}
