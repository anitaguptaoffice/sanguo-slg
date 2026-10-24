import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_ROW_INLINE_STATE_CLASS,
  BAG_USE_INLINE_PULSE_CLASS,
  BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS,
  BATTLE_REPORT_OUTCOME_BAND_CLASS,
  BATTLE_REPORT_REPLAY_SESSION_KEY,
  CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_195_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_195_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_CLAIMABLE_SWEEP_LINE_ROLE,
  DAILY_CLAIM_PROGRESS_PULSE_CLASS,
  HUD_TODO_SWEEP_LINE_ROLE,
  MAIL_CLAIM_INLINE_PULSE_CLASS,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_BATTLE_REPLAY_PULSE_CLASS,
  MINIMAP_FOCUS_PULSE_CLASS,
  MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
  mountClient195PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient195PanelRoot,
  SHOP_PRICE_WALLET_GAP_LINE_CLASS,
  WORLD_TILE_INFO_CARD_CLASS,
  WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave35WorldIntelBattleReportMailDailyNarrowManifest";
import { PANEL_ASSET_WORLD } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave35WorldIntelBattleReportMailDailyNarrowManifest (CLIENT-195)", () => {
  it("registers world march military battle-report mail daily bag shop panels", () => {
    expect(CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "daily",
      "bag",
      "shop",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_195_PANEL_ASSET_BY_CENTER_ID.world).toBe(PANEL_ASSET_WORLD);
    expect(CLIENT_195_PANEL_SCROLL_ROLE_BY_CENTER_ID.shop).toBe("shop-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:35 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      WORLD_TILE_INFO_CARD_CLASS,
      MINIMAP_FOCUS_PULSE_CLASS,
      MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
      MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
      BATTLE_REPORT_OUTCOME_BAND_CLASS,
      BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS,
      BATTLE_REPORT_REPLAY_SESSION_KEY,
      MINIMAP_BATTLE_REPLAY_PULSE_CLASS,
      MAIL_CLAIM_INLINE_PULSE_CLASS,
      DAILY_CLAIMABLE_SWEEP_LINE_ROLE,
      DAILY_CLAIM_PROGRESS_PULSE_CLASS,
      HUD_TODO_SWEEP_LINE_ROLE,
      BAG_ROW_INLINE_STATE_CLASS,
      BAG_USE_INLINE_PULSE_CLASS,
      SHOP_PRICE_WALLET_GAP_LINE_CLASS,
      "CLIENT-195 wave:35",
      `padding-bottom: ${WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient195PanelRoot finds military panel and world center panel", () => {
    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient195PanelRoot(military, "military")).toBe(military);

    const world = document.createElement("div");
    world.dataset.centerPanel = "world";
    const wrap = document.createElement("div");
    wrap.append(world);
    expect(queryClient195PanelRoot(wrap, "world")).toBe(world);
  });

  it("mountClient195PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient195PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
