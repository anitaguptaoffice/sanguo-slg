# Fresh DOM catalog validation

DOM-FRESH-CATALOG-001 / [#2435](https://github.com/anitaguptaoffice/sanguo-slg/issues/2435).
`validateFreshSource` is a private, stateless, read-only metadata component, not
`NewFreshCityParticipant`, enrollment, a pin, a proof or a readiness certificate.
Its only inputs are context, the exact Binding, Access and independent Profile.
It snapshots the Access value once and copies Profile/map before validation.
Unsynchronized concurrent mutation of caller-owned Go values remains unsupported.

The eight-key inventory describes three target tables and their five indexes,
not the whole schema. Unrelated 003 research/work-queue objects remain allowed.
Recruit's private read-only validation checks wallet shape and source identities;
a private two-object projection is used without Pin or retirement state. The city
query supplements wallet INSERT and checks city SELECT/INSERT/UPDATE privileges,
including the write privileges needed for the later relation/row lock operations.
No role, ACL, OWNER, RLS, policy or other security setting is changed.

003/007 code constants fix every column, the five complete checkpoint CHECKs and
four city indexes. Building varchar(32) has typmod36, default collation and btree
text_ops. Constraint validation/local/inheritance properties, fixed index flags,
trigger/rule/policy absence and reviewed dependency allowlists are checked.
Only own row type, defaults, PK/CHECK and target index dependencies are accepted;
foreign references and views are rejected. No business CHECK is invented.

Malformed independent data returns `freshsource.ErrProfile`; transaction, context
and SQL errors remain unchanged. Only catalog false or ErrRecruitWalletSource
maps to `errFreshSourceMetadata`. Success is not retained or cached. The two
READ COMMITTED scans do not establish a repeatable MVCC snapshot. Independently
verified external DDL/role/writer exclusion and provenance remain mandatory.
There is no Begin, ending, Hub access, business write or publication here.
There are no explicit or transaction-held target pins or business locks. PG17
catalog deparsing may briefly acquire and release AccessShareLock; this does not
promise the absence of transient locks while the catalog query is running.

Pure tests cover expected-data isolation/inventory/malformed inputs and invalid
handle error preservation. They do not prove PostgreSQL semantics. Real PG17
ordinary/race acceptance and independent composition review are mandatory under
[#2436](https://github.com/anitaguptaoffice/sanguo-slg/issues/2436) before merge.
Local Go/gofmt and PostgreSQL execution were unavailable during implementation;
no local build, formatting-tool or real-database PASS is claimed. Permission-denial
and role/ACL/OWNER/RLS/policy mutation experiments were not executed or authorized.
This is not a complete permission-negative matrix, restart or fresh-chain proof.
