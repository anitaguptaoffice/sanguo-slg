import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_CATEGORY_SCROLL_SESSION_KEY,
  BAG_CATEGORY_TAB_SESSION_KEY,
  BAG_ROW_RETURN_HIGHLIGHT_CLASS,
  BATTLE_REPORT_LIST_STREAK_LINE_CLASS,
  BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS,
  BATTLE_REPORT_TIME_FILTER_SESSION_KEY,
  CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_211_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_211_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  INTEL_ROW_PHASE_SUBLINE_CLASS,
  MAIL_TAB_HUD_SYNC_PULSE_CLASS,
  MAIL_TAB_UNREAD_SWEEP_LINE_CLASS,
  MARCH_FORM_RESERVE_WARN_CLASS,
  MARCH_FORM_TROOP_RESERVE_LINE_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  mountClient211PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient211PanelRoot,
  QUEST_CLAIM_HUD_LINK_LINE_ROLE,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
  WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave37WorldIntelBattleReportMailBagNarrowManifest";
import { PANEL_ASSET_WORLD } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave37WorldIntelBattleReportMailBagNarrowManifest (CLIENT-211)", () => {
  it("registers world march military battle-report mail bag shop panels", () => {
    expect(CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_211_PANEL_ASSET_BY_CENTER_ID.world).toBe(PANEL_ASSET_WORLD);
    expect(CLIENT_211_PANEL_SCROLL_ROLE_BY_CENTER_ID.bag).toBe("bag-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:37 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      MINIMAP_MARCH_STACK_BADGE_CLASS,
      WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
      MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
      INTEL_ROW_PHASE_SUBLINE_CLASS,
      MARCH_FORM_TROOP_RESERVE_LINE_CLASS,
      MARCH_FORM_RESERVE_WARN_CLASS,
      BATTLE_REPORT_TIME_FILTER_SESSION_KEY,
      BATTLE_REPORT_LIST_STREAK_LINE_CLASS,
      BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS,
      MAIL_TAB_UNREAD_SWEEP_LINE_CLASS,
      MAIL_TAB_HUD_SYNC_PULSE_CLASS,
      QUEST_CLAIM_HUD_LINK_LINE_ROLE,
      BAG_CATEGORY_TAB_SESSION_KEY,
      BAG_CATEGORY_SCROLL_SESSION_KEY,
      BAG_ROW_RETURN_HIGHLIGHT_CLASS,
      "CLIENT-211 wave:37",
      `padding-bottom: ${WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient211PanelRoot finds military panel and world center panel", () => {
    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient211PanelRoot(military, "military")).toBe(military);

    const world = document.createElement("div");
    world.dataset.centerPanel = "world";
    const wrap = document.createElement("div");
    wrap.append(world);
    expect(queryClient211PanelRoot(wrap, "world")).toBe(world);
  });

  it("mountClient211PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient211PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
