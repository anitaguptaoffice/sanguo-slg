// Package content provides items, quests, shop, and live-ops features.
//
// Bag and item definitions are driven by seed JSON (see seed/catalog.json),
// aligned with spec/data/source/items.yml via SPEC-004.
//
// Reward grants use the JSON schema in spec/rules/content.md (Service.Grant,
// ParseRewardJSON, ProcessGrant for reward_grant_queue sync consumption).
// With PGStore, Grant commits player_item, player_wallet and reward idempotency
// atomically. Replays validate player and payload; pending GM rows retain their ID.
// LoadPlayer restores the durable wallet as well as the bag.
//
// This boundary does not make API quest hooks, consumable effects, or legacy
// absolute SaveStack writes from separate services transactional. Callers must
// also reconcile domestic wallet caches before later snapshot flushes; a successful
// grant alone is not a guarantee that an unrelated stale snapshot cannot overwrite it.
package content
