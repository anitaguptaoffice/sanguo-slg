# Fresh city template snapshot

`snapshotFreshTemplate` is a private, pure prerequisite for the future fresh-city
participant; it neither grants creation authority nor performs persistence, wallet
settlement, scheduling or publication. Its inputs are trusted server configuration,
not request data. The caller must exclude concurrent mutation during the copy.

The helper rejects nonfresh state, any job (including nil/completed jobs), invalid
resources, building entries and catalog entries. PostgreSQL `varchar(32)` counts
Unicode characters and cannot store NUL; slot keys must also be nonempty valid
UTF-8. Building durations fit the model's `time.Duration` representation. The
helper clones both maps and every building pointer without changing either input.
It does not impose gameplay progression rules or replace source enrollment,
transactional validation and the future participant's initialization checks.
The existing API handler remains unchanged: its initial wallet is 8000 food,
8000 wood, 5000 stone and 5000 iron; hall and farm are configuration IDs 1 and 2
at level 1. A test fixes these values as the trusted template example.
