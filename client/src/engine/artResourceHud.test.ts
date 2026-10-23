import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  appendHudResourceStrip,
  CLIENT_032_WIRED_ASSET_IDS,
  wireHudResourceSweep,
} from "@/engine/artResourceHud";

describe("appendHudResourceStrip", () => {
  it("lists CLIENT-032 wired manifest asset ids", () => {
    expect(CLIENT_032_WIRED_ASSET_IDS).toEqual([
      "res.icon.food.v1",
      "res.icon.wood.v1",
      "res.icon.stone.v1",
      "res.icon.iron.v1",
      "ui.panel.default.v1",
    ]);
  });

  it("uses img icons when assets resolve", () => {
    const hud = document.createElement("div");
    const img = document.createElement("img");
    const assets = {
      getImageForAsset: vi.fn((id: string) =>
        id.startsWith("res.icon.") ? { img, meta: {}, scale: 1 as const } : undefined,
      ),
    } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { food: 100, wood: 2, iron: 3, stone: 4, gold: 9 }, assets);
    const strip = hud.querySelector('[data-role="hud-resources"]');
    expect(strip).toBeTruthy();
    expect(strip?.querySelectorAll("img.hud-resource-icon").length).toBe(4);
    expect(strip?.textContent).toContain("9");
    expect(strip?.textContent).toMatch(/币/);
  });

  it("wires resource sweep on hover/focus and omits permanent production row", () => {
    const hud = document.createElement("div");
    const assets = { getImageForAsset: vi.fn(() => undefined) } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { food: 100, wood: 2000 }, assets, { food: 120, wood: 100, iron: 40, stone: 80 });
    expect(hud.querySelector('[data-role="hud-production-rates"]')).toBeNull();
    const strip = hud.querySelector('[data-role="hud-resources"]') as HTMLElement;
    const sweep = strip.querySelector('[data-role="hud-resource-sweep"]');
    expect(sweep?.textContent).toContain("粮 100 +120/h");
    expect(strip.getAttribute("title")).toContain("木 2,000 +100/h");
    expect(strip.tabIndex).toBe(0);
  });

  it("degrades sweep to balances when production_rates missing", () => {
    const strip = document.createElement("span");
    wireHudResourceSweep(strip, undefined, { food: 50, wood: 1 });
    expect(strip.querySelector('[data-role="hud-resource-sweep"]')?.textContent).toBe(
      "粮 50 · 木 1 · 铁 0 · 石 0",
    );
  });

  it("falls back to label text when icons missing", () => {
    const hud = document.createElement("div");
    const assets = { getImageForAsset: vi.fn(() => undefined) } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { food: 1, gold: 2 }, assets);
    const strip = hud.querySelector('[data-role="hud-resources"]');
    expect(strip?.querySelector("img")).toBeNull();
    expect(strip?.textContent).toContain("粮 1");
    expect(strip?.textContent).toContain("币 2");
  });
});
