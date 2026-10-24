import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
  CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_259_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_259_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  mountClient259PanelSkins,
  panelScrollClearsBottomToolbar,
  prefillMarchFormFromIntelResidual,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION,
  queryClient259PanelRoot,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
  WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS,
} from "@/engine/wave43WorldIntelBattleReportMailShopRankNarrowManifest";
import { PANEL_ASSET_WORLD } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave43WorldIntelBattleReportMailShopRankNarrowManifest (CLIENT-259)", () => {
  it("registers world intel battle report mail shop rank recruit panels (not wave:42 city stack)", () => {
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
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
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_259_PANEL_ASSET_BY_CENTER_ID.world).toBe(PANEL_ASSET_WORLD);
    expect(CLIENT_259_PANEL_SCROLL_ROLE_BY_CENTER_ID.march).toBe("march-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:43 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
      MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS,
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS,
      MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
      BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
      MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
      MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
      BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
      RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS,
      RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
      INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
      INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS,
      PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION,
      "CLIENT-259 wave:43",
      `padding-bottom: ${WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient259PanelRoot finds world and military roots", () => {
    const world = document.createElement("div");
    world.dataset.centerPanel = "world";
    expect(queryClient259PanelRoot(world, "world")).toBe(world);

    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient259PanelRoot(military, "military")).toBe(military);
  });

  it("prefillMarchFormFromIntelResidual tolerates missing sibling hooks", () => {
    expect(
      prefillMarchFormFromIntelResidual(document, { toX: 1, toY: 2, troopsSummary: "—" }),
    ).toBe(false);

    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    const line = document.createElement("div");
    line.className = INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS;
    military.appendChild(line);
    document.body.appendChild(military);

    expect(
      prefillMarchFormFromIntelResidual(document, {
        toX: 10,
        toY: 20,
        troopsSummary: "步兵×100",
      }),
    ).toBe(true);
    expect(line.textContent).toContain("10,20");

    military.remove();
  });

  it("mountClient259PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient259PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
