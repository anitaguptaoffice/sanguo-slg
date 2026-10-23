import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { HUD_BAR_ASSET, skinHudBar, wrapToolbarButtonsForHit } from "@/engine/artChromeSkin";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getImageForAsset: vi.fn(() => ({ img, scale: 1 as const })),
    getArtMeta: vi.fn(() => ({
      id: HUD_BAR_ASSET,
      display_size: { w: 1600, h: 56 },
    })),
  } as unknown as AssetLoader;
}

describe("artChromeSkin", () => {
  it("skins HUD bar full width at 56 layout px", () => {
    const hud = document.createElement("div");
    skinHudBar(hud, mockAssets());
    expect(hud.classList.contains("art-chrome-hud")).toBe(true);
    expect(hud.style.backgroundSize).toBe("100% 56px");
    expect(hud.style.backgroundImage).toContain("url(");
  });

  it("wraps toolbar buttons for hit slop", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="toolbar-scroll-inner"><button type="button">A</button></div>`;
    wrapToolbarButtonsForHit(root);
    const hit = root.querySelector(".toolbar-btn-hit");
    expect(hit?.querySelector("button")).toBeTruthy();
  });
});
