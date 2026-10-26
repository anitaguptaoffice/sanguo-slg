// Package content provides items, quests, shop, and live-ops features.
//
// Bag and item definitions are driven by seed JSON (see seed/catalog.json),
// aligned with spec/data/source/items.yml via SPEC-004.
//
// Reward grants use the JSON schema in spec/rules/content.md (Service.Grant,
// ParseRewardJSON, ProcessGrant for reward_grant_queue sync consumption).
// With PGStore, Grant commits player_item, player_wallet and reward idempotency
// atomically. Replays validate player and payload; pending GM rows retain their ID.
// Zero-resource grants keep existing wallet balances and updated_at unchanged;
// wallet locking and atomic bag/receipt writes still apply. New wallets initialize
// normally. Actual resource deltas retain existing timestamp semantics; this does
// not resolve general offline-accrual checkpoint coupling for resource writes.
// LoadPlayer restores the durable wallet as well as the bag.
// GrantContext bounds service-lock waits and PG transactions without detached work.
// Cancellation observed before mutation leaves state unchanged; commit errors
// do not prove rollback.
// Recover uncertain outcomes with the same key/package, never a replacement key.
// Cancelable contexts are rejected for legacy non-atomic stores; Grant preserves
// their background-context behavior, without adding transactional guarantees.
//
// Resource-pack Use also commits stock and wallet together, reading durable stock
// and publishing caches only after commit. Repeat requests are new uses when stock
// remains; Use has no request idempotency key. Other effect types are unchanged.
//
// LoadBagInTx and DebitItemsInTx participate in a caller-owned PG transaction.
// They acquire wallet before item locks, use authoritative stock and never
// publish caches or finish the transaction. The caller must roll back on any
// error and must supply a transaction from the configured database. After commit,
// InvalidatePlayerContext evicts stale bag/wallet snapshots with bounded lock
// acquisition; the next LoadPlayer hydrates them. Failed postcommit invalidation
// is diagnostic and must never cause the caller to debit again.
//
// CreateItemGrantInTx is a separate create-only SHOP participant, not Grant replay.
// Positive server purchase/offer IDs derive its receipt key/source; the exact
// item-only package is retained. An existing key always rejects a newly charged
// purchase. It requires an existing wallet and checks the post-debit bag, then
// reserves only receipt identity with bounded targeted-PK retries. All other
// errors require caller rollback; unknown commit outcomes must never be replayed.
// SupportsItemTransactionsFor checks exact startup pool/catalog binding. Existing
// GrantContext, tutorial/bootstrap and FindGrantReceipt semantics are unchanged.
//
// PG Remove uses the same wallet-before-item conditional debit as the transaction
// participant, without trusting cached quantities. Add/Set/direct SaveStack are
// rejected for PG: absolute maintenance writes require separately authorized
// downtime with competing writers stopped. Grant and the supplied-transaction
// item grant share a wallet lock that serializes absent/zero item creation.
// This boundary does not make API quest hooks, other consumable effects, or legacy
// non-PG stores transactional. Callers must
// also reconcile domestic wallet caches before later snapshot flushes; a successful
// grant alone is not a guarantee that an unrelated stale snapshot cannot overwrite it.
package content
