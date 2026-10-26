package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

var (
	ErrGrantReceiptUnsupported = errors.New("content: durable grant receipt lookup unsupported")
	ErrGrantReceiptMismatch    = errors.New("content: grant receipt does not match")
)

// GrantReceipt is the identity and original package of a verified durable grant.
type GrantReceipt struct {
	GrantID int64
	Rewards RewardPackage
}

// FindGrantReceipt only reads durable state, never grants, loads caches or retries.
// Callers must supply the authenticated player and server-derived fixed key and
// package, not client assertions. Only an absent server/key returns false, nil;
// an existing but incompatible row is an error and must not trigger a new grant.
// In-memory/legacy stores without this capability fail closed.
func (s *Service) FindGrantReceipt(ctx context.Context, player PlayerRef, expected RewardPackage, idempotencyKey string) (GrantReceipt, bool, error) {
	if s != nil {
		if reader, ok := s.store.(interface {
			FindGrantReceipt(context.Context, PlayerRef, RewardPackage, string) (GrantReceipt, bool, error)
		}); ok {
			return reader.FindGrantReceipt(ctx, player, expected, idempotencyKey)
		}
	}
	return GrantReceipt{}, false, ErrGrantReceiptUnsupported
}

// FindGrantReceipt uses the same JSONB equality as Grant. Canonicalization is the
// producer's responsibility: nil and empty maps/slices differ, and item ordering
// matters. Resource object key order does not. No aliases, quantities or arrays
// are merged, reordered or rewritten by this read-only boundary.
func (p *PGStore) FindGrantReceipt(ctx context.Context, player PlayerRef, expected RewardPackage, idempotencyKey string) (GrantReceipt, bool, error) {
	if player.ServerID <= 0 || player.PlayerID <= 0 || idempotencyKey == "" {
		return GrantReceipt{}, false, fmt.Errorf("content: invalid grant receipt identity")
	}
	if _, err := resourceDeltaFromMap(expected.Resources); err != nil {
		return GrantReceipt{}, false, err
	}
	for _, item := range expected.Items {
		if item.ItemCfgID <= 0 || item.Qty <= 0 {
			return GrantReceipt{}, false, ErrInvalidReward
		}
	}
	raw, err := json.Marshal(expected)
	if err != nil {
		return GrantReceipt{}, false, err
	}
	var grantID, owner int64
	var status int16
	var sameReward bool
	var stored []byte
	err = p.Pool.QueryRow(ctx, `SELECT grant_id, player_id, status, rewards, rewards=$3::jsonb
		FROM reward_grant_queue WHERE server_id=$1 AND idempotency_key=$2`,
		player.ServerID, idempotencyKey, raw).Scan(&grantID, &owner, &status, &stored, &sameReward)
	if errors.Is(err, pgx.ErrNoRows) {
		return GrantReceipt{}, false, nil
	}
	if err != nil {
		return GrantReceipt{}, false, fmt.Errorf("content: read grant receipt: %w", err)
	}
	if owner != player.PlayerID || status != GrantStatusSuccess || grantID <= 0 {
		return GrantReceipt{}, false, fmt.Errorf("%w: owner, status or identity", ErrGrantReceiptMismatch)
	}
	pkg, err := ParseRewardJSON(stored)
	if err != nil {
		return GrantReceipt{}, false, err
	}
	if !sameReward {
		return GrantReceipt{}, false, fmt.Errorf("%w: package", ErrGrantReceiptMismatch)
	}
	return GrantReceipt{GrantID: grantID, Rewards: pkg}, true, nil
}
