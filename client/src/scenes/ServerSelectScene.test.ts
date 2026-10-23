import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { SceneContext } from "@/engine/SceneManager";
import { ServerSelectScene } from "@/scenes/ServerSelectScene";

function mockAssets(): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getImageForAsset: vi.fn(() => ({ img, scale: 1 as const })),
    getButtonImage: vi.fn(() => ({ img, scale: 1 as const })),
    getArtMeta: vi.fn(() => ({
      id: "ui.panel.default.v1",
      display_size: { w: 560, h: 360 },
    })),
  } as unknown as AssetLoader;
}

describe("ServerSelectScene", () => {
  it("opens dialog with focus trap and dismisses with Escape to HUD trigger", async () => {
    const layoutFrame = document.createElement("div");
    const hud = document.createElement("div");
    document.body.append(layoutFrame, hud);

    const gateway = {
      connect: vi.fn(async () => {}),
      listGameServers: vi.fn(async () => ({
        servers: [{ server_id: 1, display_name: "S1", status: 1, online_count: 0, has_player: false }],
      })),
    };

    const scene = new ServerSelectScene();
    const ctx: SceneContext = {
      canvas: document.createElement("canvas"),
      hud,
      layoutFrame,
      gateway: gateway as SceneContext["gateway"],
      assets: mockAssets(),
      getViewport: () => ({ uiScale: 1, offsetX: 0, offsetY: 0, width: 1600, height: 900 }),
      switchScene: vi.fn(),
    };

    await scene.enter(ctx);

    const panel = layoutFrame.querySelector(".server-select-panel") as HTMLElement;
    const trigger = hud.querySelector<HTMLButtonElement>('[data-role="server-select-trigger"]');
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.classList.contains("hidden")).toBe(false);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panel.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    trigger?.click();
    expect(panel.classList.contains("hidden")).toBe(false);

    scene.leave();
    layoutFrame.remove();
    hud.remove();
  });
});
