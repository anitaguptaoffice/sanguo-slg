import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  CLIENT_062_CENTER_PANEL_ASSET_IDS,
  CLIENT_070_PANEL_ASSET_BY_CENTER_ID,
  PANEL_ASSET_BAG,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_MILITARY,
  PANEL_ASSET_QUEUE,
  skinBagPanel,
  skinDailyPanel,
  skinHeroPanel,
  skinMailPanel,
  skinMilitaryPanel,
  skinNineSlicePanel,
  skinQueuePanel,
} from "@/engine/artPanelSkin";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getImageForAsset: vi.fn(() => ({ img, scale: 1 as const })),
    getArtMeta: vi.fn(() => ({
      id: "ui.panel.default.v1",
      nine_slice: { top: 24, right: 24, bottom: 24, left: 24 },
      variants: [],
    })),
  } as unknown as AssetLoader;
}

describe("skinNineSlicePanel", () => {
  it("applies border-image when asset and nine_slice exist", () => {
    const el = document.createElement("div");
    skinNineSlicePanel(el, mockAssets());
    expect(el.style.borderImageSource).toContain("url(");
    expect(el.style.background).toBe("transparent");
  });

  it("skips when data-art-skin=off", () => {
    const el = document.createElement("div");
    el.dataset.artSkin = "off";
    skinNineSlicePanel(el, mockAssets());
    expect(el.style.borderImageSource).toBe("");
  });

  it("requests military panel asset when passed", () => {
    const el = document.createElement("div");
    const assets = mockAssets();
    skinNineSlicePanel(el, assets, 420, 320, PANEL_ASSET_MILITARY);
    expect(assets.getImageForAsset).toHaveBeenCalledWith(PANEL_ASSET_MILITARY);
  });

  it("skinMilitaryPanel delegates to military asset id", () => {
    const el = document.createElement("div");
    const assets = mockAssets();
    skinMilitaryPanel(el, assets);
    expect(assets.getArtMeta).toHaveBeenCalledWith(PANEL_ASSET_MILITARY);
    expect(el.style.borderImageSource).toContain("url(");
  });

  it("lists CLIENT-062 center panel manifest ids", () => {
    expect(CLIENT_062_CENTER_PANEL_ASSET_IDS).toEqual([
      PANEL_ASSET_HERO,
      PANEL_ASSET_BAG,
      PANEL_ASSET_QUEUE,
    ]);
  });

  it("skinHeroBagQueuePanel use dedicated asset ids", () => {
    const assets = mockAssets();
    const hero = document.createElement("div");
    const bag = document.createElement("div");
    const queue = document.createElement("div");
    skinHeroPanel(hero, assets);
    skinBagPanel(bag, assets);
    skinQueuePanel(queue, assets);
    expect(assets.getImageForAsset).toHaveBeenCalledWith(PANEL_ASSET_HERO);
    expect(assets.getImageForAsset).toHaveBeenCalledWith(PANEL_ASSET_BAG);
    expect(assets.getImageForAsset).toHaveBeenCalledWith(PANEL_ASSET_QUEUE);
  });

  it("CLIENT-070 maps military mail daily roots to manifest ids", () => {
    expect(CLIENT_070_PANEL_ASSET_BY_CENTER_ID).toEqual({
      military: PANEL_ASSET_MILITARY,
      mail: PANEL_ASSET_DEFAULT,
      daily: PANEL_ASSET_DEFAULT,
    });
  });

  it("skinMailPanel and skinDailyPanel use default panel asset", () => {
    const assets = mockAssets();
    const mail = document.createElement("div");
    const daily = document.createElement("div");
    skinMailPanel(mail, assets);
    skinDailyPanel(daily, assets);
    expect(assets.getImageForAsset).toHaveBeenCalledWith(PANEL_ASSET_DEFAULT);
  });
});
