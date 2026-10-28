# Explicit recruit storage entries

SPEC-RECRUIT-STORAGE-ENTRY-001 / #1834. Inputs: #1831 storage rollout and
#1833 exact allocator guard. These files are deployment source, not permission
to execute against a target database, activate durable Recruit, or adopt legacy data.
They are deliberately outside ApplySpecs' top-level `.sql` glob.

Before any authorized target run, independently verify the reviewed release commit
and all three SQL/psql files, including the exact `m4_008` body. The guard frozen by
#1833 has SHA256 `d5c67b53be9eedda7514a4227e7310572b4f2f08f6499c07c8e72e6b0a9cdedc`.
A filename ledger, editable database template, or caller-supplied “verified” flag
is not source identity or provenance. Do not rewrite ledger rows to bypass checks.
Keep externally verified writer, allocator and concurrent-DDL fencing continuously
closed across the entire operation. Table locks do not stop independent `nextval`.
Verify cluster/database/schema/owner, coherent backups and externally retained
identity/highwater evidence separately. Missing evidence blocks target execution.

Use a fresh dedicated PostgreSQL 17 `psql -X` connection, not `\i` inside an existing
transaction. Set the intended application schema/search_path through the approved
connection configuration. Captured `current_schema()` is literal name data: entry
preconditions compare `pg_namespace.nspname::text` under C collation, never reparse
it as an SQL identifier. Mixed-case/quoted targets cannot borrow another schema's
pair or sequence. A missing target pair/sequence must fail before the shared guard
can run its separately intended precreation path. Never include credentials in command history or logs.
Run the selected entry with `-v ON_ERROR_STOP=1 -f <absolute entry path>`; `\ir`
resolves the guard relative to the entry, not the working directory. These are psql
scripts, not SQL strings for Pool.Exec or normal application startup.

- `008_create_recruit_storage.psql` requires both new names absent and the existing
  schema-local sequence already prepared. It validates queue/sequence, creates the
  exact pair, and validates again in one transaction before commit. It never uses
  `IF NOT EXISTS` and refuses repeat creation, partial pairs and name lookalikes.
- `009_audit_recruit_storage.psql` requires an existing pair and sequence, then
  performs the same exact guard independent of migration-ledger state. It never
  creates a missing half or sequence. Maintenance audit is not activation audit.

An error exits psql and closes the connection, rolling back transactional DDL.
Sequence `setval` is not transactional: it may remain advanced after a later
failure. Never lower/recreate it as rollback. Restore requires independently
verified coherent provenance, continuous fences and a fresh forward-only audit.
Retained origin-only IDs reserve namespace but do not establish eligible absence.

Neither entry grants privileges, changes roles/RLS, installs a privileged helper,
or alters `work_queue`. After creation, independently verify actual application
rights before binding. Ledger-present old runners still skip the changed body;
fence incompatible binaries and certify resumed writers separately. Atomic command
participants, role binding, full-cohort/restore evidence, epoch revocation through
commit and crash/restart acceptance remain unresolved activation gates.

The regression script `../tests/recruit_storage_entry.sh` is ONLY for a newly owned,
disposable PG17 database. It creates named test schemas, intentionally mutates its
fixtures and drops those schemas. Never run it against a shared or real database.
