# Real APP admission panic endings

Card #3072 covers actual `admit -> end -> finish` with real owned PG17 participants.
Cases: funds rejection followed by rollback panic, provisional debit followed by
participant/rollback double panic, COMMIT-start panic and successful COMMIT callback
panic. Original cause/fault, cleanup fault, command/intent/queue identity and unknown
lease remain distinct. Independent snapshots distinguish committed admission from
rolled-back work; caller unknown is never rewritten by observer knowledge.

Each case uses a bounded child process. After fixture setup a failure guard exits
before T cleanup can wait on quarantined pool resources. The parent reaps the child
and drops its emitted schema. Exact captured transport close releases database locks;
this does not claim pool recovery, restart recovery or unknown resolution. Initialization
killed before schema emission is outside this injected-fault proof.

Run `go test -count=1 -run '^TestPGRecruitAdmissionPanic$' ./internal/api` with owned
PG17 DATABASE_URL, also with `-race`. Independent source and full-combination
ordinary/race acceptance are required before merging the dependent source stack.
