package hero

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

var (
	ErrMarchOrphanSource = errors.New("hero: march orphan source unavailable")
	ErrMarchOrphanLinked = errors.New("hero: march orphan still linked to a live or unresolved army")
)

type marchOrphanStore interface {
	releaseMarchOrphan(context.Context, string, PlayerRef, int64) error
}

// ReleaseMarchOrphan rechecks a candidate from startup restore. The caller
// owns exclusive startup access to the reviewed schema, before a new march
// can claim a hero or write its army. Concurrent recovery calls are safe.
func (s *Service) ReleaseMarchOrphan(ctx context.Context, schema string, actor PlayerRef, heroID int64) error {
	store, ok := s.Store.(marchOrphanStore)
	if !ok || schema == "" {
		return ErrMarchOrphanSource
	}
	if actor.ServerID <= 0 || actor.PlayerID <= 0 || heroID <= 0 {
		return ErrHeroNotFound
	}
	err := store.releaseMarchOrphan(ctx, schema, actor, heroID)
	if err == nil || ctx.Err() != nil || errors.Is(err, ErrHeroNotFound) || errors.Is(err, ErrMarchOrphanLinked) {
		return err
	}
	return store.releaseMarchOrphan(ctx, schema, actor, heroID)
}

func (p *PGStore) releaseMarchOrphan(ctx context.Context, schema string, actor PlayerRef, heroID int64) error {
	table := func(name string) string { return pgx.Identifier{schema, name}.Sanitize() }
	heroes, armies, orders := table("player_hero"), table("field_army"), table("march_order")
	return pgx.BeginTxFunc(ctx, p.Pool, pgx.TxOptions{IsoLevel: pgx.ReadCommitted}, func(tx pgx.Tx) error {
		var status int16
		read := "SELECT status FROM " + heroes + " WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 FOR UPDATE"
		err := tx.QueryRow(ctx, read, actor.ServerID, actor.PlayerID, heroID).Scan(&status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrHeroNotFound
		}
		if err != nil || status != StatusMarch {
			return err
		}
		// A mismatched owner, unrecognized order state, or unresolved field
		// army must not make a potentially live hero eligible for release.
		update := fmt.Sprintf(`UPDATE %s SET status=$4
			WHERE server_id=$1 AND player_id=$2 AND hero_id=$3 AND status=$5
			AND NOT EXISTS (
			  SELECT FROM %s a WHERE a.server_id=$1 AND $3=ANY(a.hero_ids)
			  AND (a.status<>1 OR EXISTS (
			    SELECT FROM %s o WHERE o.server_id=a.server_id AND o.army_id=a.army_id AND o.status<>4
			  ))
			)`, heroes, armies, orders)
		tag, err := tx.Exec(ctx, update, actor.ServerID, actor.PlayerID, heroID, StatusIdle, StatusMarch)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrMarchOrphanLinked
		}
		return nil
	})
}
