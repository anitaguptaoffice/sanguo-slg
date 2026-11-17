# Pure FCT1 data codec

Implements the adopted `spec/rules/FRESH_CITY_TEMPLATE_CODEC.md` byte grammar.
`FreshTemplateVersions`, `FreshTemplateContent` and
`ValidateFreshTemplateContent` are the only new public surfaces in this module.
Validation returns only an error. It does not authenticate actors, approve a
semantic tuple, consult any Hub/current catalog, acquire a gate or issue SQL.
APP must match its independently retained manifest tuple and complete bytes on
all loads, including PENDING discovery, duplicates and terminal history.

Private encode/decode cover every building and every catalog record, preserve
fixed fresh-state invariants, enforce bounds before variable allocation, reject
noncanonical data, verify metadata/SHA-256 and require exact re-encoding.
The existing snapshot validator supplies all CityState/catalog semantic bounds.
No new gameplay caps, Unicode normalization, catalog fallback or default lookup
are introduced. Decode reconstructs non-nil maps, nil jobs and isolated values.
Callers must prevent concurrent mutation of inputs during capture/validation.
No error string is authorization for a durable terminal rejection.

This complete pure codec is not CaptureTemplate, RestoreTemplate or Prepare.
Future participant methods require the separately reviewed lifecycle constructor
and its immutable captured catalog. Restore must compare every captured catalog
field only for actual PENDING execution. Prepare's signature remains unchanged.
WORLD retention, APP manifest/startup/ending logic and PG/process recovery are
separate dependencies; no business creation path or source is activated here.

The source contract tests, canonical/independent-parser audit and hostile/fuzz
companions form one acceptance set. Do not merge any member before every final
component and their combination pass independent review and required CI.
