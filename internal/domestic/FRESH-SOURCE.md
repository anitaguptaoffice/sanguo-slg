# Fresh DOM source binding and relation pins

Implements only FRESH_CITY_PARTICIPANTS §5 constructor and both Pin methods.
No Prepare, wallet initialization, stage/proof, publication or live caller exists.
APP must construct Binding from the same captured pool used by its existing
SupportsAtomicCityCreation(pool, shard) check. DOM cannot inspect Binding.pool;
matching database metadata or checking the Hub's own pool is not correspondence.
Constructor validates the full eight-object catalog using its private Access copy.
It retains copied expectations/catalog and exact Hub/store/pool/shard, not startup
transaction lifetime. APP discards all participants if startup validation/end fails.

W/C/B mean exact own-backend RowExclusive locks on wallet/checkpoint/building.
Only {}, W, WC and WCB are supported prefixes. City pins require W; missing C then
B are acquired in order. Reentry only revalidates already-held pins. AccessShare
does not count; other modes/order refuse without retirement. Observed pins do not
prove chronology, actor authorization, other domains, admission or enrollment.
APP serializes methods within a command and owns all global ordering/transaction
ending. Different transactions can share participant copies without phase leakage.

Definite metadata/wiring drift retires every copy irreversibly. Operational/access,
order, timeout and cancellation errors do not. Every call revalidates full source
and checks wiring, including reentry. Retirement is not completed drain or proof
that already-admitted transactions ended. Partial failure requires caller cleanup.
Hub/store/catalog remain startup-immutable: atomic retirement does not synchronize
concurrent ordinary-field/map changes. No Pin waits for/re-enters the Hub mutex.

Source and full PG companion are a common independent-review/ordinary/race/CI gate.
Scratch Go 1.23.2 compile/pure tests are not PG, activation or restart acceptance.
No permission-negative coverage, runtime role/ACL/OWNER/RLS/DDL repair or hold
adoption is included. FCT1 and later DOM business lifecycle remain separate work.
