import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BUILD_UPGRADE_COST_LINE_CLASS,
  BUILD_UPGRADE_COST_LINE_SELECTOR,
  CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_171_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_171_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_CHAIN_TAB_BAR_CLASS,
  DAILY_CHAIN_TAB_BAR_SELECTOR,
  DAILY_CHAIN_TAB_CLASS,
  DAILY_CHAIN_TAB_SESSION_KEY,
  HERO_UPGRADE_ITEM_GAP_SELECTOR,
  mountClient171PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient171PanelRoot,
  QUEUE_REMAINING_PROGRESS_CLASS,
  QUEUE_REMAINING_PROGRESS_SELECTOR,
  RANK_OPEN_HERO_DETAIL_ACTION,
  RANK_OPEN_HERO_DETAIL_SELECTOR,
  RECRUIT_COST_DEFICIT_CLASS,
  RECRUIT_SCROLL_ANCHOR_SESSION_KEY,
  RECRUIT_SUBMITTING_CLASS,
  RECRUIT_SUCCESS_PULSE_CLASS,
  RECRUIT_WALLET_SWEEP_SECONDARY_CLASS,
  RESOURCE_DEFICIT_CLASS,
  SHOP_PRICE_VS_WALLET_CLASS,
  SHOP_TAB_CURRENCY_SWEEP_CLASS,
  SHOP_TAB_CURRENCY_SWEEP_SELECTOR,
  WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_TILE_FOCUS_PULSE_CLASS,
  WORLD_TILE_INFO_SELECTOR,
} from "@/engine/wave32MainCityBuildHeroShopDailyWorldNarrowManifest";
import {
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave32MainCityBuildHeroShopDailyWorldNarrowManifest (CLIENT-171)", () => {
  it("registers building queue hero shop daily rank world panels", () => {
    expect(CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "shop",
      "daily",
      "rank",
      "world",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_171_PANEL_ASSET_BY_CENTER_ID).toEqual({
      building: PANEL_ASSET_DEFAULT,
      queue: PANEL_ASSET_QUEUE,
      hero: PANEL_ASSET_HERO,
      shop: PANEL_ASSET_SHOP,
      daily: PANEL_ASSET_DAILY,
      rank: PANEL_ASSET_RANK,
      world: PANEL_ASSET_WORLD,
    });
    expect(CLIENT_171_PANEL_SCROLL_ROLE_BY_CENTER_ID.world).toBe("world-scroll");
  });

  it("toolbar clearance covers 56px bottom bar", () => {
    expect(
      panelScrollClearsBottomToolbar(WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:32 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(RESOURCE_DEFICIT_CLASS);
    expect(html).toContain(BUILD_UPGRADE_COST_LINE_CLASS);
    expect(html).toContain(BUILD_UPGRADE_COST_LINE_SELECTOR.slice(1));
    expect(html).toContain(QUEUE_REMAINING_PROGRESS_CLASS);
    expect(html).toContain(QUEUE_REMAINING_PROGRESS_SELECTOR.slice(1));
    expect(html).toContain(HERO_UPGRADE_ITEM_GAP_SELECTOR);
    expect(html).toContain(RECRUIT_WALLET_SWEEP_SECONDARY_CLASS);
    expect(html).toContain(RECRUIT_SCROLL_ANCHOR_SESSION_KEY);
    expect(html).toContain(RECRUIT_COST_DEFICIT_CLASS);
    expect(html).toContain(RECRUIT_SUBMITTING_CLASS);
    expect(html).toContain(RECRUIT_SUCCESS_PULSE_CLASS);
    expect(html).toContain(SHOP_TAB_CURRENCY_SWEEP_CLASS);
    expect(html).toContain(SHOP_PRICE_VS_WALLET_CLASS);
    expect(html).toContain(RANK_OPEN_HERO_DETAIL_ACTION);
    expect(html).toContain(DAILY_CHAIN_TAB_BAR_CLASS);
    expect(html).toContain(DAILY_CHAIN_TAB_CLASS);
    expect(html).toContain(DAILY_CHAIN_TAB_SESSION_KEY);
    expect(html).toContain(WORLD_TILE_FOCUS_PULSE_CLASS);
    expect(html).toContain(WORLD_TILE_INFO_SELECTOR);
    expect(html).toContain(
      `padding-bottom: ${WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    );
    expect(html).toContain(RANK_OPEN_HERO_DETAIL_SELECTOR);
    expect(html).toContain(SHOP_TAB_CURRENCY_SWEEP_SELECTOR);
    expect(html).toContain(DAILY_CHAIN_TAB_BAR_SELECTOR.slice(1));
  });

  it("queryClient171PanelRoot finds building sidebar and shop center panel", () => {
    const building = document.createElement("aside");
    building.className = "building-panel";
    building.dataset.centerPanel = "building";
    expect(queryClient171PanelRoot(building, "building")).toBe(building);

    const shop = document.createElement("div");
    shop.dataset.centerPanel = "shop";
    const wrap = document.createElement("div");
    wrap.append(shop);
    expect(queryClient171PanelRoot(wrap, "shop")).toBe(shop);
  });

  it("mountClient171PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient171PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
