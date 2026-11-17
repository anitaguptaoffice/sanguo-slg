# Manual march destination filter

CLIENT-MARCH-FILTER-VALIDATION-001 rejects empty/partly empty, fractional and out-of-map manual coordinates before applying the local march-list filter. Both coordinates must be integers in 0..WORLD_MAP_EDGE-1, matching the existing march form and world map. Zero remains valid.

Invalid input produces a status message without replacing the current destination filter, list results or typed values; players can correct and apply it again. All/world selection modes and valid manual filtering are unchanged. No additional RPC, march submission or server mutation is performed. DOM click regressions cover this behavior; no browser/deployment acceptance is claimed.
