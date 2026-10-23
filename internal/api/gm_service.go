package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GmService implements GM-001 operations (lookup, grant, mute stub, kick).
type GmService struct {
	log       *slog.Logger
	pool      *pgxpool.Pool
	sessions  *SessionRegistry
	content   *content.Service
	now       func() time.Time
	mu        sync.Mutex
	muteUntil map[playerShardKey]int64
}

type playerShardKey struct {
	ServerID int32
	PlayerID int64
}

// NewGmService wires dependencies. sessions may be nil when running standalone CLI.
func NewGmService(log *slog.Logger, pool *pgxpool.Pool, sessions *SessionRegistry, contentSvc *content.Service) *GmService {
	if contentSvc == nil {
		cat, err := content.EmbeddedCatalog()
		if err != nil {
			panic("gm: content catalog: " + err.Error())
		}
		contentSvc = content.NewService(cat)
	}
	return &GmService{
		log:       log,
		pool:      pool,
		sessions:  sessions,
		content:   contentSvc,
		now:       time.Now,
		muteUntil: make(map[playerShardKey]int64),
	}
}

// LookupPlayer resolves a character by player_id or account login on a shard.
func (g *GmService) LookupPlayer(ctx context.Context, token string, audit GmAudit, serverID int32, playerID int64, login string) (GmOpResult, GmPlayerInfo, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, GmPlayerInfo{}, err
	}
	row, err := lookupPlayerRow(ctx, g.pool, serverID, playerID, login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GmOpResult{}, GmPlayerInfo{}, fmt.Errorf("gm: player not found")
		}
		return GmOpResult{}, GmPlayerInfo{}, err
	}
	res := newGmOpResult(audit, g.now())
	info := GmPlayerInfo{
		AccountID:     row.AccountID,
		AccountLogin:  row.LoginName,
		AccountBanned: row.AccountBan,
		ServerID:      row.ServerID,
		PlayerID:      row.PlayerID,
		DisplayName:   row.DisplayName,
		Level:         row.Level,
		Power:         row.Power,
		Wallet:        row.Wallet,
	}
	if g.sessions != nil {
		info.Online = g.sessions.IsPlayerOnline(serverID, row.PlayerID)
	}
	g.mu.Lock()
	info.ChatMutedUntilMS = g.muteUntil[playerShardKey{ServerID: serverID, PlayerID: row.PlayerID}]
	g.mu.Unlock()
	logGmOp(g.log, "LookupPlayer", res, "server_id", serverID, "player_id", row.PlayerID)
	return res, info, nil
}

// GrantReward calls content.Grant and records reward_grant_queue for idempotency.
func (g *GmService) GrantReward(ctx context.Context, token string, audit GmAudit, serverID int32, playerID int64, pkg content.RewardPackage, idempotencyKey string) (GmOpResult, content.GrantResult, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, content.GrantResult{}, err
	}
	if stringsTrim(idempotencyKey) == "" {
		return GmOpResult{}, content.GrantResult{}, errors.New("gm: idempotency_key is required")
	}
	if _, err := lookupPlayerRow(ctx, g.pool, serverID, playerID, ""); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GmOpResult{}, content.GrantResult{}, fmt.Errorf("gm: player not found")
		}
		return GmOpResult{}, content.GrantResult{}, err
	}
	raw, _ := json.Marshal(pkg)
	var existing int64
	err := g.pool.QueryRow(ctx, `
		SELECT grant_id FROM reward_grant_queue
		WHERE server_id = $1 AND idempotency_key = $2 AND status = 2`,
		serverID, idempotencyKey).Scan(&existing)
	if err == nil {
		p := content.PlayerRef{ServerID: serverID, PlayerID: playerID}
		res, grantErr := g.content.Grant(p, pkg, idempotencyKey)
		if grantErr != nil {
			return GmOpResult{}, content.GrantResult{}, grantErr
		}
		res.Duplicate = true
		res.GrantID = existing
		op := newGmOpResult(audit, g.now())
		logGmOp(g.log, "GrantReward", op, "duplicate", true, "grant_id", existing)
		return op, res, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return GmOpResult{}, content.GrantResult{}, err
	}

	grantID, err := g.nextGrantID(ctx, serverID)
	if err != nil {
		return GmOpResult{}, content.GrantResult{}, err
	}
	_, err = g.pool.Exec(ctx, `
		INSERT INTO reward_grant_queue (server_id, grant_id, player_id, source_type, source_ref, rewards, status, idempotency_key)
		VALUES ($1, $2, $3, 'gm', $4, $5::jsonb, 1, $6)`,
		serverID, grantID, playerID, audit.TicketID, raw, idempotencyKey)
	if err != nil {
		return GmOpResult{}, content.GrantResult{}, err
	}

	job := content.GrantJob{
		ServerID:       serverID,
		GrantID:        grantID,
		PlayerID:       playerID,
		SourceType:     "gm",
		SourceRef:      audit.TicketID,
		Rewards:        pkg,
		IdempotencyKey: idempotencyKey,
	}
	status, grantRes, procErr := g.content.ProcessGrant(job)
	if procErr != nil {
		_, _ = g.pool.Exec(ctx, `UPDATE reward_grant_queue SET status = 3, error_msg = $3, completed_at = now()
			WHERE server_id = $1 AND grant_id = $2`, serverID, grantID, truncateErr(procErr))
		return GmOpResult{}, content.GrantResult{}, procErr
	}
	_, _ = g.pool.Exec(ctx, `UPDATE reward_grant_queue SET status = $3, completed_at = now()
		WHERE server_id = $1 AND grant_id = $2`, serverID, grantID, status)

	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "GrantReward", op, "grant_id", grantRes.GrantID, "duplicate", grantRes.Duplicate)
	return op, grantRes, nil
}

// MutePlayer stores mute deadline in-process (chat domain will replace with persistent store).
func (g *GmService) MutePlayer(_ context.Context, token string, audit GmAudit, serverID int32, playerID int64, muteUntilMS int64) (GmOpResult, int64, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, 0, err
	}
	g.mu.Lock()
	g.muteUntil[playerShardKey{ServerID: serverID, PlayerID: playerID}] = muteUntilMS
	g.mu.Unlock()
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "MutePlayer", op, "mute_until_ms", muteUntilMS)
	return op, muteUntilMS, nil
}

// KickPlayer revokes DB sessions and drops gateway session bindings when co-located with api.Server.
func (g *GmService) KickPlayer(ctx context.Context, token string, audit GmAudit, serverID int32, playerID int64) (GmOpResult, bool, error) {
	if err := AuthorizeGm(token, audit); err != nil {
		return GmOpResult{}, false, err
	}
	row, err := lookupPlayerRow(ctx, g.pool, serverID, playerID, "")
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GmOpResult{}, false, fmt.Errorf("gm: player not found")
		}
		return GmOpResult{}, false, err
	}
	terminated := false
	if g.sessions != nil {
		for _, sid := range g.sessions.SessionIDsForPlayer(serverID, playerID) {
			g.sessions.Remove(sid)
			terminated = true
		}
	}
	n, err := revokeAccountSessions(ctx, g.pool, row.AccountID)
	if err != nil {
		return GmOpResult{}, false, err
	}
	if n > 0 {
		terminated = true
	}
	op := newGmOpResult(audit, g.now())
	logGmOp(g.log, "KickPlayer", op, "session_terminated", terminated, "sessions_revoked", n)
	return op, terminated, nil
}

func (g *GmService) nextGrantID(ctx context.Context, serverID int32) (int64, error) {
	var id int64
	err := g.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(grant_id), 0) + 1 FROM reward_grant_queue WHERE server_id = $1`, serverID).Scan(&id)
	return id, err
}

func truncateErr(err error) string {
	msg := err.Error()
	if len(msg) > 240 {
		return msg[:240]
	}
	return msg
}

func stringsTrim(s string) string { return strings.TrimSpace(s) }
