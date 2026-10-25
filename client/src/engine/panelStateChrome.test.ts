import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_STATE_CHROME_CLASS,
  PANEL_STATE_EMPTY_ASSET_ID,
  PANEL_STATE_ERROR_ASSET_ID,
  PANEL_STATE_LOADING_ASSET_ID,
  applyPanelStateChrome,
  isPanelStateArtSkinOff,
  renderPanelStateListRow,
  resolvePanelStateSkin,
} from "@/engine/panelStateChrome";

function mockImg() {
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return img;
}

function mockPanelStateAssets(): AssetLoader {
  const ids = [PANEL_STATE_LOADING_ASSET_ID, PANEL_STATE_EMPTY_ASSET_ID, PANEL_STATE_ERROR_ASSET_ID];
  const getImageForAsset = vi.fn((id: string) =>
    ids.includes(id)
      ? { img: mockImg(), meta: { id, display_size: { w: 200, h: 48 } }, scale: 1 as const }
      : undefined,
  );
  const getArtMeta = vi.fn((id: string) =>
    ids.includes(id)
      ? {
          id,
          nine_slice: { top: 8, right: 8, bottom: 8, left: 8 },
        }
      : undefined,
  );
  return { getImageForAsset, getArtMeta } as unknown as AssetLoader;
}

describe("resolvePanelStateSkin", () => {
  it("maps loading/empty/error to CLIENT-128 asset ids", () => {
    expect(resolvePanelStateSkin("loading")).toBe(PANEL_STATE_LOADING_ASSET_ID);
    expect(resolvePanelStateSkin("empty")).toBe(PANEL_STATE_EMPTY_ASSET_ID);
    expect(resolvePanelStateSkin("error")).toBe(PANEL_STATE_ERROR_ASSET_ID);
  });
});

describe("applyPanelStateChrome", () => {
  it("sets data-panel-state and skins when manifest assets exist", () => {
    const li = document.createElement("li");
    applyPanelStateChrome(li, "loading", mockPanelStateAssets());
    expect(li.getAttribute("data-panel-state")).toBe("loading");
    expect(li.classList.contains(PANEL_STATE_CHROME_CLASS)).toBe(true);
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(true);
    expect(li.style.borderImageSource).toContain("url(");
    expect(li.style.borderImageSlice).not.toContain("fill");
    expect(li.style.backgroundColor).toBe("rgb(247, 238, 217)");
    expect(li.style.color).toBe("rgb(59, 43, 27)");
    expect(li.textContent).toBe("");
  });

  it("skips nine-slice when data-art-skin=off", () => {
    const wrap = document.createElement("div");
    wrap.dataset.artSkin = "off";
    const li = document.createElement("li");
    wrap.appendChild(li);
    applyPanelStateChrome(li, "error", mockPanelStateAssets());
    expect(li.getAttribute("data-panel-state")).toBe("error");
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(false);
    expect(isPanelStateArtSkinOff(li)).toBe(true);
  });

  it("updates error ink and removes owned skin styles when switched off", () => {
    const li = document.createElement("li");
    const assets = mockPanelStateAssets();
    applyPanelStateChrome(li, "empty", assets);
    applyPanelStateChrome(li, "error", assets);
    expect(li.style.color).toBe("rgb(139, 48, 41)");
    li.dataset.artSkin = "off";
    applyPanelStateChrome(li, "loading", assets);
    expect(li.dataset.panelState).toBe("loading");
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(false);
    expect(li.style.borderImageSource).toBe("");
    expect(li.style.background).toBe("");
    expect(li.style.color).toBe("");
  });

  it("clears stale skin when an asset becomes unavailable", () => {
    const li = document.createElement("li");
    applyPanelStateChrome(li, "loading", mockPanelStateAssets());
    applyPanelStateChrome(li, "empty");
    expect(li.style.borderImageSlice).toBe("");
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(false);
  });

  it("falls back to text-only when assets missing", () => {
    const li = document.createElement("li");
    const assets = {
      getImageForAsset: vi.fn(() => undefined),
      getArtMeta: vi.fn(() => undefined),
    } as unknown as AssetLoader;
    applyPanelStateChrome(li, "empty", assets);
    expect(li.getAttribute("data-panel-state")).toBe("empty");
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(false);
  });
});

describe("renderPanelStateListRow", () => {
  it("respects a list ancestor skin-off before applying the generated row", () => {
    const ul = document.createElement("ul");
    ul.dataset.artSkin = "off";
    const li = renderPanelStateListRow(ul, "empty", "暂无数据", { assets: mockPanelStateAssets() });
    expect(li.style.borderImageSource).toBe("");
    expect(li.classList.contains("panel-state-chrome--skinned")).toBe(false);
    expect(li.textContent).toBe("暂无数据");
  });
  it("preserves legacy list classes for panelDensity hooks", () => {
    const ul = document.createElement("ul");
    const li = renderPanelStateListRow(ul, "empty", "暂无数据", {
      legacyClass: "mail-empty",
    });
    expect(ul.children[0]).toBe(li);
    expect(li.classList.contains("mail-empty")).toBe(true);
    expect(li.getAttribute("data-panel-state")).toBe("empty");
  });
});
