// Package quest implements player quest accept, progress, claim, and chain status (QUEST-001).
// Persistence follows spec/db/006_content.sql and m4_001_quest.sql; rewards go through RewardGranter.
package quest

// Tutorial progress proof v1 is reserved for authoritative server reconciliation
// of chain100 IDs 1001–1005. Stores reject proof without a previously accepted
// row and retain proof, completion and nonnil timestamps under stale writes.
// Public Report still cannot set proof. Authority/receipt service gates and
// deployment drain of old writers are separate prerequisites, not implemented here.
