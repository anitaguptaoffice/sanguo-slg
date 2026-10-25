import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { ArtManifestV1 } from "@/engine/artManifest";
import {
  ART_UI_FILTER_008_ASSET_IDS,
  BADGE_COUNT_ASSET_ID,
  BADGE_DOT_ASSET_ID,
  CHIP_FILTER_ASSET_BY_STATE,
  FILTER_CHIP_HIT_MIN,
  formatFilterBadgeCount,
  mountFilterBadgeCount,
  mountFilterBadgeDot,
  applyFilterChipVisualState,
  mountFilterChip,
  mountFilterChips,
  mountFilterRow,
  mountFilterUiSkins,
  resolveFilterChipPack,
  resolveFilterRowAssetId,
  ROW_FILTER_ASSET_BY_STATE,
} from "@/engine/artUiFilterSkin";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = join(repoRoot, "client/public/assets/art/v1/manifest.json");

function loadManifest(): ArtManifestV1 {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ArtManifestV1;
}

function mockImg(src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
  const img = document.createElement("img");
  img.src = src;
  return img;
}

function mockAssets(): AssetLoader {
  const getImageForAsset = vi.fn((id: string) =>
    (ART_UI_FILTER_008_ASSET_IDS as readonly string[]).includes(id)
      ? {
          img: mockImg(`data:image/gif;base64,${id}`),
          meta: { id, display_size: { w: 72, h: 32 } },
          scale: 1 as const,
        }
      : undefined,
  );
  const getArtMeta = vi.fn((id: string) => {
    if (id.startsWith("ui.list.row.")) {
      return {
        id,
        nine_slice: { left: 8, top: 8, right: 8, bottom: 8 },
        display_size: { w: 440, h: 40 },
      };
    }
    if (id === BADGE_DOT_ASSET_ID) return { id, display_size: { w: 16, h: 16 } };
    if (id === BADGE_COUNT_ASSET_ID) return { id, display_size: { w: 20, h: 16 } };
    if (id.startsWith("ui.chip.filter.")) return { id, display_size: { w: 72, h: 32 } };
    return undefined;
  });
  return { getImageForAsset, getArtMeta } as unknown as AssetLoader;
}

describe("ART-UI-FILTER-008 manifest mount", () => {
  it("lists nine asset ids (61 total manifest entries)", () => {
    const manifest = loadManifest();
    expect(ART_UI_FILTER_008_ASSET_IDS).toHaveLength(9);
    expect(manifest.assets).toHaveLength(115);
    for (const id of ART_UI_FILTER_008_ASSET_IDS) {
      expect(manifest.assets.some((a) => a.id === id)).toBe(true);
    }
  });

  it("maps chip and row states to frozen asset ids", () => {
    expect(Object.keys(CHIP_FILTER_ASSET_BY_STATE)).toEqual([
      "normal",
      "hover",
      "pressed",
      "selected",
    ]);
    expect(Object.keys(ROW_FILTER_ASSET_BY_STATE)).toEqual(["default", "hover", "selected"]);
    expect(CHIP_FILTER_ASSET_BY_STATE.selected).toBe("ui.chip.filter.selected.v1");
    expect(ROW_FILTER_ASSET_BY_STATE.selected).toBe("ui.list.row.selected.v1");
  });
});

describe("formatFilterBadgeCount", () => {
  it("formats 1–9 and 9+", () => {
    expect(formatFilterBadgeCount(0)).toBe("");
    expect(formatFilterBadgeCount(1)).toBe("1");
    expect(formatFilterBadgeCount(9)).toBe("9");
    expect(formatFilterBadgeCount(10)).toBe("9+");
    expect(formatFilterBadgeCount(99)).toBe("9+");
  });
});

describe("resolveFilterChipPack", () => {
  it("loads variant per chip state", () => {
    const assets = mockAssets();
    const pressed = resolveFilterChipPack(assets, "pressed");
    expect(pressed?.img.src).toContain("ui.chip.filter.pressed.v1");
    expect(assets.getImageForAsset).toHaveBeenCalledWith("ui.chip.filter.pressed.v1");
  });
});

describe("mountFilterChip", () => {
  it("applies four-state sprite wiring and ≥44px hit class", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-ui-filter-chip>全部</button>`;
    const btn = root.querySelector("button")!;
    mountFilterChip(btn, mockAssets());
    expect(btn.classList.contains("art-filter-chip")).toBe(true);
    expect(btn.classList.contains("art-filter-chip--skinned")).toBe(true);
    expect(btn.querySelector(".art-filter-chip-sprite")).toBeTruthy();
    expect(btn.querySelector(".art-filter-chip-label")?.textContent).toBe("全部");
    const indexHtml = readFileSync(join(repoRoot, "client/index.html"), "utf8");
    expect(indexHtml).toContain(`min-width: ${FILTER_CHIP_HIT_MIN}px`);
    expect(indexHtml).toContain(`min-height: ${FILTER_CHIP_HIT_MIN}px`);
  });

  it("skips skin when data-art-skin=off", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    btn.dataset.artSkin = "off";
    btn.textContent = "未读";
    mountFilterChip(btn, mockAssets());
    expect(btn.querySelector(".art-filter-chip-sprite")).toBeNull();
    expect(btn.classList.contains("art-filter-chip--skinned")).toBe(false);
  });

  it("uses selected asset when aria-pressed", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "筛选";
    mountFilterChip(btn, mockAssets());
    const sprite = btn.querySelector<HTMLElement>(".art-filter-chip-sprite");
    expect(sprite?.dataset.filterChipState).toBe("selected");
  });

  it("uses selected asset when aria-current", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    btn.setAttribute("aria-current", "true");
    btn.textContent = "筛选";
    mountFilterChip(btn, mockAssets());
    const sprite = btn.querySelector<HTMLElement>(".art-filter-chip-sprite");
    expect(sprite?.dataset.filterChipState).toBe("selected");
  });
});

describe("mountFilterRow", () => {
  it("nine-slices default and selected row assets", () => {
    const row = document.createElement("li");
    row.dataset.uiFilterRow = "";
    const title = document.createElement("span");
    title.className = "mail-row-title";
    title.textContent = "标题";
    const summary = document.createElement("span");
    summary.className = "mail-row-summary";
    summary.textContent = "摘要";
    row.append(title, summary);
    mountFilterRow(row, mockAssets());
    const bar = row.querySelector(".art-filter-row-skin-bar");
    expect(bar).toBeTruthy();
    expect(row.querySelector(".art-filter-row-detail")?.contains(summary)).toBe(true);
    expect(bar?.dataset.filterRowAsset).toBe(ROW_FILTER_ASSET_BY_STATE.default);
    expect(bar?.style.borderImageSource).toContain("url(");

    row.classList.add("selected");
    expect(resolveFilterRowAssetId(row)).toBe(ROW_FILTER_ASSET_BY_STATE.selected);
  });

  it("keeps daily quest title in the 40px skin bar; cross-links in detail", () => {
    const row = document.createElement("li");
    row.dataset.uiFilterRow = "";
    const dot = document.createElement("span");
    dot.className = "daily-quest-row-claim-dot";
    dot.dataset.uiFilterBadge = "dot";
    const main = document.createElement("span");
    main.className = "daily-quest-row-main";
    main.textContent = "征收粮食 5000/5000";
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "daily-cross-link-tag";
    tag.textContent = "邮件";
    row.append(dot, main, tag);
    mountFilterRow(row, mockAssets());
    const bar = row.querySelector(".art-filter-row-skin-bar");
    const detail = row.querySelector(".art-filter-row-detail");
    expect(bar?.contains(main)).toBe(true);
    expect(bar?.contains(dot)).toBe(true);
    expect(detail?.contains(tag)).toBe(true);
    expect(detail?.contains(main)).toBe(false);
  });
});

describe("applyFilterChipVisualState", () => {
  it("forces pressed and selected sprites for evidence staging", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    btn.textContent = "测";
    const assets = mockAssets();
    mountFilterChip(btn, assets);
    applyFilterChipVisualState(btn, assets, "pressed");
    expect(btn.dataset.filterChipState).toBe("pressed");
    applyFilterChipVisualState(btn, assets, "selected");
    expect(btn.dataset.filterChipState).toBe("selected");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("mountFilterUiSkins", () => {
  it("mounts chip, row, dot, and count badges", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" data-ui-filter-chip>甲</button>
      <div data-ui-filter-row>row</div>
      <span data-ui-filter-badge="dot"></span>
      <span data-ui-filter-badge="count" data-filter-badge-count="12"></span>`;
    mountFilterUiSkins(root, mockAssets());
    expect(root.querySelector("[data-ui-filter-chip] .art-filter-chip-sprite")).toBeTruthy();
    expect(root.querySelector("[data-ui-filter-row]")?.classList.contains("art-filter-row--skinned")).toBe(
      true,
    );
    expect(root.querySelector('[data-ui-filter-badge="dot"] .art-filter-badge-dot-sprite')).toBeTruthy();
    expect(
      root.querySelector(".art-filter-badge-count-label")?.textContent,
    ).toBe("9+");
  });

  it("mountFilterChips batch wires multiple chips", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" data-ui-filter-chip>A</button>
      <button type="button" data-ui-filter-chip>B</button>`;
    mountFilterChips(root, mockAssets());
    expect(root.querySelectorAll(".art-filter-chip--skinned")).toHaveLength(2);
  });

  it("mountFilterBadgeCount hides entire node when count is 0", () => {
    const count = document.createElement("span");
    count.dataset.uiFilterBadge = "count";
    mountFilterBadgeCount(count, mockAssets(), 0);
    expect(count.hidden).toBe(true);
    expect(count.classList.contains("hidden")).toBe(true);
    expect(count.textContent).toBe("");
    expect(count.querySelector(".art-filter-badge-count-sprite")).toBeNull();
    expect(count.querySelector(".art-badge-count-sprite")).toBeNull();
  });

  it("mountFilterBadgeDot and mountFilterBadgeCount respect art-skin off ancestor", () => {
    const wrap = document.createElement("div");
    wrap.dataset.artSkin = "off";
    const dot = document.createElement("span");
    dot.dataset.uiFilterBadge = "dot";
    const count = document.createElement("span");
    count.dataset.uiFilterBadge = "count";
    count.dataset.filterBadgeCount = "3";
    wrap.append(dot, count);
    mountFilterBadgeDot(dot, mockAssets());
    mountFilterBadgeCount(count, mockAssets(), 3);
    expect(dot.querySelector(".art-filter-badge-dot-sprite")).toBeNull();
    expect(count.textContent).toBe("3");
  });
});
