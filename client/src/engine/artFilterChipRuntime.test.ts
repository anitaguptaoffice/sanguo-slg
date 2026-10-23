import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  ART_UI_FILTER_008_ASSET_IDS,
  FILTER_CHIP_HIT_MIN,
  mountFilterChip,
} from "@/engine/artUiFilterSkin";
import {
  FILTER_CHIP_BUTTON_SELECTOR,
  probeFilterChipHitMeetsMin,
  readFilterChipCssMinHit,
  remountPanelFilterChips,
  setFilterChipLabel,
  syncFilterChipAria,
} from "@/engine/artFilterChipRuntime";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function mockAssets(): AssetLoader {
  const getImageForAsset = vi.fn((id: string) =>
    (ART_UI_FILTER_008_ASSET_IDS as readonly string[]).includes(id)
      ? {
          img: Object.assign(document.createElement("img"), {
            src: `data:image/gif;base64,${id}`,
          }),
          meta: { id, display_size: { w: 72, h: 32 } },
          scale: 1 as const,
        }
      : undefined,
  );
  return { getImageForAsset, getArtMeta: vi.fn() } as unknown as AssetLoader;
}

const CHIP_HIT_CSS = `
  button.art-filter-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 6px 10px;
    box-sizing: border-box;
  }
`;

describe("syncFilterChipAria", () => {
  it("sets aria-pressed and aria-current on the selected chip", () => {
    const a = document.createElement("button");
    const b = document.createElement("button");
    syncFilterChipAria([a, b], (btn) => btn === a);
    expect(a.getAttribute("aria-pressed")).toBe("true");
    expect(a.getAttribute("aria-current")).toBe("true");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.hasAttribute("aria-current")).toBe(false);
  });
});

describe("setFilterChipLabel", () => {
  it("updates mounted chip label without stripping sprite", () => {
    const btn = document.createElement("button");
    btn.textContent = "未读";
    mountFilterChip(btn, mockAssets());
    setFilterChipLabel(btn, "未读 3");
    expect(btn.querySelector(".art-filter-chip-sprite")).toBeTruthy();
    expect(btn.querySelector(".art-filter-chip-label")?.textContent).toBe("未读 3");
  });
});

describe("probeFilterChipHitMeetsMin", () => {
  it("reads computed min width/height ≥44 after mount (DOM probe)", () => {
    const style = document.createElement("style");
    style.textContent = CHIP_HIT_CSS;
    document.head.appendChild(style);
    const btn = document.createElement("button");
    btn.className = "art-filter-chip";
    btn.setAttribute("data-ui-filter-chip", "");
    document.body.appendChild(btn);
    mountFilterChip(btn, mockAssets());
    const css = readFilterChipCssMinHit(btn);
    expect(css.minWidth).toBeGreaterThanOrEqual(FILTER_CHIP_HIT_MIN);
    expect(css.minHeight).toBeGreaterThanOrEqual(FILTER_CHIP_HIT_MIN);
    expect(probeFilterChipHitMeetsMin(btn)).toBe(true);
    style.remove();
    btn.remove();
  });

  it("panel markup uses data-ui-filter-chip selector", () => {
    const dailyHtml = readFileSync(
      join(repoRoot, "client/src/ui/DailyQuestPanels.ts"),
      "utf8",
    );
    expect(dailyHtml).toContain("data-ui-filter-chip");
    expect(FILTER_CHIP_BUTTON_SELECTOR).toBe("button[data-ui-filter-chip]");
  });
});

describe("remountPanelFilterChips", () => {
  it("skins all chips under root", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" data-ui-filter-chip>A</button>
      <button type="button" data-ui-filter-chip>B</button>`;
    remountPanelFilterChips(root, mockAssets());
    expect(root.querySelectorAll(".art-filter-chip--skinned")).toHaveLength(2);
  });
});
