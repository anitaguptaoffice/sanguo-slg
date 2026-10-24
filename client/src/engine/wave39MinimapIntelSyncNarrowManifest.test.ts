import { describe, expect, it } from "vitest";
import {
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
} from "@/engine/wave39MinimapIntelSyncNarrowManifest";

describe("wave39MinimapIntelSyncNarrowManifest (CLIENT-220)", () => {
  it("exports minimap intel sync hook class names", () => {
    expect(MINIMAP_INTEL_SYNC_RING_CLASS).toBe("minimap-intel-sync-ring");
    expect(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS).toBe(
      "intel-row-minimap-sync-highlight",
    );
  });
});
