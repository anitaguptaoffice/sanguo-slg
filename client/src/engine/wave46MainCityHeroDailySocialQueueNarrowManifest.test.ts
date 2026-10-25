import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_283_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_283_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS,
  mountClient283PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient283PanelRoot,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
  WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave46MainCityHeroDailySocialQueueNarrowManifest";
import { PANEL_ASSET_RANK } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave46MainCityHeroDailySocialQueueNarrowManifest (CLIENT-283)", () => {
  it("registers main-city hero daily social queue panels (not wave:45 world stack)", () => {
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("shop");
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("mail");
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_283_PANEL_ASSET_BY_CENTER_ID.rank).toBe(PANEL_ASSET_RANK);
    expect(CLIENT_283_PANEL_SCROLL_ROLE_BY_CENTER_ID.chat).toBe("chat-scroll");
    expect(
      panelScrollClearsBottomToolbar(
        WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
      ),
    ).toBe(true);
  });

  it("index.html encodes wave:46 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
      DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
      DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
      QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
      DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
      HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
      HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
      RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
      RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
      GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
      GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
      QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
      DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS,
      HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
      HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS,
      "CLIENT-283 wave:46",
      `padding-bottom: ${WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient283PanelRoot finds rank and chat roots", () => {
    const rank = document.createElement("div");
    rank.dataset.centerPanel = "rank";
    expect(queryClient283PanelRoot(rank, "rank")).toBe(rank);

    const chat = document.createElement("div");
    chat.className = "social-panel";
    chat.dataset.centerPanel = "chat";
    expect(queryClient283PanelRoot(chat, "chat")).toBe(chat);
  });

  it("mountClient283PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient283PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
