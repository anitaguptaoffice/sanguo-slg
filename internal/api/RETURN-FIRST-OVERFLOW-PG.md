# Return overflow must not strand paid completion

Card #2402 adds one distinct SOURCE test scenario on held FIRST source `1a7d1ed`.
It neither replaces the unconfirmed CI registration nor changes that frozen CI input.
No production, old helper, Binding/profile, contract, workflow or hold changes.

`TestPGReturnOverflowUnblocksRecruitCompletion` changes synthetic retained unit1
survivors from 7 to 8 before either real paid admission. Unchanged ROWS helpers create
R=M−11/P4 and two real paid 22-second jobs; no paid schedule or receipt is fabricated.
Actual Return leads and pauses at its clock QueryStart with the common locks held.
A distinct actual Recruit completion backend must wait on its exact wallet SQL,
confirmed by PostgreSQL blocking PIDs, source trace and original transport identity.

Return fails capacity at R+P+S=M+1 and performs actual independent five-second
Background rollback. No gate pauses that cleanup. The rejection must be known-ended,
non-source failure, with zero observation and no diagnostic, lease or generation leak.
The new closed 77-query oracle requires clock then rollback and forbids evidence,
credit and Commit. Its dedicated End validator requires one genuine ROLLBACK tag.
Synthetic oracle/protocol negative controls are not substitutes for the real consumer.

Recruit then reaches its own real clock/pre-Commit boundaries and commits normally.
Unchanged RowsCheckpoint proves R=M−9/P2, FIFO promotion and retained paid/MVCC state.
An explicit test-only Return retry still rejects without changing that checkpoint:
completion converts P into R and does not free total capacity. Both generations remain
healthy before close/drain; original locks, pins and both pool slots must be released.

This fixture does not prove natural march/arrival/restart or production-controller safety.
Official exact-head ordinary/race, both new formatter paths, complete inherited/new
focused and mutation gates remain pending. Keep Draft and all existing holds.
