# CLIENT-MARCH-FULL-SNAPSHOT-001

Task #2017. Existing ListMarches includes returned history in creation order. The panel,
minimap and arrival poll formerly treated only the first 20 records as a complete snapshot:
a 21st future march disappeared and the arrival poll reported it as vanished.

All three readers now use one complete-page reader. The first request remains limit=20,
then limit=100 (the existing server maximum); offsets advance by requested index spans,
not returned row counts. The API may skip missing Hub snapshots, so an empty/short page
is not an end marker. A fixed validated total bounds each read; a changed total rejects
that read and the next normal refresh retries. Legacy responses without total retain
single-page behavior. GatewayClient's pagination primitive is unchanged.

Pages publish only after success. Session/relogin/server changes reject remaining reads;
callers retain their city/lifecycle/watermark guards. A failed panel read preserves its
last accepted selection/snapshot and shows the error instead of publishing an empty list.
This is not a transactional server snapshot: phases can evolve while pages are read, and
absence of a Hub row remains the server's existing absence semantics. Reading all history
costs O(total/100) requests; a future active-only server query needs a separate contract.

Regression evidence: actual MarchListPanel loses march 21 on baseline; actual minimap
reader truncates 101 rows. Tests cover both, actual MarchArrivalPoll with production scene
reader, 20/100 boundaries, missing Hub rows, errors, changing totals and session changes.
Existing freshness/arrival/returned tests remain applicable. DOM/mocked-gateway tests are
not real-browser/live gameplay acceptance; required gates are reported on the PR.

#2000 is independently held. This branch starts on main and only changes MainCityScene's
list reading, not #2000's form/unit selection/submit hunks. A local combination check must
confirm clean application and targeted tests, but does not release its browser/live hold;
future changes to either branch require integration revalidation. No deployment.
