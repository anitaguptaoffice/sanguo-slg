# Natural recruitment transaction boundary

`WireM4Content` builds private item participants from the player pool and checks
that the hero PG store uses that exact pool. The exposed content service is used
only for post-commit invalidation. No memory/legacy inventory fallback is allowed.

`recruitHeroAtomic` validates the actor, locks its authoritative wallet, reads
heroes and inventory through the same transaction, prepares a server-owned plan,
conditionally debits four resources and books, and inserts a sequence-owned hero.
Only one successful Commit publishes the response and permits the handler's
existing quest signal. Gold is not charged. Template uniqueness is a business
rejection; primary-key collisions remain internal errors. No DB details escape.

Invalidation and domestic refresh failures after commit are diagnostic, not
purchase failures. No earlier wallet/item snapshot is installed in a cache.
Commit errors can mean an unknown outcome: there is no retry or compensation;
clients must refresh durable state. Without a request key, random recruitment
is not exactly-once. This is not authorization to deploy incompatible writers.
