package mail

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists player_mail in PostgreSQL.
type PGStore struct{ Pool *pgxpool.Pool }

// NewPGStore wraps a pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{Pool: pool} }

func (p *PGStore) NextMailID(ctx context.Context, serverID int32) (int64, error) {
	var id int64
	err := p.Pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(mail_id), 0) + 1 FROM player_mail WHERE server_id = $1`, serverID).Scan(&id)
	return id, err
}

func (p *PGStore) Insert(ctx context.Context, m Mail) error {
	raw, err := json.Marshal(m.Attachments)
	if err != nil {
		return err
	}
	_, err = p.Pool.Exec(ctx, `
		INSERT INTO player_mail (
			server_id, mail_id, player_id, mail_type, title, body, attachments,
			status, expire_at, created_at, read_at, claimed_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
		m.ServerID, m.MailID, m.PlayerID, m.MailType, m.Title, m.Body, raw,
		m.Status, m.ExpireAt, m.CreatedAt, m.ReadAt, m.ClaimedAt,
	)
	return err
}

func (p *PGStore) Get(ctx context.Context, serverID int32, mailID int64) (Mail, bool, error) {
	row, err := scanMail(p.Pool.QueryRow(ctx, `
		SELECT server_id, mail_id, player_id, mail_type, title, body, attachments,
		       status, expire_at, created_at, read_at, claimed_at
		FROM player_mail WHERE server_id = $1 AND mail_id = $2`, serverID, mailID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Mail{}, false, nil
	}
	if err != nil {
		return Mail{}, false, err
	}
	return row, true, nil
}

func (p *PGStore) ListInbox(ctx context.Context, serverID int32, playerID int64, q ListQuery) (ListResult, error) {
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	filterSQL := "TRUE"
	switch q.Filter {
	case FilterUnread:
		filterSQL = "status = 0"
	case FilterRead:
		filterSQL = "status IN (1, 2)"
	}
	var total int
	if err := p.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM player_mail
		WHERE server_id = $1 AND player_id = $2 AND status <> 3 AND `+filterSQL,
		serverID, playerID).Scan(&total); err != nil {
		return ListResult{}, err
	}
	rows, err := p.Pool.Query(ctx, `
		SELECT server_id, mail_id, player_id, mail_type, title, body, attachments,
		       status, expire_at, created_at, read_at, claimed_at
		FROM player_mail
		WHERE server_id = $1 AND player_id = $2 AND status <> 3 AND `+filterSQL+`
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`, serverID, playerID, limit, q.Offset)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()
	var mails []Mail
	for rows.Next() {
		row, err := scanMailRows(rows)
		if err != nil {
			return ListResult{}, err
		}
		mails = append(mails, row)
	}
	return ListResult{Mails: mails, Total: total}, rows.Err()
}

func (p *PGStore) MarkRead(ctx context.Context, serverID int32, playerID int64, mailID int64) (Mail, error) {
	row, err := scanMail(p.Pool.QueryRow(ctx, `
		UPDATE player_mail
		SET status = 1, read_at = COALESCE(read_at, now())
		WHERE server_id = $1 AND mail_id = $2 AND player_id = $3 AND status = 0
		RETURNING server_id, mail_id, player_id, mail_type, title, body, attachments,
		          status, expire_at, created_at, read_at, claimed_at`,
		serverID, mailID, playerID))
	if errors.Is(err, pgx.ErrNoRows) {
		existing, ok, gerr := p.Get(ctx, serverID, mailID)
		if gerr != nil {
			return Mail{}, gerr
		}
		if !ok {
			return Mail{}, ErrNotFound
		}
		if existing.PlayerID != playerID {
			return Mail{}, ErrForbidden
		}
		if existing.Status == StatusDeleted {
			return Mail{}, ErrAlreadyDeleted
		}
		return existing, nil
	}
	if err != nil {
		return Mail{}, err
	}
	return row, nil
}

func (p *PGStore) MarkClaimed(ctx context.Context, serverID int32, playerID int64, mailID int64) (Mail, error) {
	row, err := scanMail(p.Pool.QueryRow(ctx, `
		UPDATE player_mail
		SET status = 2,
		    read_at = COALESCE(read_at, now()),
		    claimed_at = COALESCE(claimed_at, now())
		WHERE server_id = $1 AND mail_id = $2 AND player_id = $3 AND status <> 3
		RETURNING server_id, mail_id, player_id, mail_type, title, body, attachments,
		          status, expire_at, created_at, read_at, claimed_at`,
		serverID, mailID, playerID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Mail{}, ErrNotFound
	}
	if err != nil {
		return Mail{}, err
	}
	if row.PlayerID != playerID {
		return Mail{}, ErrForbidden
	}
	return row, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanMailRows(rows scannable) (Mail, error) {
	return scanMail(rows)
}

func scanMail(row scannable) (Mail, error) {
	var m Mail
	var attachRaw []byte
	var expire, readAt, claimedAt *time.Time
	if err := row.Scan(
		&m.ServerID, &m.MailID, &m.PlayerID, &m.MailType, &m.Title, &m.Body, &attachRaw,
		&m.Status, &expire, &m.CreatedAt, &readAt, &claimedAt,
	); err != nil {
		return Mail{}, err
	}
	m.ExpireAt = expire
	m.ReadAt = readAt
	m.ClaimedAt = claimedAt
	pkg, err := content.ParseRewardJSON(attachRaw)
	if err != nil {
		return Mail{}, err
	}
	m.Attachments = pkg
	return m, nil
}
