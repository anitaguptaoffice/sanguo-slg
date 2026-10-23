package account

import (
	"context"
	"errors"
	"strings"
	"time"

	accountv1 "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1"
	commonpb "github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1"
	"github.com/jackc/pgx/v5"
)

const (
	accountStatusActive  = 1
	accountStatusBanned  = 2
	serverStatusMaintain = 0
	serverStatusStopped  = 3
	defaultSessionTTL    = 24 * time.Hour
)

// Service implements account registration, login, and session refresh.
type Service struct {
	store *Store
	now   func() time.Time
	ttl   time.Duration
}

// NewService builds an account service backed by PostgreSQL.
func NewService(store *Store) *Service {
	return &Service{
		store: store,
		now:   time.Now,
		ttl:   defaultSessionTTL,
	}
}

// Register creates a global account with a salted password hash.
func (s *Service) Register(ctx context.Context, loginName, password string) (int64, error) {
	loginName = strings.TrimSpace(loginName)
	if loginName == "" || password == "" {
		return 0, errors.New("login_name and password required")
	}
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	return s.store.InsertAccount(ctx, loginName, hash)
}

// Login verifies credentials, checks shard availability, and issues a session.
func (s *Service) Login(ctx context.Context, loginName, password string, serverID int32) (*accountv1.LoginResponse, error) {
	loginName = strings.TrimSpace(loginName)
	acc, err := s.store.AccountByLoginName(ctx, loginName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLoginFailed
		}
		return nil, err
	}
	if acc.Status == accountStatusBanned {
		return nil, ErrBanned
	}
	if !CheckPassword(acc.PasswordHash, password) {
		return nil, ErrLoginFailed
	}
	srv, err := s.store.GameServer(ctx, serverID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServerNotFound
		}
		return nil, err
	}
	if srv.Status == serverStatusMaintain || srv.Status == serverStatusStopped {
		return nil, ErrServerUnavailable
	}
	player, err := s.store.PlayerOnServer(ctx, serverID, acc.ID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoPlayer
		}
		return nil, err
	}
	expires := s.now().Add(s.ttl)
	sessionID, err := s.store.CreateSession(ctx, acc.ID, expires)
	if err != nil {
		return nil, err
	}
	wallet, err := s.store.Wallet(ctx, serverID, player.PlayerID)
	if err != nil {
		return nil, err
	}
	return &accountv1.LoginResponse{
		SessionId:           sessionID,
		SessionExpiresAtMs: expires.UnixMilli(),
		Player: &commonpb.PlayerProfile{
			ServerId:    player.ServerID,
			PlayerId:    player.PlayerID,
			DisplayName: player.DisplayName,
			Level:       player.Level,
			Power:       player.Power,
		},
		Wallet: &commonpb.ResourceWallet{
			Food:  wallet.Food,
			Wood:  wallet.Wood,
			Iron:  wallet.Iron,
			Stone: wallet.Stone,
			Gold:  wallet.Gold,
		},
	}, nil
}

// RefreshSession extends a valid session and returns the new expiry.
func (s *Service) RefreshSession(ctx context.Context, sessionID string) (*accountv1.RefreshSessionResponse, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, ErrUnauthorized
	}
	now := s.now()
	ok, _, err := s.store.SessionValid(ctx, sessionID, now)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrUnauthorized
	}
	newExpires := now.Add(s.ttl)
	expiresAt, err := s.store.RefreshSession(ctx, sessionID, newExpires, now)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUnauthorized
		}
		return nil, err
	}
	return &accountv1.RefreshSessionResponse{
		SessionId:           sessionID,
		SessionExpiresAtMs: expiresAt.UnixMilli(),
	}, nil
}

// ValidSession implements gateway session checks.
func (s *Service) ValidSession(ctx context.Context, sessionID string) bool {
	ok, _, err := s.store.SessionValid(ctx, sessionID, s.now())
	return err == nil && ok
}
