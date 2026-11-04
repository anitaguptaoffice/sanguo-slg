# Battle report offset-page drift

Task CLIENT-BATTLE-PAGE-DRIFT-001, issue #2039. Client-only follow-on to CLIENT-049.

ListBattleReports currently uses ordinary limit/offset with created_at descending, not a snapshot or cursor. If a new report arrives between pages, a later page can overlap an already accepted ID. Blind append duplicates list rows and traps adjacent navigation, whose indexOf lookup repeatedly selects the same ID.

The panel rejects an entire later batch if it overlaps accepted IDs, repeats an ID within the batch, or is empty while more records were expected. It preserves accepted rows, selection and filters, displays a refresh instruction, and disables further pagination without claiming all records loaded. The existing retry-list or refresh-list action starts at offset zero and clears this condition. Ordinary network failures remain retryable at the unchanged offset. Existing actor, request-generation and detach guards still run before page handling.

This is detection and bounded recovery, not a consistent snapshot: undetectable insertions, deletions and ordering ties can still cause omissions or reordering. No server/protocol change, automatic recovery loop, or mutation is introduced. Backend ordering and historical held work remain separate.

Validation: mounted panel regressions cover insertion overlap, duplicate/empty batches, explicit refresh recovery, adjacent navigation, outcome filtering, network retry, and stale completions. On the base, four regression assertions fail and six control cases pass. Focused panel suites pass 79 tests after the fix. Full suite/build and independent review are recorded in the PR before merge. DOM tests do not claim native browser or live-server acceptance.
