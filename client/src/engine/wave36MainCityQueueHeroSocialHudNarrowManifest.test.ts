import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_203_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_203_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  GUILD_CHAT_EMPTY_ERROR_ROW_CLASS,
  GUILD_CHAT_RETRY_INLINE_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  HERO_GROWTH_COMPARE_STRIP_CLASS,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_LIST_RETURN_SESSION_KEY,
  HERO_UPGRADE_PROGRESS_BAR_CLASS,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  mountClient203PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient203PanelRoot,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
  RECRUIT_FORM_INLINE_HINT_CLASS,
  WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";
import { PANEL_ASSET_QUEUE } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave36MainCityQueueHeroSocialHudNarrowManifest (CLIENT-203)", () => {
  it("registers building queue hero guild chat panels", () => {
    expect(CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "guild",
      "chat",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_203_PANEL_ASSET_BY_CENTER_ID.queue).toBe(PANEL_ASSET_QUEUE);
    expect(CLIENT_203_PANEL_SCROLL_ROLE_BY_CENTER_ID.hero).toBe("hero-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:36 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      QUEUE_ROW_ETA_LINE_CLASS,
      QUEUE_ROW_PROGRESS_BAR_CLASS,
      CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
      QUEUE_ROW_COMPLETE_PULSE_CLASS,
      HERO_GROWTH_COMPARE_STRIP_CLASS,
      HERO_UPGRADE_PROGRESS_BAR_CLASS,
      HERO_LIST_RETURN_HIGHLIGHT_CLASS,
      HERO_LIST_RETURN_SESSION_KEY,
      GUILD_CHAT_EMPTY_ERROR_ROW_CLASS,
      GUILD_CHAT_RETRY_INLINE_CLASS,
      GUILD_CHAT_BACKOFF_RETRY_CLASS,
      GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
      RECRUIT_FORM_INLINE_HINT_CLASS,
      HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
      CENTER_PANEL_TAB_PULSE_CLASS,
      "CLIENT-203 wave:36",
      `padding-bottom: ${WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient203PanelRoot finds queue and chat roots", () => {
    const queue = document.createElement("div");
    queue.dataset.centerPanel = "queue";
    expect(queryClient203PanelRoot(queue, "queue")).toBe(queue);

    const chat = document.createElement("div");
    chat.className = "social-panel";
    chat.dataset.centerPanel = "chat";
    expect(queryClient203PanelRoot(chat, "chat")).toBe(chat);
  });

  it("mountClient203PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient203PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
