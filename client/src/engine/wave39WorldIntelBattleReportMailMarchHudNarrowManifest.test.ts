import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_227_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_227_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  HUD_MILITARY_TODO_PULSE_CLASS,
  HUD_MILITARY_TODO_SWEEP_CLASS,
  HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
  INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  mountClient227PanelSkins,
  OPEN_INTEL_FOR_REPORT_ACTION,
  panelScrollClearsBottomToolbar,
  queryClient227PanelRoot,
  REPORT_LIST_INTEL_JUMP_TAG_CLASS,
  REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
  WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave39WorldIntelBattleReportMailMarchHudNarrowManifest";
import { PANEL_ASSET_MARCH } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave39WorldIntelBattleReportMailMarchHudNarrowManifest (CLIENT-227)", () => {
  it("registers world march military battle-report mail panels", () => {
    expect(CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_227_PANEL_ASSET_BY_CENTER_ID.march).toBe(PANEL_ASSET_MARCH);
    expect(CLIENT_227_PANEL_SCROLL_ROLE_BY_CENTER_ID.mail).toBe("mail-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:39 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      MINIMAP_INTEL_SYNC_RING_CLASS,
      INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
      INTEL_PHASE_CHANGE_FLASH_CLASS,
      INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
      MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS,
      REPORT_LIST_INTEL_JUMP_TAG_CLASS,
      REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
      OPEN_INTEL_FOR_REPORT_ACTION,
      MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS,
      REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
      HUD_MILITARY_TODO_SWEEP_CLASS,
      HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
      HUD_MILITARY_TODO_PULSE_CLASS,
      "CLIENT-227 wave:39",
      `padding-bottom: ${WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient227PanelRoot finds military panel and march center panel", () => {
    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient227PanelRoot(military, "military")).toBe(military);

    const march = document.createElement("div");
    march.dataset.centerPanel = "march";
    const wrap = document.createElement("div");
    wrap.append(march);
    expect(queryClient227PanelRoot(wrap, "march")).toBe(march);
  });

  it("mountClient227PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient227PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
