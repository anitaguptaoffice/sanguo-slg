import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  appendHudProductionRatesLine,
  appendHudResourceStrip,
  CLIENT_032_WIRED_ASSET_IDS,
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

  it("appends production rates secondary line and strip tooltip", () => {
    const hud = document.createElement("div");
    const assets = { getImageForAsset: vi.fn(() => undefined) } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { food: 1 }, assets);
    appendHudProductionRatesLine(hud, { food: 120, wood: 100, iron: 40, stone: 80 });
    const line = hud.querySelector('[data-role="hud-production-rates"]');
    expect(line?.textContent).toContain("粮+120/h");
    const strip = hud.querySelector('[data-role="hud-resources"]');
    expect(strip?.getAttribute("title")).toContain("粮+120/h");
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
