import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { PANEL_ASSET_MILITARY, skinNineSlicePanel } from "@/engine/artPanelSkin";

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
});
