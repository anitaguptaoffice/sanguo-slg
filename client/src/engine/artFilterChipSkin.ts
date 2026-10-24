import type { AssetLoader } from "@/engine/AssetLoader";
import {
  ART_FILTER_CHIP_HIT_MIN,
  ART_FILTER_CHIP_VISUAL_H,
  ART_FILTER_CHIP_VISUAL_W,
  ART_UI_FILTER_CHIP_HOVER,
  ART_UI_FILTER_CHIP_NORMAL,
  ART_UI_FILTER_CHIP_PRESSED,
  ART_UI_FILTER_CHIP_SELECTED,
} from "@/engine/artUiFilterAssets";

const CHIP_LABEL_COLOR = "#3D2E1F";

type ChipPaintState = "normal" | "hover" | "pressed" | "selected";

function chipAssetForState(state: ChipPaintState): string {
  switch (state) {
    case "hover":
      return ART_UI_FILTER_CHIP_HOVER;
    case "pressed":
      return ART_UI_FILTER_CHIP_PRESSED;
    case "selected":
      return ART_UI_FILTER_CHIP_SELECTED;
    default:
      return ART_UI_FILTER_CHIP_NORMAL;
  }
}

function isFilterChipSelected(btn: HTMLButtonElement): boolean {
  return btn.classList.contains("selected") || btn.classList.contains("active");
}

function resolveChipPaintState(btn: HTMLButtonElement, transient: ChipPaintState): ChipPaintState {
  if (isFilterChipSelected(btn)) return "selected";
  return transient;
}

function applyChipPaint(btn: HTMLButtonElement, assets: AssetLoader, transient: ChipPaintState): void {
  const paint = resolveChipPaintState(btn, transient);
  const pack = assets.getImageForAsset(chipAssetForState(paint));
  if (!pack) return;
  btn.style.backgroundImage = `url(${pack.img.src})`;
  btn.style.backgroundSize = `${ART_FILTER_CHIP_VISUAL_W}px ${ART_FILTER_CHIP_VISUAL_H}px`;
  btn.style.backgroundRepeat = "no-repeat";
  btn.style.backgroundPosition = "center";
  btn.style.backgroundColor = "transparent";
  btn.style.border = "none";
  btn.style.width = `${ART_FILTER_CHIP_VISUAL_W}px`;
  btn.style.height = `${ART_FILTER_CHIP_VISUAL_H}px`;
  btn.style.minWidth = `${ART_FILTER_CHIP_VISUAL_W}px`;
  btn.style.maxWidth = `${ART_FILTER_CHIP_VISUAL_W}px`;
  btn.style.minHeight = `${ART_FILTER_CHIP_VISUAL_H}px`;
  btn.style.maxHeight = `${ART_FILTER_CHIP_VISUAL_H}px`;
  btn.style.padding = "0 6px";
  btn.style.boxSizing = "border-box";
  btn.style.color = CHIP_LABEL_COLOR;
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.flexShrink = "0";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.style.lineHeight = "1.2";
  btn.style.outline = "none";
}

function ensureChipHitWrap(btn: HTMLButtonElement): HTMLElement {
  const parent = btn.parentElement;
  if (parent?.classList.contains("art-filter-chip-hit")) return parent;
  const wrap = document.createElement("div");
  wrap.className = "art-filter-chip-hit";
  wrap.style.minWidth = `${ART_FILTER_CHIP_HIT_MIN}px`;
  wrap.style.minHeight = `${ART_FILTER_CHIP_HIT_MIN}px`;
  btn.parentElement?.insertBefore(wrap, btn);
  wrap.appendChild(btn);
  wrap.addEventListener("click", (ev) => {
    if (ev.target === wrap) {
      ev.preventDefault();
      btn.click();
    }
  });
  return wrap;
}

function skinOneFilterChip(btn: HTMLButtonElement, assets: AssetLoader): void {
  if (btn.dataset.artSkin === "off") return;
  if (btn.dataset.artSkinned === "filter-chip") return;
  btn.dataset.artSkinned = "filter-chip";
  btn.classList.add("art-filter-chip");
  ensureChipHitWrap(btn);
  const setTransient = (t: ChipPaintState) => applyChipPaint(btn, assets, t);
  setTransient("normal");
  btn.addEventListener("mouseenter", () => {
    if (!btn.disabled) setTransient("hover");
  });
  btn.addEventListener("mouseleave", () => {
    if (!btn.disabled) setTransient("normal");
  });
  btn.addEventListener("mousedown", () => {
    if (!btn.disabled) setTransient("pressed");
  });
  btn.addEventListener("mouseup", () => {
    if (!btn.disabled) setTransient(btn.matches(":hover") ? "hover" : "normal");
  });
  const obs = new MutationObserver(() => {
    if (btn.disabled) setTransient("normal");
    else setTransient(btn.matches(":hover") ? "hover" : "normal");
  });
  obs.observe(btn, { attributes: true, attributeFilter: ["class", "disabled"] });
}

/** Mail / daily filter chips — sprite 72×32 inside ≥44×44 hit wrapper. */
export function skinFilterChips(
  root: ParentNode,
  assets: AssetLoader,
  selector = ".mail-filter-btn, .daily-quest-filter-btn:not(.daily-quest-locate-first)",
): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  for (const btn of buttons) skinOneFilterChip(btn, assets);
}

/** Force a chip into a paint state (QA / evidence only). */
export function forceFilterChipPaintState(
  btn: HTMLButtonElement,
  assets: AssetLoader,
  state: ChipPaintState,
): void {
  skinOneFilterChip(btn, assets);
  if (state === "selected") {
    btn.classList.add("selected");
    btn.classList.add("active");
  } else {
    btn.classList.remove("selected");
    btn.classList.remove("active");
  }
  applyChipPaint(btn, assets, state === "selected" ? "normal" : state);
}
