import type { AssetLoader } from "@/engine/AssetLoader";
import { FILTER_CHIP_HIT_MIN, mountFilterChips } from "@/engine/artUiFilterSkin";

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
