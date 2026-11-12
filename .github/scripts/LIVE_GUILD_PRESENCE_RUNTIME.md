# Isolated guild presence runtime

CI-GUILD-PRESENCE-RUNTIME-001, issue #2295. CI-only validation Draft, NEVER MERGE.
Source product #2290/#2294 and baseline757e43a9 are read-only inputs. No fixtures or product edits.
Imports only six lifecycle exports from immutable7dc5939/tree dc151c; original complete helper suite remains mandatory.
Official Actions only: PG17/Redis7, real cmd/server, seven existing DATA-002 seeds, sandbox Chromium.
Actual production protobuf drives strict matched traffic. Login20001 and guild channel3 are enum checked.
Only natural account/city bootstrap and one CreateGuild may mutate; two actual member lists, no chat sends/join/leave/economy mutation.
Auth/session/trace/raw frames are omitted from reports. Only safe request metadata, own IDs, rates and SQL witnesses persist.
Single-statement snapshots bind actual actor/server/city; guild/member rows must match actual create/list payloads.
Creation requires exact wallet/assets equality. Final passive production uses exact BigInt nanoseconds and remainders, bounded to300s below cap, never a tolerance.
All four jobs are isolated baseline/fixed at1280/1600. Native scenario lives in dependent #2296; this runtime cannot establish native PASS alone.
Original helper tests and this suite must run after clean product tests/build, with byte-compared staged copies.
Independent final component/combination/published mapping review precedes any official browser run. Failures retain screenshots and cleanup evidence.
