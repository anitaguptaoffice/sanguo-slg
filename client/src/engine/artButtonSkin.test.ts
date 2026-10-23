import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getButtonImage: vi.fn(() => ({ img, scale: 1 as const })),
    getArtMeta: vi.fn(() => ({
      id: "ui.button.primary.v1",
      display_size: { w: 160, h: 48 },
    })),
  } as unknown as AssetLoader;
}

describe("skinPrimaryButtons", () => {
  it("applies frozen 160×48 min size for art-btn-primary-full", () => {
    const root = document.createElement("div");
    const btn = document.createElement("button");
    btn.className = "art-btn-primary art-btn-primary-full";
    btn.textContent = "募兵";
    root.appendChild(btn);
    skinPrimaryButtons(root, mockAssets());
    expect(btn.style.minWidth).toBe("160px");
    expect(btn.style.width).toBe("160px");
    expect(btn.style.minHeight).toBe("48px");
    expect(btn.style.backgroundImage).toContain("url(");
  });

  it("does not force full width on toolbar-sized primaries", () => {
    const root = document.createElement("div");
    const btn = document.createElement("button");
    btn.className = "art-btn-primary";
    root.appendChild(btn);
    skinPrimaryButtons(root, mockAssets());
    expect(btn.style.minWidth).toBe("");
    expect(btn.style.minHeight).toBe("48px");
  });
});
