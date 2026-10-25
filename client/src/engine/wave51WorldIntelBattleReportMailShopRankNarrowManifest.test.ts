import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS,
  CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_323_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_323_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS,
  mountClient323PanelSkins,
  panelScrollClearsBottomToolbar,
  prefillMarchFormFromIntelResidualDeepestDeeper,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_ACTION,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPER_ACTION,
  queryClient323PanelRoot,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_RING_CLASS,
  WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_CLASS,
} from "@/engine/wave51WorldIntelBattleReportMailShopRankNarrowManifest";
import { PANEL_ASSET_WORLD } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave51WorldIntelBattleReportMailShopRankNarrowManifest (CLIENT-322 / CLIENT-323)", () => {
  it("registers world intel battle report mail shop rank panels (not wave:50 city stack)", () => {
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
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
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_323_PANEL_ASSET_BY_CENTER_ID.world).toBe(PANEL_ASSET_WORLD);
    expect(CLIENT_323_PANEL_SCROLL_ROLE_BY_CENTER_ID.march).toBe("march-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:51 narrow chrome and scroll clearance for CLIENT-322 intel deepest-deeper", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS,
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_CLASS,
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS,
      MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS,
      MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS,
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_RING_CLASS,
      BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
      BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS,
      MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
      MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS,
      MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS,
      MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_CLASS,
      BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
      BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS,
      RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
      RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_LINE_CLASS,
      RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS,
      RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_CLASS,
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS,
      INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
      INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_CLASS,
      PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPER_ACTION,
      PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_ACTION,
      "CLIENT-323 wave:51",
      `padding-bottom: ${WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient323PanelRoot finds world and military roots", () => {
    const world = document.createElement("div");
    world.dataset.centerPanel = "world";
    expect(queryClient323PanelRoot(world, "world")).toBe(world);

    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient323PanelRoot(military, "military")).toBe(military);
  });

  it("prefillMarchFormFromIntelResidualDeepestDeeper tolerates missing sibling hooks", () => {
    expect(
      prefillMarchFormFromIntelResidualDeepestDeeper(document, { toX: 1, toY: 2, troopsSummary: "—" }),
    ).toBe(false);

    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    const line = document.createElement("div");
    line.className = INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS;
    military.appendChild(line);
    document.body.appendChild(military);

    expect(
      prefillMarchFormFromIntelResidualDeepestDeeper(document, {
        toX: 10,
        toY: 20,
        troopsSummary: "步兵×100",
      }),
    ).toBe(true);
    expect(line.textContent).toContain("10,20");

    military.remove();
  });

  it("mountClient323PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient323PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
