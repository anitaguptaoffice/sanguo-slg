# Pure mailbox state oracle

CI-MAIL-STATE-ORACLE-001, #2521. Fresh implementation from ddc80aab;
no historical 509-line candidate or its 64 tests were recovered or reused.
This component never executes SQL, GM, processes, browser actions or networks.

`MAIL_STATE_SQL` returns a raw JSON object keyed by production table name plus
`pgNow`. Execute within `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and
`COMMIT` using psql `-qAt -v ON_ERROR_STOP=1`. All required tables are unfiltered
whole-table ordered JSON arrays. Missing required tables fail the statement.
Optional hero_expr_session, hero_largess_schedule and hero_march_force use fixed
read-only dynamic queries: absent is null, present-empty is [], any row rejects.
Repeatable-read is essential for optional query_to_xml reads to share one snapshot.
No table creation, owner prefilter, skipped table or preverified flag is permitted.
Account projects only account_id/status; player omits last_login_at; account_session
is deliberately excluded. Auth/session correctness belongs to #2309. No credentials
are selected. Optional table presence must remain unchanged throughout the run.

Create with `{identity, fixtureSpec}` after actual authenticated startup. Identity
has account_id/player_id/server_id/city_id; four specs D,C,B,A have label/title/body/
mail_type/attachments using production reward JSON (`qty`, not protobuf quantity).
Call beginFixtures(snapshot), then finishFixtures(snapshot, four raw cmd/gm receipts).
Call advance(snapshot, authorizedReadIdOrNull) at every settled action boundary;
reads must be B,A,D,C exactly. finish(snapshot) requires all four reads. Returned
before/after arrays are canonical PlayerMail rows, descending by strict created_at,
int64 values as strings, empty attachments null. ids() and evidence() return copies;
evidence is a sanitized inventory, never a native-acceptance result.

Contracts inspected: spec/db/001_account.sql, 002_world.sql, 003_domestic.sql,
007_domestic_production_checkpoint.sql, m4_003_mail_reward.sql; internal/domestic/
service.go and internal/api/world_handlers.go. The fixed fresh city has hall1/farm1,
120 food/hour and 75000 cap. Settlement uses BigInt nanoseconds/remainders, including
settled_submicro_ns, with cap overflow discarded. Runs must remain under 24 hours;
this avoids guessing intermediate offline truncation. PGX mail creation truncates
Go timestamps to microseconds; GM/SQL correspondence preserves this precision.
The natural starter book 2004x1 and its completed grant receipt are mandatory and
immutable (internal/api/starter_scroll.go). Other asset/queue rows start empty and
remain unchanged. This fixture is not a general economy or arbitrary-city verifier.

Browser-free tests cover positive states and malformed/identity/GM/fixture/read/
side-effect/economy/time/secret-leak negatives. SQL has not been executed here.
Independent component/combination review, official SQL/runtime/native input,
screenshots, cleanup and exact-head CI remain pending. NEVER MERGE; no orphan
publication, native PASS, hold release or production deployment is authorized.
