import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_CATEGORY_TAB_CLASS,
  BAG_CATEGORY_TABS_SELECTOR,
  CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_155_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_155_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_QUEST_PROGRESS_SECONDARY_CLASS,
  HERO_LIST_FILTER_BAR_SELECTOR,
  HUD_RESOURCE_SWEEP_SELECTOR,
  HUD_RESOURCE_STRIP_SELECTOR,
  MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX,
  mountClient155PanelSkins,
  panelScrollClearsBottomToolbar,
  QUEUE_PANEL_OVERVIEW_CLASS,
  QUEUE_PANEL_OVERVIEW_SELECTOR,
  queryClient155PanelRoot,
  RANK_MY_RANK_CHANGED_PULSE_CLASS,
  RANK_PIN_ROW_CLASS,
  RANK_VIEWER_BAR_CLASS,
  SHOP_OFFER_AFFORD_INLINE_CLASS,
  SHOP_TAB_CURRENCY_SWEEP_CLASS,
  SHOP_TAB_CURRENCY_SWEEP_SELECTOR,
} from "@/engine/mainCityWave30NarrowManifest";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
} from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("mainCityWave30NarrowManifest (CLIENT-155)", () => {
  it("registers queue daily hero rank bag shop center panels", () => {
    expect(CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "queue",
      "daily",
      "hero",
      "rank",
      "bag",
      "shop",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_155_PANEL_ASSET_BY_CENTER_ID).toEqual({
      queue: PANEL_ASSET_QUEUE,
      daily: PANEL_ASSET_DAILY,
      hero: PANEL_ASSET_HERO,
      rank: PANEL_ASSET_RANK,
      bag: PANEL_ASSET_BAG,
      shop: PANEL_ASSET_SHOP,
    });
    expect(CLIENT_155_PANEL_SCROLL_ROLE_BY_CENTER_ID.rank).toBe("rank-scroll");
  });

  it("toolbar clearance covers 56px bottom bar", () => {
    expect(panelScrollClearsBottomToolbar(MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX)).toBe(
      true,
    );
  });

  it("index.html encodes HUD sweep, queue overview, rank pin, and wave:30 scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(HUD_RESOURCE_STRIP_SELECTOR.slice(1));
    expect(html).toContain(HUD_RESOURCE_SWEEP_SELECTOR.slice(1));
    expect(html).toContain(QUEUE_PANEL_OVERVIEW_CLASS);
    expect(html).toContain(QUEUE_PANEL_OVERVIEW_SELECTOR);
    expect(html).toContain(RANK_VIEWER_BAR_CLASS);
    expect(html).toContain(RANK_PIN_ROW_CLASS);
    expect(html).toContain(RANK_MY_RANK_CHANGED_PULSE_CLASS);
    expect(html).toContain(HERO_LIST_FILTER_BAR_SELECTOR);
    expect(html).toContain(BAG_CATEGORY_TABS_SELECTOR);
    expect(html).toContain(BAG_CATEGORY_TAB_CLASS);
    expect(html).toContain(SHOP_OFFER_AFFORD_INLINE_CLASS);
    expect(html).toContain(SHOP_TAB_CURRENCY_SWEEP_SELECTOR);
    expect(html).toContain(SHOP_TAB_CURRENCY_SWEEP_CLASS);
    expect(html).toContain(DAILY_QUEST_PROGRESS_SECONDARY_CLASS);
    expect(html).toContain(
      `padding-bottom: ${MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    );
  });

  it("queryClient155PanelRoot finds rank and bag roots", () => {
    const rank = document.createElement("div");
    rank.dataset.centerPanel = "rank";
    expect(queryClient155PanelRoot(rank, "rank")).toBe(rank);

    const bag = document.createElement("div");
    bag.dataset.centerPanel = "bag";
    const wrap = document.createElement("div");
    wrap.append(bag);
    expect(queryClient155PanelRoot(wrap, "bag")).toBe(bag);
  });

  it("mountClient155PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient155PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
