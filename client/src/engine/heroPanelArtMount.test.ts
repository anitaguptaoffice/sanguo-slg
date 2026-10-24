import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { PANEL_ASSET_HERO } from "@/engine/artPanelSkin";
import { PANEL_STATE_CHROME_CLASS } from "@/engine/panelStateChrome";
import {
  HERO_PANEL_ART_PANEL_ATTR,
  HERO_PANEL_ART_PLACEHOLDER_ATTR,
  HERO_PANEL_SHELL_ASSET_ID,
  mountHeroPanelArtShell,
  mountHeroPanelArtRuntime,
  resolveHeroPanelArtMount,
  skimHeroPanelStateChrome,
} from "@/engine/heroPanelArtMount";

function mockAssets(ready = true): AssetLoader {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return {
    getImageForAsset: vi.fn(() => (ready ? { img, scale: 1 as const } : null)),
    getArtMeta: vi.fn(() =>
      ready
        ? {
            id: PANEL_ASSET_HERO,
            nine_slice: { top: 24, right: 24, bottom: 24, left: 24 },
            variants: [],
          }
        : null,
    ),
  } as unknown as AssetLoader;
}

describe("resolveHeroPanelArtMount (CLIENT-230)", () => {
  it("returns skinned when manifest nine_slice is ready", () => {
    const root = document.createElement("div");
    const plan = resolveHeroPanelArtMount(root, mockAssets(true));
    expect(plan).toEqual({ assetId: HERO_PANEL_SHELL_ASSET_ID, mode: "skinned" });
  });

  it("returns placeholder when data-art-skin=off", () => {
    const root = document.createElement("div");
    root.dataset.artSkin = "off";
    const plan = resolveHeroPanelArtMount(root, mockAssets(true));
    expect(plan.mode).toBe("placeholder");
    expect(plan.assetId).toBe(HERO_PANEL_SHELL_ASSET_ID);
  });

  it("returns placeholder when assets lack hero panel pack", () => {
    const root = document.createElement("div");
    const plan = resolveHeroPanelArtMount(root, mockAssets(false));
    expect(plan.mode).toBe("placeholder");
  });
});

describe("mountHeroPanelArtShell", () => {
  it("stamps data-art-panel and applies border-image when skinned", () => {
    const root = document.createElement("div");
    root.dataset.centerPanel = "hero";
    mountHeroPanelArtShell(root, mockAssets(true));
    expect(root.getAttribute(HERO_PANEL_ART_PANEL_ATTR)).toBe(HERO_PANEL_SHELL_ASSET_ID);
    expect(root.hasAttribute(HERO_PANEL_ART_PLACEHOLDER_ATTR)).toBe(false);
    expect(root.style.borderImageSource).toContain("url(");
  });

  it("stamps data-art-panel and placeholder attr when skin off", () => {
    const root = document.createElement("div");
    root.dataset.artSkin = "off";
    mountHeroPanelArtShell(root, mockAssets(true));
    expect(root.getAttribute(HERO_PANEL_ART_PANEL_ATTR)).toBe(HERO_PANEL_SHELL_ASSET_ID);
    expect(root.getAttribute(HERO_PANEL_ART_PLACEHOLDER_ATTR)).toBe("1");
    expect(root.style.borderImageSource).toBe("");
  });
});

describe("skimHeroPanelStateChrome", () => {
  it("applies data-panel-state skin on list placeholder rows", () => {
    const root = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-panel-state", "loading");
    li.classList.add(PANEL_STATE_CHROME_CLASS);
    li.textContent = "加载中…";
    root.appendChild(li);
    skimHeroPanelStateChrome(root, mockAssets(true));
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(true);
  });

  it("skims hero-detail loading chrome paragraphs", () => {
    const root = document.createElement("div");
    const detail = document.createElement("div");
    detail.className = "hero-detail";
    detail.innerHTML =
      '<p class="panel-state-chrome panel-state-loading hero-detail-empty" data-role="panel-state-chrome" role="status">详情加载中…</p>';
    root.appendChild(detail);
    skimHeroPanelStateChrome(root, mockAssets(true));
    const p = detail.querySelector("p")!;
    expect(p.getAttribute("data-panel-state")).toBe("loading");
  });
});

describe("mountHeroPanelArtRuntime", () => {
  it("mounts shell and skims existing panel-state nodes", () => {
    const root = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-panel-state", "empty");
    li.classList.add(PANEL_STATE_CHROME_CLASS);
    li.textContent = "尚无将领";
    root.appendChild(li);
    mountHeroPanelArtRuntime(root, mockAssets(true));
    expect(root.getAttribute(HERO_PANEL_ART_PANEL_ATTR)).toBe(HERO_PANEL_SHELL_ASSET_ID);
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(true);
  });
});
