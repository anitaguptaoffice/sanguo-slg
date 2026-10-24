import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS,
  CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_243_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_243_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  COPY_REPORT_COORDS_READONLY_ACTION,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  mountClient243PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient243PanelRoot,
  RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
} from "@/engine/wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest";
import { PANEL_ASSET_SHOP } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest (CLIENT-243)", () => {
  it("registers world intel battle report mail shop rank recruit panels", () => {
    expect(CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_243_PANEL_ASSET_BY_CENTER_ID.shop).toBe(PANEL_ASSET_SHOP);
    expect(CLIENT_243_PANEL_SCROLL_ROLE_BY_CENTER_ID.rank).toBe("rank-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:41 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
      MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
      WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
      MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
      MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
      REPORT_LIST_DENSITY_ROW_CLASS,
      REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
      BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS,
      COPY_REPORT_COORDS_READONLY_ACTION,
      MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
      MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
      MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
      BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
      RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS,
      RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS,
      "CLIENT-243 wave:41",
      `padding-bottom: ${WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient243PanelRoot finds shop and military roots", () => {
    const shop = document.createElement("div");
    shop.dataset.centerPanel = "shop";
    expect(queryClient243PanelRoot(shop, "shop")).toBe(shop);

    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient243PanelRoot(military, "military")).toBe(military);
  });

  it("mountClient243PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient243PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
