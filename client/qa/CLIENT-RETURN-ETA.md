# CLIENT-RETURN-ETA

Client-only display repair, based on native march 1 returning after the recorded
200-infantry battle. `return_finish_at_ms=1792990825821` (05:00:25.821 UTC), not
outbound `arrive_at_ms=1792986865817`, drives returning ETA, absolute回城 time and
ETA ordering. Phase 4 is generic返程中; missing/nonpositive/nonfinite return time
is未知 with no outbound fallback. Existing browser-local time formatting and
minute/soon boundary remain; other phases, routes, troops and backend semantics
are unchanged. List/card/recent ETA, military readonly strip and minimap share it.

`marchReturnEta.test.ts` uses the production protobuf schema/adapter/GatewayClient
and row timer with recorded timestamps; it covers all phases, invalid/default
return values, 60-second/deadline boundaries and repeated/stale timestamp updates.
These are deterministic client fixtures, not native backend-return acceptance.
