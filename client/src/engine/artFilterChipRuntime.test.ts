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
  FILTER_CHIP_DISPLAY_W,
  probeFilterChipEdgeHits,
  probeFilterChipHitMeetsMin,
  probeFilterChipSpriteInButton,
  readFilterChipCssMinHit,
  remountPanelFilterChips,
  setFilterChipLabel,
  syncFilterChipAria,
} from "@/engine/artFilterChipRuntime";
import { mountFilterChip } from "@/engine/artUiFilterSkin";

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

describe("CLIENT-136 index.css contract", () => {
  it("skinned chips reserve 72px visual min-width and paper label color", () => {
    const indexHtml = readFileSync(join(repoRoot, "client/index.html"), "utf8");
    expect(indexHtml).toContain("art-filter-chip--skinned");
    expect(indexHtml).toContain(`min-width: ${FILTER_CHIP_DISPLAY_W}px`);
    expect(indexHtml).toMatch(/art-filter-chip--skinned[\s\S]*color:\s*#3d2e1f/i);
    expect(indexHtml).toMatch(/art-filter-row--skinned[\s\S]*color:\s*#3d2e1f/i);
  });
});

describe("probeFilterChipSpriteInButton", () => {
  it("reports container-visible intersection for mounted chip", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    btn.textContent = "chip";
    document.body.appendChild(btn);
    mountFilterChip(btn, mockAssets());
    const sprite = btn.querySelector(".art-filter-chip-sprite")!;
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 74, 44));
    vi.spyOn(sprite, "getBoundingClientRect").mockReturnValue(new DOMRect(11, 26, 72, 32));
    const probe = probeFilterChipSpriteInButton(btn);
    expect(probe).not.toBeNull();
    expect(probe?.containerVisibleIntersectionArea).toBe(72 * 32);
    expect(probe?.buttonSpriteIntersectionArea).toBe(probe?.containerVisibleIntersectionArea);
    btn.remove();
  });
});

describe("probeFilterChipEdgeHits", () => {
  it("returns five edge probes when chip has layout box", () => {
    const btn = document.createElement("button");
    btn.dataset.uiFilterChip = "";
    document.body.appendChild(btn);
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 72, 44));
    document.elementFromPoint = () => btn;
    const hits = probeFilterChipEdgeHits(btn);
    expect(hits).toHaveLength(5);
    expect(hits.map((h) => h.edge)).toEqual(["center", "left", "right", "top", "bottom"]);
    btn.remove();
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
