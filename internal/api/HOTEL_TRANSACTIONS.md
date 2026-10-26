# Hotel API transaction coordinator — local integration only

This card is **not independently deployable**. Activate the complete compatible
hotel/coming/captive/lionize writer set only after sibling coordinators, metadata
schema, client unknown-outcome handling and coordinated-release review. Existing
sibling gameplay is not disabled by this work. Hotel handlers use `hotelAtomic`;
coming/captive/lionize handlers use `familyAtomic` with the same captured hotel
dependencies. The unused legacy API HotelCityPort adapter has been removed; the
HERO domain port and its rule fixtures remain unchanged.

Private startup wiring binds the exact API pool/schema, HERO and WORLD service/
store identities, immutable DOM level capability, and a private CONTENT item
participant. Rewiring or memory/mixed dependencies cannot become a PG fallback.
All SQL inside the coordinator belongs to API actor/wallet; domain ports own the
other tables. Begin/Commit/Rollback belong only to API.

Order: actor KEY SHARE, initialized wallet UPDATE, WORLD city owner UPDATE, DOM
persisted levels, CONTENT items, HERO candidates/tick. No Hub/cache wait occurs
while database locks are held. Pure HERO plans retain current rules; draft IDs
are allocated from the candidate sequence in tx. Replacement and tick share the
commit. The response is the committed transaction snapshot, not a later reload;
hero_owned uses CountOwnedHeroes, excluding Coming/Captive across all cities.

Pure-memory HERO rule fixtures remain unchanged and explicitly nontransactional.
The prior nil-pool API hotel port could not provide a built hotel; it is not
represented as production or substituted for missing durable capabilities.

The three hotel gateway handlers use only the coordinator, including both packet
and payload shard validation and positive IDs. Selected recruitment does not sync,
expire or refill: the exact persisted candidate determines cost and attributes.
Conditional gold debit, exact consume and zero-ID hero creation share one commit.
No provisional hero ID, cache invalidation or quest event is published beforehand.

Commit errors return sanitized unavailable/reload guidance, with private operation
and actor/city/candidate diagnostics. No automatic replay, compensation, refund or
attribute-based success inference exists. After confirmed commit, invalidation,
authoritative domestic refresh and quest reconciliation are best effort and cannot
turn the result into a failed purchase. List is mutating and is not a recovery
receipt; unknown outcome cannot be exactly attributed without a separate contract.

Provenance limit: CONTENT exposes no underlying-store/pool identity accessor. The
coordinator captures the exposed service object's identity and rejects memory-only
rewiring; same-object `UseStore(otherPG)` is **not detected**. That object supplies
only a captured postcommit cache invalidator, never the debit/read participant.
The unexposed item service/store use the exact original pool and supplied tx.
Tests verify alternate cache PG receives no acquisition or debit and cannot alter
the coordinator's result. Other routes using a misconfigured exposed store are
outside this boundary and are not declared safe by these checks.
