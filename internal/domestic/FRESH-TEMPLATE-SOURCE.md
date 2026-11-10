# Captured DOM template data methods

Implements only FRESH_CITY_TEMPLATE_CODEC section 7 CaptureTemplate/RestoreTemplate.
Requires the complete reviewed FCT1 codec/audit set and fresh-source constructor.
Capture encodes only the constructor's entire captured catalog. Restore strictly
validates/copies FCT1 and checks every captured BuildingSpec field and cardinality,
including unused entries. Positive player ID is applied to isolated CityState;
it does not affect template bytes. Neither method exposes a catalog capability.

Only immutable captured fields and shared atomic retirement are read. No current
Hub/catalog reads, gate, SQL, Begin, source enrollment, lease, proof or publication.
Pin and the future Prepare own wiring revalidation; illegally changing Hub fields
is not synchronized or made safe by these data methods. Observed retirement
rejects every alias; malformed content/catalog mismatch does not retire a healthy
source. Transaction Commit/Rollback alone is not source retirement. APP closing,
poison and unresolved drain remain APP obligations, not this data port's authority.
No error string or successful parse authorizes a durable terminal classification.

ValidateFreshTemplateContent remains pure and independent of current capture.
History/result/duplicate reads require APP's retained manifest and complete bytes,
not Restore. Only actual effects require matching constructor catalog, lease and
Prepare before effect Begin. Unknown semantic labels need APP manifest refusal;
these methods validate syntax only. Old bytes are never repaired or relabeled.

Private unit fixtures prove bounded data behavior, not real construction. The
separate PG companion calls the actual constructor on owned fixtures and is a
joint merge gate with source and CI. Full ordinary/race/official CI and independent
final-head review remain required. Prepare is absent on the baseline and unchanged;
APP history/manifest, WORLD storage, full chain/restart and activation remain open.
No deployment, permission changes, legacy reference/art/VERIFY hold or #2426 bypass.
