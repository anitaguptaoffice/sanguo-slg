// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
} from "@/engine/wave37MinimapMarchStackNarrowManifest";

describe("wave37MinimapMarchStackNarrowManifest (CLIENT-204)", () => {
  it("exports minimap stack badge and tile march summary hooks", () => {
    expect(MINIMAP_MARCH_STACK_BADGE_CLASS).toBe("minimap-march-stack-badge");
    expect(WORLD_TILE_MARCH_SUMMARY_LINE_CLASS).toBe("world-tile-march-summary-line");
  });
});
