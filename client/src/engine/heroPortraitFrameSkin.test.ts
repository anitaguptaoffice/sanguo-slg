import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  HERO_DETAIL_BUST_ROLE,
  HERO_LIST_AVATAR_ROLE,
  heroAvatarAssetId,
  heroBustAssetId,
  mountHeroDetailBust,
  mountHeroListAvatar,
} from "@/engine/heroPortraitFrameSkin";

function mockAssetsForTemplate1001(): AssetLoader {
  const img = { src: "https://example.test/avatar-1001.png" } as HTMLImageElement;
  const bustImg = { src: "https://example.test/bust-1001.png" } as HTMLImageElement;
  const getArtMeta = vi.fn((id: string) => {
    if (id === heroAvatarAssetId(1001)) {
      return {
        id,
        kind: "hero_avatar",
        display_size: { w: 56, h: 56 },
        anchor: { x: 28, y: 48 },
        anchor_unit: "pixels",
      };
    }
    if (id === heroBustAssetId(1001)) {
      return {
        id,
        kind: "hero_bust",
        display_size: { w: 128, h: 160 },
        anchor: { x: 64, y: 152 },
        anchor_unit: "pixels",
      };
    }
    return undefined;
  });
  const getImageForAsset = vi.fn((id: string) => {
    if (id === heroAvatarAssetId(1001)) return { img, meta: getArtMeta(id), scale: 1 as const };
    if (id === heroBustAssetId(1001)) return { img: bustImg, meta: getArtMeta(id), scale: 2 as const };
    return undefined;
  });
  return { getArtMeta, getImageForAsset } as unknown as AssetLoader;
}

describe("heroPortraitFrameSkin", () => {
  it("mounts list avatar before row body when meta and image exist", () => {
    const li = document.createElement("li");
    li.setAttribute("data-hero-id", "3");
    const body = document.createElement("div");
    body.className = "hero-list-row-body";
    li.appendChild(body);
    const panel = document.createElement("div");
    panel.setAttribute("data-center-panel", "hero");

    mountHeroListAvatar(li, 1001, "刘备", mockAssetsForTemplate1001(), panel);
    const avatar = li.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`);
    expect(avatar).toBeTruthy();
    expect(li.firstElementChild).toBe(avatar);
    expect(avatar?.getAttribute("alt")).toBe("刘备");
    expect((avatar as HTMLImageElement).dataset.artTextureScale).toBe("1");
  });

  it("skips img when getArtMeta missing", () => {
    const li = document.createElement("li");
    li.innerHTML = '<div class="hero-list-row-body"></div>';
    const assets = { getArtMeta: vi.fn(() => undefined), getImageForAsset: vi.fn() } as unknown as AssetLoader;
    mountHeroListAvatar(li, 1002, "关羽", assets);
    expect(li.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`)).toBeNull();
  });

  it("skips img when data-art-skin=off on panel ancestor", () => {
    const li = document.createElement("li");
    li.innerHTML = '<div class="hero-list-row-body"></div>';
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    mountHeroListAvatar(li, 1001, "刘备", mockAssetsForTemplate1001(), panel);
    expect(li.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`)).toBeNull();
  });

  it("mounts detail bust before hero-detail-head", () => {
    const detail = document.createElement("div");
    detail.className = "hero-detail";
    detail.innerHTML =
      '<header class="hero-detail-head"><span class="hero-detail-name">刘备</span></header><table class="hero-attr-table"></table>';
    mountHeroDetailBust(detail, 1001, "刘备", mockAssetsForTemplate1001());
    const bust = detail.querySelector(`[data-role="${HERO_DETAIL_BUST_ROLE}"]`);
    expect(bust).toBeTruthy();
    expect(detail.firstElementChild).toBe(bust);
    expect((bust as HTMLImageElement).dataset.artTextureScale).toBe("2");
  });
});
