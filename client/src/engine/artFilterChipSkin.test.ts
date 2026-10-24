import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinFilterChips } from "@/engine/artFilterChipSkin";
import {
  ART_FILTER_CHIP_HIT_MIN,
  ART_FILTER_CHIP_VISUAL_H,
  ART_FILTER_CHIP_VISUAL_W,
  ART_UI_FILTER_CHIP_NORMAL,
} from "@/engine/artUiFilterAssets";

function mockAssets(): AssetLoader {
  const img = { src: "data:image/png;base64,chip" } as HTMLImageElement;
  return {
    getImageForAsset: vi.fn(() => ({ img, meta: { id: ART_UI_FILTER_CHIP_NORMAL }, scale: 1 })),
    getArtMeta: vi.fn(() => ({
      id: ART_UI_FILTER_CHIP_NORMAL,
      display_size: { w: ART_FILTER_CHIP_VISUAL_W, h: ART_FILTER_CHIP_VISUAL_H },
    })),
  } as unknown as AssetLoader;
}

describe("skinFilterChips", () => {
  it("wraps chip in ≥44px hit box while visual stays 72×32", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" class="mail-filter-btn art-filter-chip">全部</button>`;
    const btn = root.querySelector("button")!;
    skinFilterChips(root, mockAssets());
    const wrap = btn.parentElement;
    expect(wrap?.classList.contains("art-filter-chip-hit")).toBe(true);
    expect(btn.style.width).toBe(`${ART_FILTER_CHIP_VISUAL_W}px`);
    expect(btn.style.height).toBe(`${ART_FILTER_CHIP_VISUAL_H}px`);
    expect(parseInt(wrap?.style.minWidth || "0", 10)).toBeGreaterThanOrEqual(ART_FILTER_CHIP_HIT_MIN);
    expect(parseInt(wrap?.style.minHeight || "0", 10)).toBeGreaterThanOrEqual(ART_FILTER_CHIP_HIT_MIN);
  });

  it("uses selected sprite when .selected is set", () => {
    const assets = mockAssets();
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" class="mail-filter-btn art-filter-chip selected">未读</button>`;
    skinFilterChips(root, assets);
    expect(assets.getImageForAsset).toHaveBeenCalled();
  });
});
