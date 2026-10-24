import type { AssetLoader } from "@/engine/AssetLoader";
import {
  FILTER_CHIP_DISPLAY_H,
  FILTER_CHIP_DISPLAY_W,
  FILTER_CHIP_HIT_MIN,
  mountFilterChips,
} from "@/engine/artUiFilterSkin";

export { FILTER_CHIP_DISPLAY_H, FILTER_CHIP_DISPLAY_W };

/** Panel filter chips opt in via `data-ui-filter-chip` on `<button>`. */
export const FILTER_CHIP_BUTTON_SELECTOR = "button[data-ui-filter-chip]";

function parseCssPx(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** CSS contract: min-width/min-height from computed style (layout-independent probe). */
export function readFilterChipCssMinHit(btn: HTMLElement): { minWidth: number; minHeight: number } {
  const style = getComputedStyle(btn);
  return {
    minWidth: parseCssPx(style.minWidth),
    minHeight: parseCssPx(style.minHeight),
  };
}

export function intersectionRectArea(a: DOMRect, b: DOMRect): number {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
}

/** Sprite 72×32 must fit inside button box (CLIENT-136 visual slot, not 44px clip). */
export function probeFilterChipSpriteInButton(btn: HTMLElement): {
  spriteFitsButton: boolean;
  spriteFullyInsideButton: boolean;
  spriteArea: number;
  visibleIntersectionArea: number;
} | null {
  const sprite = btn.querySelector<HTMLElement>(".art-filter-chip-sprite");
  if (!sprite) return null;
  const btnRect = btn.getBoundingClientRect();
  const spriteRect = sprite.getBoundingClientRect();
  if (spriteRect.width <= 0 || spriteRect.height <= 0) return null;
  const spriteArea = spriteRect.width * spriteRect.height;
  const visibleIntersectionArea = intersectionRectArea(btnRect, spriteRect);
  const spriteFitsButton =
    spriteRect.width <= btnRect.width + 0.5 && spriteRect.height <= btnRect.height + 0.5;
  const spriteFullyInsideButton =
    spriteRect.left >= btnRect.left - 0.5 &&
    spriteRect.right <= btnRect.right + 0.5 &&
    spriteRect.top >= btnRect.top - 0.5 &&
    spriteRect.bottom <= btnRect.bottom + 0.5;
  return {
    spriteFitsButton,
    spriteFullyInsideButton,
    spriteArea,
    visibleIntersectionArea,
  };
}

export type AdjacentChipHitOverlap = { indexA: number; indexB: number; overlapArea: number };

/** Adjacent chip hit boxes must not overlap (independent expansion). */
export function probeAdjacentChipHitOverlaps(chips: HTMLElement[]): AdjacentChipHitOverlap[] {
  const overlaps: AdjacentChipHitOverlap[] = [];
  for (let i = 0; i < chips.length; i++) {
    for (let j = i + 1; j < chips.length; j++) {
      const overlapArea = intersectionRectArea(
        chips[i].getBoundingClientRect(),
        chips[j].getBoundingClientRect(),
      );
      if (overlapArea > 1) overlaps.push({ indexA: i, indexB: j, overlapArea });
    }
  }
  return overlaps;
}

export function probeChipCenterElementFromPoint(btn: HTMLElement): {
  centerHitsChip: boolean;
  topTag: string | null;
} {
  const rect = btn.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { centerHitsChip: false, topTag: null };
  }
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const top = document.elementFromPoint(x, y);
  return {
    centerHitsChip: top === btn || (top != null && btn.contains(top)),
    topTag: top?.tagName ?? null,
  };
}

/** Prefer layout box when jsdom/browser laid out; else fall back to CSS mins. */
export function probeFilterChipHitMeetsMin(btn: HTMLElement, min = FILTER_CHIP_HIT_MIN): boolean {
  const rect = btn.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return rect.width >= min && rect.height >= min;
  }
  const css = readFilterChipCssMinHit(btn);
  return css.minWidth >= min && css.minHeight >= min;
}

export function syncFilterChipAria(
  buttons: Iterable<HTMLButtonElement>,
  isSelected: (btn: HTMLButtonElement) => boolean,
): void {
  for (const btn of buttons) {
    const selected = isSelected(btn);
    btn.classList.toggle("selected", selected);
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    if (selected) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  }
}

export function setFilterChipLabel(btn: HTMLButtonElement, text: string): void {
  const label = btn.querySelector<HTMLElement>(".art-filter-chip-label");
  if (label) label.textContent = text;
  else btn.textContent = text;
}

/** Mount / refresh ART-UI-FILTER-008 chip skins under `root`. */
export function remountPanelFilterChips(root: ParentNode, assets: AssetLoader): void {
  mountFilterChips(root, assets);
}
