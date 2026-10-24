import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID,
  CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS,
  CLIENT_127_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_CHAIN_TAB_BAR_CLASS,
  DAILY_CHAIN_TAB_CLASS,
  DAILY_CHAIN_TAB_SESSION_KEY,
  DAILY_QUEST_PROGRESS_SECONDARY_CLASS,
  FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MAIL_CLAIM_ALL_ATTACHMENTS_ACTION,
  isFilterListArtSkinOff,
  mountFilterListPanelSkins,
  PANEL_FILTER_CHIP_BAR_CLASS,
  queryFilterChipBar,
  queryFilterListPanelRoot,
} from "@/engine/filterListNarrowManifest";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
} from "@/engine/artPanelSkin";
import { FILTER_CHIP_HIT_MIN } from "@/engine/artUiFilterSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("filterListNarrowManifest (CLIENT-127)", () => {
  it("registers mail daily march battle-report center panels", () => {
    expect(CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS).toEqual([
      "mail",
      "daily",
      "march",
      "battle-report",
    ]);
  });

  it("maps panel roots to nine-slice asset ids", () => {
    expect(CLIENT_127_PANEL_ASSET_BY_CENTER_ID).toEqual({
      mail: PANEL_ASSET_DEFAULT,
      daily: PANEL_ASSET_DAILY,
      march: PANEL_ASSET_MARCH,
      "battle-report": PANEL_ASSET_BATTLE_REPORT,
    });
  });

  it("wires scroll roles and filter chip bar selectors", () => {
    expect(CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID.mail).toBe("mail-scroll");
    expect(CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID.daily).toContain(
      PANEL_FILTER_CHIP_BAR_CLASS,
    );
  });

  it("CLIENT-155 exposes daily quest progress secondary class for narrow manifest", () => {
    expect(DAILY_QUEST_PROGRESS_SECONDARY_CLASS).toBe("daily-quest-row-progress");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`.${DAILY_QUEST_PROGRESS_SECONDARY_CLASS}`);
  });

  it("CLIENT-174 exposes daily quest fine progress bar hooks for narrow manifest", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(".daily-quest-progress");
    expect(html).toContain(".daily-quest-progress-fill");
  });

  it("CLIENT-163 exposes mail claim-all action for batch toolbar manifest", () => {
    expect(MAIL_CLAIM_ALL_ATTACHMENTS_ACTION).toBe("claim-mail-all");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`data-action="${MAIL_CLAIM_ALL_ATTACHMENTS_ACTION}"`);
  });

  it("CLIENT-171 exposes daily chain tab bar hooks for narrow manifest", () => {
    expect(DAILY_CHAIN_TAB_SESSION_KEY).toBe("daily-chain-tab-v1");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DAILY_CHAIN_TAB_BAR_CLASS);
    expect(html).toContain(DAILY_CHAIN_TAB_CLASS);
  });

  it("index.html encodes toolbar clearance and ≥44px chip hits", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`padding-bottom: ${FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX}px`);
    expect(html).toContain(`.${PANEL_FILTER_CHIP_BAR_CLASS}`);
    expect(html).toContain(`min-width: ${FILTER_CHIP_HIT_MIN}px`);
    expect(html).toContain("overflow-y: visible");
  });

  it("queryFilterChipBar finds bar inside panel skeleton", () => {
    const panel = document.createElement("div");
    panel.dataset.centerPanel = "mail";
    panel.innerHTML = `<div class="mail-inbox-toolbar panel-filter-chip-bar"></div>
      <div class="panel-scroll-body" data-role="mail-scroll"></div>`;
    expect(queryFilterListPanelRoot(panel, "mail")).toBe(panel);
    expect(queryFilterChipBar(panel, "mail")).toBeTruthy();
  });

  it("isFilterListArtSkinOff respects panel root data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    expect(isFilterListArtSkinOff(panel)).toBe(true);
  });

  it("mountFilterListPanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    panel.innerHTML = `<button type="button" data-ui-filter-chip>全部</button>`;
    const assets = {
      getImageForAsset: vi.fn(() => ({ img: { src: "/x.png" }, scale: 1 as const })),
      getArtMeta: vi.fn(),
    };
    mountFilterListPanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
