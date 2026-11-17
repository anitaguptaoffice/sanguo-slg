# Fresh DOM catalog PostgreSQL evidence

DOM-FRESH-CATALOG-PG-001 / [#2436](https://github.com/anitaguptaoffice/sanguo-slg/issues/2436).
Source prerequisite: [#2435](https://github.com/anitaguptaoffice/sanguo-slg/issues/2435),
`e35561a29bfb2af253ff1847a12975bdee84dbdb`, tree
`51017b558884e88b8c9c73139d230abac93092b4`; original base
`634ad6c980961e98fd22741a3b4eb864363bc470`, correction parent `8fcfefd03640faa12f105b61fdb3fa59016117e0`.

The four `TestPGFreshCatalog*` tests call the actual private validator. Fixtures
reuse recruitWalletFixture/Begin unchanged, execute actual 003 plus actual 007,
and capture only test identities. Approved shapes are immutable product constants.
ReadOnly covers normal/quoted schemas, empty/populated business tables, repeated
validation, the actual varchar PK text_ops, unchanged full row/settings snapshots,
no assigned transaction ID or residual fixture relation pins, and caller commit.
ExpectedIdentity covers nine source identity fields and all eight object OIDs,
owners, missing/substituted/extra keys. OperationalErrors preserves binding,
invalid handle, nil/canceled/expired context, ended and actual SQL-abort errors.
HostileShape covers all checkpoint column types/defaults and non-PK nullability,
all five CHECKs (missing, weakened upper/lower, NOT VALID, NO INHERIT), building
length/collation/type/default/nullability, dropped/extra columns, index shape and
ordinary trigger/rule/view/FK dependencies. Rebuilt-index/type cases recapture
identity only; stale-OID replacement remains a distinct case, not shape evidence.
The key_and_opclass case changes both index keys and opclass; it demonstrates
mixed drift, not isolated opclass-predicate rejection. The actual varchar PK
text_ops positive observation and source review remain separate evidence.
No validator pin or business write is permitted. Catalog deparsing may take
transient internal locks; observations concern residual pins after it returns.
The lock observer compares the actual namespace name literally; it never reparses
quoted names as identifiers or trusts the deliberately altered expected schema OID.
READ COMMITTED is not a repeatable database snapshot. Go value snapshots do not
promise safety for unsynchronized concurrent mutation of caller-owned values.

Local Go/gofmt and PG execution are unavailable; no local execution PASS is claimed.
Independent final source/test/composition review and exact-head PG17 ordinary/race
CI remain required. Audit full raw JSON for all named cases, terminal and package
PASS, and zero unexpected skips/failures. Existing ci.yml supplies both databases;
no runner/workflow changes. TestPGQueuePhysicalRestart remains explicitly excluded.
No existing restricted fixture was identified. Actual INSERT/USAGE denial and
role/OWNER/ACL/RLS/policy negatives remain source-reviewed, not executed; wrong
expected identities are not permission-denial evidence. No security mutations,
installs, production, enrollment, constructor/Pin, Hub publication, full fresh-chain
or process-restart acceptance is included. Historical holds remain unchanged.
