import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_219_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_219_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_ROLE,
  HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LOYALTY_WARN_DOT_CLASS,
  HUD_TODO_MERGED_SWEEP_CLASS,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  mountClient219PanelSkins,
  panelScrollClearsBottomToolbar,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
  queryClient219PanelRoot,
  RANK_EMPTY_RETRY_INLINE_CLASS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  RANK_REFRESH_COOLDOWN_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_ROLE,
  RECRUIT_WALLET_COMPARE_LINE_CLASS,
  SHOP_WALLET_COMPARE_LINE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave38MainCityHeroSocialQueueNarrowManifest";
import { PANEL_ASSET_RANK } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave38MainCityHeroSocialQueueNarrowManifest (CLIENT-219)", () => {
  it("registers main-city hero rank social queue daily shop panels", () => {
    expect(CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
      "shop",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_219_PANEL_ASSET_BY_CENTER_ID.rank).toBe(PANEL_ASSET_RANK);
    expect(CLIENT_219_PANEL_SCROLL_ROLE_BY_CENTER_ID.daily).toBe("daily-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:38 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
      DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
      HERO_LIST_LOYALTY_SUBLINE_CLASS,
      "hero-list-loyalty-subline",
      HERO_LOYALTY_WARN_DOT_CLASS,
      HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS,
      RANK_REFRESH_COOLDOWN_STAMP_CLASS,
      RANK_REFRESH_COOLDOWN_STAMP_ROLE,
      RANK_MANUAL_REFRESH_SESSION_KEY,
      RANK_EMPTY_RETRY_INLINE_CLASS,
      RECRUIT_WALLET_COMPARE_LINE_CLASS,
      SHOP_WALLET_COMPARE_LINE_CLASS,
      HUD_TODO_MERGED_SWEEP_CLASS,
      HUD_TODO_MERGED_SWEEP_LINE_ROLE,
      TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
      GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
      GUILD_MEMBER_ONLINE_SUMMARY_ROLE,
      GUILD_CHAT_BACKOFF_RETRY_CLASS,
      DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
      QUEUE_NEXT_FINISH_PREVIEW_CLASS,
      QUEUE_NEXT_FINISH_PREVIEW_ACTION,
      HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
      CENTER_PANEL_TAB_PULSE_CLASS,
      "CLIENT-219 wave:38",
      `padding-bottom: ${WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient219PanelRoot finds rank and guild roots", () => {
    const rank = document.createElement("div");
    rank.dataset.centerPanel = "rank";
    expect(queryClient219PanelRoot(rank, "rank")).toBe(rank);

    const guild = document.createElement("div");
    guild.className = "social-panel";
    guild.dataset.centerPanel = "guild";
    expect(queryClient219PanelRoot(guild, "guild")).toBe(guild);
  });

  it("mountClient219PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient219PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
