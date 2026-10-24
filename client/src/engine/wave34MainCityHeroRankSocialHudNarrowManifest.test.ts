import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CHAT_UNREAD_SEPARATOR_CLASS,
  CITY_SLOT_PULSE_CLASS,
  CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_187_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_187_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
  GUILD_ROLE_GROUP_HEADER_CLASS,
  HERO_LIST_REFRESH_STAMP_ROLE,
  HERO_LIST_SELECTED_SESSION_KEY,
  HUD_PRODUCTION_WALLET_LINE_ROLE,
  LEADERBOARD_TOP_DENSITY_LINE_CLASS,
  mountClient187PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient187PanelRoot,
  QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
  RECRUIT_SUCCESS_PULSE_CLASS,
  RECRUIT_SUBMITTING_CLASS,
  WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave34MainCityHeroRankSocialHudNarrowManifest";
import { PANEL_ASSET_HERO } from "@/engine/artPanelSkin";
const repoRoot = join(import.meta.dirname, "../..");

describe("wave34MainCityHeroRankSocialHudNarrowManifest (CLIENT-187)", () => {
  it("registers building queue hero rank guild chat daily panels", () => {
    expect(CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
  });

  it("maps assets, scroll roles, and toolbar clearance", () => {
    expect(CLIENT_187_PANEL_ASSET_BY_CENTER_ID.hero).toBe(PANEL_ASSET_HERO);
    expect(CLIENT_187_PANEL_SCROLL_ROLE_BY_CENTER_ID.chat).toBe("chat-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:34 narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      CITY_SLOT_PULSE_CLASS,
      QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
      HUD_PRODUCTION_WALLET_LINE_ROLE,
      HERO_LIST_REFRESH_STAMP_ROLE,
      HERO_LIST_SELECTED_SESSION_KEY,
      RECRUIT_SUBMITTING_CLASS,
      RECRUIT_SUCCESS_PULSE_CLASS,
      LEADERBOARD_TOP_DENSITY_LINE_CLASS,
      GUILD_ROLE_GROUP_HEADER_CLASS,
      CHAT_UNREAD_SEPARATOR_CLASS,
      DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
      "CLIENT-187 wave:34",
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient187PanelRoot resolves building and guild roots", () => {
    const building = document.createElement("aside");
    building.className = "building-panel";
    building.dataset.centerPanel = "building";
    expect(queryClient187PanelRoot(building, "building")).toBe(building);
    const guild = document.createElement("div");
    guild.className = "social-panel";
    guild.dataset.centerPanel = "guild";
    expect(queryClient187PanelRoot(guild, "guild")).toBe(guild);
  });

  it("mountClient187PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient187PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
