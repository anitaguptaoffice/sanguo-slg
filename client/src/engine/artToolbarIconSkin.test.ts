import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { mountToolbarIcons, TOOLBAR_ICON_BY_ACTION } from "@/engine/artToolbarIconSkin";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getImageForAsset: vi.fn((id: string) =>
      id.startsWith("ui.icon.toolbar.")
        ? {
            img,
            meta: { id, display_size: { w: 32, h: 32 } },
            scale: 1 as const,
          }
        : undefined,
    ),
  } as unknown as AssetLoader;
}

describe("mountToolbarIcons", () => {
  it("maps eight toolbar actions to two-character labels and icon nodes", () => {
    expect(Object.keys(TOOLBAR_ICON_BY_ACTION)).toHaveLength(8);
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="toggle-military">军事</button>
        <button type="button" data-action="toggle-mail"><span class="toolbar-btn-label">邮件</span></button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    const military = root.querySelector('[data-action="toggle-military"]')!;
    expect(military.querySelector(".toolbar-btn-icon")).toBeTruthy();
    expect(military.querySelector(".toolbar-btn-label")?.textContent).toBe("军事");
    expect(military.getAttribute("aria-label")).toBe("军事");
    const mail = root.querySelector('[data-action="toggle-mail"]')!;
    expect(mail.querySelector(".toolbar-btn-icon")?.getAttribute("src")).toContain("data:image");
  });
});
