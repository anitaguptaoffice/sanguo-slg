# Existing-unit march selection

CLIENT-MARCH-UNIT-SELECTION-001 adds a separate march-unit selector for the four DATA-002 types already recruitable: infantry (1), cavalry (2), archer (3), siege (4). A march still contains one selected troop type. The selected type drives available-garrison validation, reserve/HUD readiness, existing ETA/food previews and the StartMarch troop stack. Infantry remains the default. Unknown selections are rejected; stock from another type cannot satisfy the selected type's requirement.

Existing backend contracts already support these IDs (`StartMarchRequest.troops`, `DefaultUnitCatalog`). No schema, values, mixed formations or backend behavior changes. Response stock reconciliation uses the existing touched-unit merge, including zero-stock removal. Re-march continues to fill coordinates only and show prior troops read-only; it does not silently replace the player's selected troop type or count.

Executable client integration tests call the real scene submit and panel-sync methods with a controlled gateway, plus real markup/snapshot/validation/summary/reserve helpers. They are not a live server or browser end-to-end run. Run `npm test -- src/scenes/marchUnitSelection.test.ts` from client.

## Acceptance hold
Keep the feature Draft until actual browser acceptance at 1280 and 1600 verifies keyboard/mouse unit selection, immediate stock/ETA/error/button updates, scrolling and no overlap, each supported unit's request/response path, and default infantry. Test a resource-only garrison, insufficient selected type, changing selection before submit, and re-march coordinate prefill. CI/unit success does not waive this gate. No production deployment is authorized or claimed.
