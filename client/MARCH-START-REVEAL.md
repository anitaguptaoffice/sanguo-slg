# Show the newly started march

A successful StartMarch already opens military intelligence and selects the
new ID. Previously, a remembered Returning phase or another destination could
hide that row even when the complete authoritative snapshot contained it.

The successful handoff now captures the existing one-shot ID-reveal intent.
Only a complete list or minimap snapshot can supply the matching row. That
snapshot clears an incompatible phase and adjusts an incompatible destination,
while retaining compatible filters and the chosen ETA sort. No row is invented
from the submitted target or receipt, and StartMarch is never repeated.

New filter/selection/navigation intent cancels a pending reveal. The existing
actor, session, city, mount and foreground guards also apply. A handoff with
openPanel:false does not request a reveal. Missing targets and failed reads can
be resolved by a later read; after success the reveal is consumed once.
The owned start reveal scrolls its target after the final list render, including
later list/minimap recovery after highlight expiry. It does not repeat on the
next snapshot or add a scroll after cancellation or openPanel:false. Explicit
ID selection keeps its existing behavior. A revision guard also cancels the
final scroll if selection/update callbacks synchronously introduce newer intent.

Regression tests use production MarchListPanel, GatewayClient and protobuf with
strict FIFO controlled transport. The baseline defect also has a production
MainCityScene click/submit witness. This is not live-server or native-browser
acceptance. Existing information-card empty states and decorative handoff
callbacks (including their existing smooth scroll) are unchanged; no server, protocol, workflow or deployment changes.
