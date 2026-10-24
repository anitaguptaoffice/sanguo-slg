import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_ITEM_CFG_SUMMARY_CLASS,
  BAG_OPEN_SOURCE_TAG_CLASS,
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_OUTCOME_SUMMARY_CLASS,
  BATTLE_REPORT_ROW_SUMMARY_CLASS,
  CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_179_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_179_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_QUEST_PROGRESS_BAR_CLASS,
  DAILY_QUEST_REWARD_LINE_CLASS,
  MAIL_ATTACHMENT_SWEEP_CLASS,
  MAIL_TAB_EMPTY_HINT_CLASS,
  MARCH_FORM_READONLY_STRIP_CLASS,
  MARCH_INFO_CARD_CLASS,
  MARCH_OPEN_MILITARY_FROM_INTEL_ACTION,
  MARCH_ROW_SELECTED_CLASS,
  MARCH_VIEW_INTEL_CARD_ACTION,
  mountClient179PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient179PanelRoot,
  WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
} from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave33IntelBattleMailBagDailyNarrowManifest (CLIENT-179)", () => {
  it("registers march battle-report mail bag daily military panels", () => {
    expect(CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "march",
      "battle-report",
      "mail",
      "bag",
      "daily",
      "military",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_179_PANEL_ASSET_BY_CENTER_ID).toEqual({
      march: PANEL_ASSET_MARCH,
      "battle-report": PANEL_ASSET_BATTLE_REPORT,
      mail: PANEL_ASSET_DEFAULT,
      bag: PANEL_ASSET_BAG,
      daily: PANEL_ASSET_DAILY,
      military: PANEL_ASSET_MILITARY,
    });
    expect(CLIENT_179_PANEL_SCROLL_ROLE_BY_CENTER_ID.bag).toBe("bag-scroll");
    expect(CLIENT_179_PANEL_SCROLL_ROLE_BY_CENTER_ID.military).toBe("military-scroll");
  });

  it("toolbar clearance covers 56px bottom bar", () => {
    expect(
      panelScrollClearsBottomToolbar(WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:33 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MARCH_INFO_CARD_CLASS);
    expect(html).toContain(MARCH_ROW_SELECTED_CLASS);
    expect(html).toContain(BATTLE_REPORT_OUTCOME_SUMMARY_CLASS);
    expect(html).toContain(BATTLE_REPORT_ROW_SUMMARY_CLASS);
    expect(html).toContain(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY);
    expect(html).toContain(MAIL_TAB_EMPTY_HINT_CLASS);
    expect(html).toContain(MAIL_ATTACHMENT_SWEEP_CLASS);
    expect(html).toContain(BAG_ITEM_CFG_SUMMARY_CLASS);
    expect(html).toContain(BAG_OPEN_SOURCE_TAG_CLASS);
    expect(html).toContain(DAILY_QUEST_PROGRESS_BAR_CLASS);
    expect(html).toContain(DAILY_QUEST_REWARD_LINE_CLASS);
    expect(html).toContain(MARCH_FORM_READONLY_STRIP_CLASS);
    expect(html).toContain(MARCH_VIEW_INTEL_CARD_ACTION);
    expect(html).toContain(MARCH_OPEN_MILITARY_FROM_INTEL_ACTION);
    expect(html).toContain(
      `padding-bottom: ${WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    );
  });

  it("queryClient179PanelRoot finds military panel and march center panel", () => {
    const military = document.createElement("aside");
    military.className = "military-panel";
    military.dataset.centerPanel = "military";
    expect(queryClient179PanelRoot(military, "military")).toBe(military);

    const march = document.createElement("div");
    march.dataset.centerPanel = "march";
    const wrap = document.createElement("div");
    wrap.append(march);
    expect(queryClient179PanelRoot(wrap, "march")).toBe(march);
  });

  it("mountClient179PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient179PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
