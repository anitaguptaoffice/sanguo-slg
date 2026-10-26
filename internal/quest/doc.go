// Package quest implements player quest accept, progress, claim, and chain status (QUEST-001).
// Persistence follows spec/db/006_content.sql and m4_001_quest.sql; rewards go through RewardGranter.
package quest

// Tutorial progress proof v1 is reserved for authoritative server reconciliation
// of chain100 IDs 1001–1005. Stores reject proof without a previously accepted
// row and retain proof, completion and nonnil timestamps under stale writes.
// Public Report still cannot set proof. Its public API gate and deployment
// drain of old writers remain separate prerequisites.

// Reconciliation requires a startup-wired TutorialFactsProvider. It runs after
// accept and on ordinary list/chain reads; API action hooks call ReconcileTutorial.
// Only unchanged DATA-002 IDs 1001–1005 qualify. The partial dev catalog cannot
// demonstrate the full chain and its untyped fallback must not be used as DATA-002.
// Tutorial Claim first checks exact read-only durable receipts. Paid rewards repair
// state without revalidating vanished facts; absent receipts require accepted,
// unlocked, prerequisite-complete fixed configuration plus durable v1 proof.
// Returned reward bundles describe the original package, never a client asset
// delta: consumers must refresh authoritative inventory/wallet, not add rewards.
// Public Report gates, level persistence and deployment wiring remain separate
// cards; this package change alone is not a safe release.
