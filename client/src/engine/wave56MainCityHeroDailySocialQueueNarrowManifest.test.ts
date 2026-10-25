import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
} from "@/engine/wave56MainCityHeroDailySocialQueueNarrowManifest";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave56MainCityHeroDailySocialQueueNarrowManifest (CLIENT-359)", () => {
  it("exports CLIENT-359 hero panelState and filter chip deepest-deepest-deepest-deeper hooks", () => {
    expect(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS).toBe(
      "hero-panel-state-residual-deepest-deepest-deepest-deeper-sweep",
    );
    expect(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY).toBe(
      "hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-v1",
    );
    expect(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS).toBeTruthy();
    expect(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY).toBeTruthy();
  });

  it("index.html encodes wave:56 hero panelState and filter chip deepest-deepest-deepest-deeper", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
      "CLIENT-359",
    ]) {
      expect(html).toContain(token);
    }
  });
});
