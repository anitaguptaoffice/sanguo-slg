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
