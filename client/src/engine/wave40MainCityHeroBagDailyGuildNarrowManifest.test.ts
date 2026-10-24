import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BAG_USE_CONSUMABLE_PULSE_CLASS,
  BAG_USE_ECONOMY_ERROR_LINE_CLASS,
  CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_235_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_235_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  DOMESTIC_SLOT_RETURN_RING_CLASS,
  DOMESTIC_SLOT_SCROLL_SESSION_KEY,
  GUILD_CHAT_UNREAD_SEPARATOR_CLASS,
  GUILD_ROLE_GROUP_HEADER_LINE_ROLE,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_PANEL_ART_MOUNT_ATTR,
  HERO_PANEL_ART_MOUNT_ID,
  mountClient235PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient235PanelRoot,
  QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
  resolveHeroPanelArtMount,
  WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave40MainCityHeroBagDailyGuildNarrowManifest";
import { PANEL_ASSET_BAG } from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave40MainCityHeroBagDailyGuildNarrowManifest (CLIENT-235)", () => {
  it("registers main-city queue hero bag daily guild panels", () => {
    expect(CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "bag",
      "daily",
      "guild",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_235_PANEL_ASSET_BY_CENTER_ID.bag).toBe(PANEL_ASSET_BAG);
    expect(CLIENT_235_PANEL_SCROLL_ROLE_BY_CENTER_ID.daily).toBe("daily-scroll");
    expect(
      panelScrollClearsBottomToolbar(WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:40 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    for (const token of [
      DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
      DOMESTIC_SLOT_RETURN_RING_CLASS,
      DOMESTIC_SLOT_SCROLL_SESSION_KEY,
      HERO_PANEL_ART_MOUNT_ATTR,
      HERO_PANEL_ART_MOUNT_ID,
      HERO_LIST_RETURN_HIGHLIGHT_CLASS,
      HERO_LIST_FILTER_SESSION_KEY,
      BAG_USE_CONSUMABLE_PULSE_CLASS,
      BAG_USE_ECONOMY_ERROR_LINE_CLASS,
      QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE,
      QUEST_CLAIM_PROGRESS_PULSE_CLASS,
      GUILD_ROLE_GROUP_HEADER_LINE_ROLE,
      GUILD_CHAT_UNREAD_SEPARATOR_CLASS,
      "CLIENT-235 wave:40",
      `padding-bottom: ${WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    ]) {
      expect(html).toContain(token);
    }
  });

  it("queryClient235PanelRoot finds bag and guild roots", () => {
    const bag = document.createElement("div");
    bag.dataset.centerPanel = "bag";
    expect(queryClient235PanelRoot(bag, "bag")).toBe(bag);

    const guild = document.createElement("div");
    guild.className = "social-panel";
    guild.dataset.centerPanel = "guild";
    expect(queryClient235PanelRoot(guild, "guild")).toBe(guild);
  });

  it("resolveHeroPanelArtMount respects data-art-panel and skin-off", () => {
    const hero = document.createElement("div");
    hero.setAttribute(HERO_PANEL_ART_MOUNT_ATTR, HERO_PANEL_ART_MOUNT_ID);
    expect(resolveHeroPanelArtMount(hero)).toBe(true);

    hero.dataset.artSkin = "off";
    expect(resolveHeroPanelArtMount(hero)).toBe(false);
  });

  it("mountClient235PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient235PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
