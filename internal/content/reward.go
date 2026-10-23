package content

import (
	"context"
	"encoding/json"
	"fmt"
)

// Grant queue status values align with reward_grant_queue.status (spec/db/m4_003_mail_reward.sql).
const (
	GrantStatusPending    int16 = 0
	GrantStatusProcessing int16 = 1
	GrantStatusSuccess    int16 = 2
	GrantStatusFailed     int16 = 3
)

// RewardItem is one row in the rewards JSON "items" array.
type RewardItem struct {
	ItemCfgID int32 `json:"item_cfg_id"`
	Qty       int32 `json:"qty"`
}

// RewardPackage is the unified reward schema (quests, mail, shop, grant queue).
type RewardPackage struct {
	Resources map[string]int64 `json:"resources"`
	Items     []RewardItem     `json:"items"`
}

// GrantJob is the in-memory shape of a reward_grant_queue row for sync processing.
type GrantJob struct {
	ServerID       int32
	GrantID        int64
	PlayerID       int64
	SourceType     string
	SourceRef      string
	Rewards        RewardPackage
	IdempotencyKey string
}

// GrantResult is returned after a successful or duplicate grant.
type GrantResult struct {
	GrantID   int64
	Duplicate bool
	Wallet    ResourceWallet
	Bag       []Stack
}

type idemRecord struct {
	grantID int64
	result  GrantResult
}

// ParseRewardJSON decodes the rewards JSON blob used by quests, mail, and the grant queue.
func ParseRewardJSON(raw []byte) (RewardPackage, error) {
	if len(raw) == 0 {
		return RewardPackage{}, nil
	}
	var pkg RewardPackage
	if err := json.Unmarshal(raw, &pkg); err != nil {
		return RewardPackage{}, fmt.Errorf("content: invalid rewards json: %w", err)
	}
	return pkg, nil
}

func resourceDeltaFromMap(m map[string]int64) (ResourceWallet, error) {
	var d ResourceWallet
	for k, n := range m {
		if n < 0 {
			return ResourceWallet{}, fmt.Errorf("content: negative resource %q", k)
		}
		switch k {
		case "food":
			d.Food = n
		case "wood":
			d.Wood = n
		case "iron":
			d.Iron = n
		case "stone":
			d.Stone = n
		case "gold", "silver":
			d.Gold += n
		default:
			return ResourceWallet{}, fmt.Errorf("content: unknown resource key %q", k)
		}
	}
	return d, nil
}

// Grant applies a reward package to the player's wallet and bag.
// When idempotencyKey is non-empty, a repeat call returns the first result with Duplicate=true.
func (s *Service) Grant(p PlayerRef, pkg RewardPackage, idempotencyKey string) (GrantResult, error) {
	ctx := context.Background()
	if idempotencyKey != "" {
		dup, err := s.lookupIdempotentGrant(ctx, p, idempotencyKey)
		if err != nil {
			return GrantResult{}, err
		}
		if dup != nil {
			return *dup, nil
		}
	}

	delta, err := resourceDeltaFromMap(pkg.Resources)
	if err != nil {
		return GrantResult{}, err
	}
	for _, row := range pkg.Items {
		if row.ItemCfgID <= 0 || row.Qty <= 0 {
			return GrantResult{}, ErrInvalidReward
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if idempotencyKey != "" {
		key := idempotencyKeyFor(p.ServerID, idempotencyKey)
		if rec, ok := s.idempotency[key]; ok {
			out := rec.result
			out.Duplicate = true
			return out, nil
		}
	}

	for _, row := range pkg.Items {
		if _, err := s.addUnlocked(p, row.ItemCfgID, row.Qty); err != nil {
			return GrantResult{}, err
		}
	}
	if delta.Food != 0 || delta.Wood != 0 || delta.Iron != 0 || delta.Stone != 0 || delta.Gold != 0 {
		s.creditWallet(p, delta)
	}

	grantID, err := s.allocateGrantID(ctx, p.ServerID)
	if err != nil {
		return GrantResult{}, err
	}
	res := GrantResult{
		GrantID: grantID,
		Wallet:  s.walletFor(p),
		Bag:     s.listUnlocked(p),
	}
	if idempotencyKey != "" {
		key := idempotencyKeyFor(p.ServerID, idempotencyKey)
		s.idempotency[key] = idemRecord{grantID: grantID, result: res}
		if s.store != nil {
			job := GrantJob{
				ServerID:       p.ServerID,
				PlayerID:       p.PlayerID,
				Rewards:        pkg,
				IdempotencyKey: idempotencyKey,
			}
			if err := s.store.RecordSuccessfulGrant(ctx, job, grantID); err != nil {
				return GrantResult{}, err
			}
		}
	}
	return res, nil
}

func (s *Service) lookupIdempotentGrant(ctx context.Context, p PlayerRef, idempotencyKey string) (*GrantResult, error) {
	key := idempotencyKeyFor(p.ServerID, idempotencyKey)
	s.mu.RLock()
	rec, ok := s.idempotency[key]
	s.mu.RUnlock()
	if ok {
		out := rec.result
		out.Duplicate = true
		return &out, nil
	}
	if s.store == nil {
		return nil, nil
	}
	grantID, found, err := s.store.FindSuccessfulGrant(ctx, p.ServerID, idempotencyKey)
	if err != nil || !found {
		return nil, err
	}
	if err := s.LoadPlayer(ctx, p); err != nil {
		return nil, err
	}
	s.mu.RLock()
	out := GrantResult{
		GrantID:   grantID,
		Duplicate: true,
		Wallet:    s.walletFor(p),
		Bag:       s.listUnlocked(p),
	}
	s.mu.RUnlock()
	return &out, nil
}

func (s *Service) allocateGrantID(ctx context.Context, serverID int32) (int64, error) {
	if s.store != nil {
		return s.store.NextGrantID(ctx, serverID)
	}
	return s.nextGrantID(serverID), nil
}

func (s *Service) nextGrantID(serverID int32) int64 {
	s.grantSeq[serverID]++
	return s.grantSeq[serverID]
}

func idempotencyKeyFor(serverID int32, key string) string {
	return fmt.Sprintf("%d:%s", serverID, key)
}

// ProcessGrant is the sync consumer hook for reward_grant_queue: applies rewards or records failure.
func (s *Service) ProcessGrant(job GrantJob) (status int16, result GrantResult, err error) {
	p := PlayerRef{ServerID: job.ServerID, PlayerID: job.PlayerID}
	res, err := s.Grant(p, job.Rewards, job.IdempotencyKey)
	if err != nil {
		return GrantStatusFailed, GrantResult{}, err
	}
	if job.GrantID > 0 {
		res.GrantID = job.GrantID
	}
	return GrantStatusSuccess, res, nil
}
