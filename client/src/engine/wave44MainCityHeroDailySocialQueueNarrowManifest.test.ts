import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_267_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_267_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  mountClient267PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient267PanelRoot,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS,
  WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave44MainCityHeroDailySocialQueueNarrowManifest";
import { PANEL_ASSET_RANK } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave44MainCityHeroDailySocialQueueNarrowManifest (CLIENT-267)", () => {
  it("registers main-city hero daily social queue panels (not wave:43 world stack)", () => {
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("shop");
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("mail");
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_267_PANEL_ASSET_BY_CENTER_ID.rank).toBe(PANEL_ASSET_RANK);
    expect(CLIENT_267_PANEL_SCROLL_ROLE_BY_CENTER_ID.chat).toBe("chat-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:44 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
      DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
      QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
      DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
      HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
      HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
      RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS,
      RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
      GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
      GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
      QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
      HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
      "CLIENT-267 wave:44",
      `padding-bottom: ${WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient267PanelRoot finds rank and chat roots", () => {
    const rank = document.createElement("div");
    rank.dataset.centerPanel = "rank";
    expect(queryClient267PanelRoot(rank, "rank")).toBe(rank);

    const chat = document.createElement("div");
    chat.className = "social-panel";
    chat.dataset.centerPanel = "chat";
    expect(queryClient267PanelRoot(chat, "chat")).toBe(chat);
  });

  it("mountClient267PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient267PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
