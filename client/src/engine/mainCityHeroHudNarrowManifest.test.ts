import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_135_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_135_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  layoutBoxClearOfBottomToolbar,
  MAIN_CITY_HERO_HUD_BOTTOM_CLEARANCE_PX,
  MAIN_CITY_SLOT_OVERLAY_LAYER_SELECTOR,
  mountClient135PanelSkins,
  narrowHudChromeVerticalBounds,
  PANEL_STATE_CHROME_SELECTOR,
  QUEUE_SLOT_MATRIX_SELECTOR,
  queryClient135PanelRoot,
} from "@/engine/mainCityHeroHudNarrowManifest";
import { LAYOUT_FRAME, TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
} from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("mainCityHeroHudNarrowManifest (CLIENT-135)", () => {
  it("registers building queue hero center panels", () => {
    expect(CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual(["building", "queue", "hero"]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_135_PANEL_ASSET_BY_CENTER_ID).toEqual({
      building: PANEL_ASSET_DEFAULT,
      queue: PANEL_ASSET_QUEUE,
      hero: PANEL_ASSET_HERO,
    });
    expect(CLIENT_135_PANEL_SCROLL_ROLE_BY_CENTER_ID.queue).toBe("queue-scroll");
  });

  it("layoutBoxClearOfBottomToolbar respects 56px toolbar", () => {
    const maxBottom = LAYOUT_FRAME.h - TOOLBAR_HEIGHT;
    expect(layoutBoxClearOfBottomToolbar(maxBottom)).toBe(true);
    expect(layoutBoxClearOfBottomToolbar(maxBottom + 1)).toBe(false);
    expect(narrowHudChromeVerticalBounds().stageBottom).toBe(maxBottom);
  });

  it("index.html encodes slot overlay, queue matrix, panel-state, and toolbar clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MAIN_CITY_SLOT_OVERLAY_LAYER_SELECTOR.slice(1));
    expect(html).toContain(QUEUE_SLOT_MATRIX_SELECTOR);
    expect(html).toContain(PANEL_STATE_CHROME_SELECTOR);
    expect(html).toContain(`padding-bottom: ${MAIN_CITY_HERO_HUD_BOTTOM_CLEARANCE_PX}px`);
  });

  it("queryClient135PanelRoot finds building and hero roots", () => {
    const building = document.createElement("div");
    building.className = "building-panel";
    building.dataset.centerPanel = "building";
    expect(queryClient135PanelRoot(building, "building")).toBe(building);

    const hero = document.createElement("div");
    hero.dataset.centerPanel = "hero";
    const wrap = document.createElement("div");
    wrap.append(hero);
    expect(queryClient135PanelRoot(wrap, "hero")).toBe(hero);
  });

  it("mountClient135PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient135PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
