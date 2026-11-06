# Durable recruit source (dormant)

`NewRecruitParticipant` captures the independently supplied MIL profile and a
validated private copy of every retained catalog version and current version.
The profile and catalog are consistency inputs, not enrollment, provenance, or
approval. The caller must retain the reviewed external evidence and exclusion
fences. No business admission or completion is enabled here.

`Pin` takes the five MIL relation locks in the frozen order and rechecks source
metadata, append-only INSERT privileges and receipt row-lock privilege. Definite drift retires all participant copies. A valid
exhausted sequence remains usable for historical reads; future admission must
separately reject unavailable allocation. Neither construction nor Pin allocates
IDs, mutates data or settings, or controls transaction lifetime. Pins do not
fence sequence manipulation, other writers, or restore operations.

`readRecruitPending` is a private raw snapshot reader: after the caller's validated
source/Binding/live Access, relation pins and ordered ACCOUNT/DOM/WORLD barriers,
it locks the matching marker, all stock in unit order and all pending type3 queues
in queue-ID order. It checks marker owner/cohort/format and structural array sizes;
wrong-owner or malformed pending rows remain visible. It allocates no IDs, samples
no clock, writes no row and takes no origin/receipt row locks. Copied fields are not
an admission, validated pending work, commit result or authorization capability.

`Prepare` retains decoding, accepted-history evidence, R+P validation, intent/current
catalog checks, scheduling and allocation in their existing order. A future Return
caller must first lock/classify march, army and troops before applying returning-only
pending/capacity validation; current capacity must not invalidate terminal history.
This helper does not implement Return, its complete 23-object source gate, outer
composition, recovery or production wiring. The existing 14-object Recruit source
is not Return certification; future reuse must preserve binding and retirement.
