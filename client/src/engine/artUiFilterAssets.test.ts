import { describe, expect, it } from "vitest";
import { ART_UI_FILTER_008_ASSET_IDS } from "@/engine/artUiFilterAssets";

describe("ART_UI_FILTER_008_ASSET_IDS", () => {
  it("lists nine frozen manifest ids", () => {
    expect(ART_UI_FILTER_008_ASSET_IDS).toHaveLength(9);
    expect(ART_UI_FILTER_008_ASSET_IDS).toContain("ui.chip.filter.v1");
    expect(ART_UI_FILTER_008_ASSET_IDS).toContain("ui.badge.count.v1");
  });
});
