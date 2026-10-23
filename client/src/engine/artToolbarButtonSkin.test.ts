import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinToolbarButtons } from "@/engine/artToolbarButtonSkin";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const states = ["normal", "hover", "pressed", "disabled"] as const;
  return {
    getButtonImage: vi.fn((_id: string, state: string) =>
      states.includes(state as (typeof states)[number]) ? { img, scale: 1 as const } : null,
    ),
    getArtMeta: vi.fn(() => ({
      id: "ui.button.toolbar.v1",
      display_size: { w: 96, h: 44 },
    })),
  } as unknown as AssetLoader;
}

describe("skinToolbarButtons", () => {
  it("keeps 96×44 layout draw size for toolbar chrome", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="toolbar-scroll-inner"><button type="button">军事</button></div>`;
    skinToolbarButtons(root, mockAssets());
    const btn = root.querySelector("button")!;
    expect(btn.style.height).toBe("44px");
    expect(btn.style.backgroundSize).toBe("96px 44px");
  });
});
