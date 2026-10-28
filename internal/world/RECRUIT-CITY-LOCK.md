# Dormant Recruit city locker

`NewRecruitCityLocker` copies the independently reviewed seven-object WORLD
profile and binds its validated source to one exact Recruit transaction Binding.
`Pin` locks only the qualified `player_city` relation in ROW SHARE mode and
revalidates source metadata. `Lock` requires the expected pin, revalidates the
source, then selects the captured-shard city FOR UPDATE and checks its owner.
A mismatch or missing city fails; APP must roll back on error. Retirement is
shared by copies and is not an in-flight drain or external DDL fence.

APP remains responsible for authentication, earlier account/wallet locks,
source enrollment, external writer/retention exclusions, transaction end, and
publication. This component is not wired into live Recruit and does not prove
those obligations, readiness, admission, commit, or production safety.

PostgreSQL tests use the existing isolated disposable fixture and need PG17 via
`DATABASE_URL`. Tests skipped without it are not database acceptance evidence.
