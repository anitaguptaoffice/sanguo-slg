import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  BADGE_COUNT_ASSET_ID,
  BADGE_DOT_ASSET_ID,
  applyUiCountBadge,
  formatBadgeCount,
  hideCountBadgeElement,
  mountBadgeCount,
  mountBadgeDot,
} from "@/engine/artBadgeSkin";

function mockImg(src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
  const img = document.createElement("img");
  img.src = src;
  return img;
}

function mockAssets(): AssetLoader {
  const getImageForAsset = vi.fn((id: string) =>
    id === BADGE_DOT_ASSET_ID || id === BADGE_COUNT_ASSET_ID
      ? { img: mockImg(`data:image/gif;base64,${id}`), scale: 1 as const }
      : undefined,
  );
  return { getImageForAsset, getArtMeta: vi.fn() } as unknown as AssetLoader;
}

describe("formatBadgeCount", () => {
  it("formats 1–9 and 9+", () => {
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(-1)).toBe("");
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(99)).toBe("9+");
  });
});

describe("applyUiCountBadge hide (#108)", () => {
  it("hides entire element when count is 0 (no empty plate)", () => {
    const el = document.createElement("span");
    el.className = "toolbar-badge";
    el.style.background = "#c45c3a";
    const assets = mockAssets();
    mountBadgeCount(el, assets, 2);
    expect(el.querySelector(".art-badge-count-sprite")).toBeTruthy();

    const visible = applyUiCountBadge(el, 0, { assets });
    expect(visible).toBe(false);
    expect(el.hidden).toBe(true);
    expect(el.classList.contains("hidden")).toBe(true);
    expect(el.textContent).toBe("");
    expect(el.querySelector(".art-badge-count-sprite")).toBeNull();
    expect(el.querySelector(".art-badge-count-label")).toBeNull();
  });

  it("hideCountBadgeElement clears chrome", () => {
    const el = document.createElement("span");
    mountBadgeDot(el, mockAssets());
    hideCountBadgeElement(el);
    expect(el.querySelector(".art-badge-dot-sprite")).toBeNull();
    expect(el.classList.contains("hidden")).toBe(true);
  });
});

describe("mountBadgeCount", () => {
  it("uses 20×16 sprite slot without stretching label", () => {
    const el = document.createElement("span");
    mountBadgeCount(el, mockAssets(), 7);
    const sprite = el.querySelector<HTMLElement>(".art-badge-count-sprite");
    expect(sprite?.style.backgroundImage).toContain(BADGE_COUNT_ASSET_ID);
    expect(el.querySelector(".art-badge-count-label")?.textContent).toBe("7");
    expect(el.classList.contains("art-badge-count--skinned")).toBe(true);
  });

  it("respects data-art-skin=off with CSS digits", () => {
    const el = document.createElement("span");
    el.dataset.artSkin = "off";
    mountBadgeCount(el, mockAssets(), 4);
    expect(el.textContent).toBe("4");
    expect(el.querySelector(".art-badge-count-sprite")).toBeNull();
  });
});
