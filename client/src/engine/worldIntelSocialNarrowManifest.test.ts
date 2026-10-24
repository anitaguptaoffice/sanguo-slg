import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_145_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID,
  CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_145_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_145_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  mountClient145PanelSkins,
  panelScrollClearsBottomToolbar,
  resolveWorldMinimapExpandedLayoutRect,
  WORLD_INTEL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
} from "@/engine/worldIntelSocialNarrowManifest";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_CHAT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_RANK,
} from "@/engine/artPanelSkin";
import { MINIMAP_LAYOUT_RECT } from "@/ui/worldMinimap";

const repoRoot = join(import.meta.dirname, "../..");

describe("worldIntelSocialNarrowManifest (CLIENT-145)", () => {
  it("registers panel ids, assets, and scroll roles", () => {
    expect(CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "march",
      "battle-report",
      "rank",
      "guild",
      "chat",
    ]);
    expect(CLIENT_145_PANEL_ASSET_BY_CENTER_ID.march).toBe(PANEL_ASSET_MARCH);
    expect(CLIENT_145_PANEL_ASSET_BY_CENTER_ID.chat).toBe(PANEL_ASSET_CHAT);
    expect(CLIENT_145_PANEL_SCROLL_ROLE_BY_CENTER_ID.chat).toBe("chat-scroll");
  });

  it("expands minimap layout rect at narrow viewport", () => {
    expect(resolveWorldMinimapExpandedLayoutRect(false)).toEqual(MINIMAP_LAYOUT_RECT);
    expect(resolveWorldMinimapExpandedLayoutRect(true)).toEqual(
      WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
    );
    expect(WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT.w).toBeGreaterThan(MINIMAP_LAYOUT_RECT.w);
  });

  it("toolbar clearance covers 56px bottom bar", () => {
    expect(panelScrollClearsBottomToolbar(WORLD_INTEL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX)).toBe(
      true,
    );
  });

  it("index.html encodes CLIENT-145 scroll clearance and list roving focus slack", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`padding-bottom: ${WORLD_INTEL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX}px`);
    expect(html).toContain(CLIENT_145_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID.march);
    expect(html).toContain("march-list li[data-march-id]:focus-visible");
    expect(html).toContain("battle-report-list li[data-report-id]:focus-visible");
  });

  it("mountClient145PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient145PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
