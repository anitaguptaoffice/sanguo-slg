import type { AssetLoader } from "@/engine/AssetLoader";
import {
  BADGE_COUNT_ASSET_ID,
  BADGE_COUNT_DISPLAY_H,
  BADGE_COUNT_DISPLAY_W,
  BADGE_DOT_ASSET_ID,
  formatBadgeCount,
  hideCountBadgeElement,
  mountBadgeCount,
  mountBadgeDot,
} from "@/engine/artBadgeSkin";

/** ART-UI-FILTER-008 (#506 @ 38451735 cherry-pick): nine manifest ids for list filter chrome. */
export const ART_UI_FILTER_008_ASSET_IDS = [
  "ui.chip.filter.v1",
  "ui.chip.filter.hover.v1",
  "ui.chip.filter.pressed.v1",
  "ui.chip.filter.selected.v1",
  "ui.list.row.v1",
  "ui.list.row.hover.v1",
  "ui.list.row.selected.v1",
  "ui.badge.dot.v1",
  "ui.badge.count.v1",
] as const;

export type ArtUiFilter008AssetId = (typeof ART_UI_FILTER_008_ASSET_IDS)[number];

export type FilterChipVisualState = "normal" | "hover" | "pressed" | "selected";

export const CHIP_FILTER_ASSET_BY_STATE: Record<FilterChipVisualState, ArtUiFilter008AssetId> = {
  normal: "ui.chip.filter.v1",
  hover: "ui.chip.filter.hover.v1",
  pressed: "ui.chip.filter.pressed.v1",
  selected: "ui.chip.filter.selected.v1",
};

export type FilterRowVisualState = "default" | "hover" | "selected";

export const ROW_FILTER_ASSET_BY_STATE: Record<FilterRowVisualState, ArtUiFilter008AssetId> = {
  default: "ui.list.row.v1",
  hover: "ui.list.row.hover.v1",
  selected: "ui.list.row.selected.v1",
};

export {
  BADGE_DOT_ASSET_ID,
  BADGE_COUNT_ASSET_ID,
  BADGE_COUNT_DISPLAY_W,
  BADGE_COUNT_DISPLAY_H,
};

/** @deprecated Use `formatBadgeCount` from `artBadgeSkin`. */
export const formatFilterBadgeCount = formatBadgeCount;

/** Manifest chip sprite is 72×32; CSS hit wrap must be ≥44×44 (#108 / engineering mount). */
export const FILTER_CHIP_DISPLAY_W = 72;
export const FILTER_CHIP_DISPLAY_H = 32;
export const FILTER_CHIP_HIT_MIN = 44;

/** Nine-slice row chrome logical height (horizontal stretch only). */
export const FILTER_ROW_SKIN_BAR_HEIGHT = 40;

const FILTER_ROW_DETAIL_SELECTORS =
  ".mail-row-summary, .daily-cross-link-tag, .march-row-meta, .march-row-recent-eta, .march-row-remarch-btn, .battle-report-row-primary, .battle-report-row-secondary, .battle-report-replay-grid-btn, .report-list-intel-jump-tag";

export function isArtUiFilter008AssetId(id: string): id is ArtUiFilter008AssetId {
  return (ART_UI_FILTER_008_ASSET_IDS as readonly string[]).includes(id);
}

export function resolveFilterChipPack(
  assets: AssetLoader,
  state: FilterChipVisualState,
): { img: HTMLImageElement; scale: 1 | 2 } | undefined {
  const assetId = CHIP_FILTER_ASSET_BY_STATE[state];
  return assets.getImageForAsset(assetId) ?? undefined;
}

export function resolveFilterRowAssetId(row: HTMLElement): ArtUiFilter008AssetId {
  if (row.classList.contains("selected") || row.getAttribute("aria-selected") === "true") {
    return ROW_FILTER_ASSET_BY_STATE.selected;
  }
  if (row.dataset.filterRowState === "hover") {
    return ROW_FILTER_ASSET_BY_STATE.hover;
  }
  return ROW_FILTER_ASSET_BY_STATE.default;
}

function artSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

function ensureFilterRowSkinStructure(row: HTMLElement): HTMLElement {
  let bar = row.querySelector<HTMLElement>(".art-filter-row-skin-bar");
  let detail = row.querySelector<HTMLElement>(".art-filter-row-detail");
  if (bar && detail) return bar;
  bar = document.createElement("div");
  bar.className = "art-filter-row-skin-bar";
  detail = document.createElement("div");
  detail.className = "art-filter-row-detail";
  for (const el of Array.from(row.querySelectorAll<HTMLElement>(FILTER_ROW_DETAIL_SELECTORS))) {
    detail.appendChild(el);
  }
  const direct = Array.from(row.children).filter(
    (c) => c !== bar && c !== detail && !c.classList.contains("art-filter-row-skin-bar"),
  );
  for (const child of direct) bar.appendChild(child);
  row.insertBefore(bar, row.firstChild);
  row.appendChild(detail);
  return bar;
}

function applyNineSliceRowSkin(el: HTMLElement, assets: AssetLoader, assetId: string): void {
  const pack = assets.getImageForAsset(assetId);
  const meta = assets.getArtMeta(assetId);
  if (!pack || !meta?.nine_slice) return;
  const slice = meta.nine_slice;
  const scale = pack.scale;
  const url = pack.img.src;
  el.style.borderStyle = "solid";
  el.style.borderWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageSource = `url(${url})`;
  el.style.borderImageSlice = `${slice.top * scale} ${slice.right * scale} ${slice.bottom * scale} ${slice.left * scale} fill`;
  el.style.borderImageWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageRepeat = "stretch";
  el.style.background = "transparent";
  el.style.boxSizing = "border-box";
  el.dataset.filterRowAsset = assetId;
}

function chipVisualState(btn: HTMLButtonElement): FilterChipVisualState {
  if (
    btn.classList.contains("selected") ||
    btn.getAttribute("aria-pressed") === "true" ||
    btn.getAttribute("aria-current") === "true"
  ) {
    return "selected";
  }
  if (btn.disabled) return "normal";
  if (btn.matches(":active")) return "pressed";
  if (btn.matches(":hover")) return "hover";
  return "normal";
}

function ensureChipStructure(btn: HTMLButtonElement): HTMLSpanElement {
  let sprite = btn.querySelector<HTMLSpanElement>(".art-filter-chip-sprite");
  if (!sprite) {
    sprite = document.createElement("span");
    sprite.className = "art-filter-chip-sprite";
    sprite.setAttribute("aria-hidden", "true");
    btn.prepend(sprite);
  }
  let label = btn.querySelector<HTMLSpanElement>(".art-filter-chip-label");
  if (!label) {
    const roleLabel = btn.querySelector<HTMLSpanElement>("[data-role='mail-filter-all-label']");
    if (roleLabel) {
      roleLabel.classList.add("art-filter-chip-label");
      label = roleLabel;
    }
  }
  if (!label) {
    const text = (btn.textContent ?? "").trim();
    for (const node of Array.from(btn.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    }
    label = document.createElement("span");
    label.className = "art-filter-chip-label";
    label.textContent = text;
    btn.appendChild(label);
  }
  btn.classList.add("art-filter-chip");
  return sprite;
}

function applyChipSprite(btn: HTMLButtonElement, assets: AssetLoader, state: FilterChipVisualState): void {
  const pack = resolveFilterChipPack(assets, state);
  const sprite = btn.querySelector<HTMLSpanElement>(".art-filter-chip-sprite");
  if (!sprite || !pack) return;
  sprite.style.backgroundImage = `url(${pack.img.src})`;
  sprite.dataset.filterChipState = state;
  btn.dataset.filterChipState = state;
}

/** Force a chip skin state (evidence staging / probes); does not rely on :hover/:active alone. */
export function applyFilterChipVisualState(
  btn: HTMLButtonElement,
  assets: AssetLoader,
  state: FilterChipVisualState,
): void {
  btn.dataset.filterChipEvidenceLock = "1";
  ensureChipStructure(btn);
  btn.classList.remove("selected", "active");
  btn.removeAttribute("aria-pressed");
  btn.removeAttribute("aria-current");
  if (state === "selected") {
    btn.classList.add("selected", "active");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-current", "true");
  }
  applyChipSprite(btn, assets, state);
}

function wireChipPointerStates(btn: HTMLButtonElement, assets: AssetLoader): void {
  if (btn.dataset.filterChipWired === "1") return;
  btn.dataset.filterChipWired = "1";
  const sync = () => {
    if (btn.dataset.filterChipEvidenceLock === "1") return;
    if (btn.disabled) {
      applyChipSprite(btn, assets, chipVisualState(btn));
      return;
    }
    applyChipSprite(btn, assets, chipVisualState(btn));
  };
  sync();
  btn.addEventListener("mouseenter", sync);
  btn.addEventListener("mouseleave", sync);
  btn.addEventListener("mousedown", sync);
  btn.addEventListener("mouseup", sync);
  const obs = new MutationObserver(sync);
  obs.observe(btn, {
    attributes: true,
    attributeFilter: ["class", "aria-pressed", "disabled"],
  });
}

export function mountFilterChip(btn: HTMLButtonElement, assets: AssetLoader): void {
  if (artSkinOff(btn)) {
    btn.classList.remove("art-filter-chip", "art-filter-chip--skinned");
    btn.querySelector(".art-filter-chip-sprite")?.remove();
    delete btn.dataset.filterChipMounted;
    return;
  }
  ensureChipStructure(btn);
  btn.classList.add("art-filter-chip--skinned");
  if (btn.dataset.filterChipMounted === "1") {
    applyChipSprite(btn, assets, chipVisualState(btn));
    return;
  }
  btn.dataset.filterChipMounted = "1";
  wireChipPointerStates(btn, assets);
}

export function mountFilterChips(
  root: ParentNode,
  assets: AssetLoader,
  selector = "button[data-ui-filter-chip]",
): void {
  for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>(selector))) {
    mountFilterChip(btn, assets);
  }
}

function wireFilterRowStates(row: HTMLElement, assets: AssetLoader): void {
  if (row.dataset.filterRowWired === "1") return;
  row.dataset.filterRowWired = "1";
  const sync = () => {
    const bar = ensureFilterRowSkinStructure(row);
    applyNineSliceRowSkin(bar, assets, resolveFilterRowAssetId(row));
  };
  sync();
  row.addEventListener("mouseenter", () => {
    if (row.classList.contains("selected") || row.getAttribute("aria-selected") === "true") return;
    row.dataset.filterRowState = "hover";
    sync();
  });
  row.addEventListener("mouseleave", () => {
    delete row.dataset.filterRowState;
    sync();
  });
  const obs = new MutationObserver(sync);
  obs.observe(row, { attributes: true, attributeFilter: ["class", "aria-selected"] });
}

export function mountFilterRow(row: HTMLElement, assets: AssetLoader): void {
  if (artSkinOff(row)) {
    row.classList.remove("art-filter-row", "art-filter-row--skinned");
    row.style.borderImageSource = "";
    delete row.dataset.filterRowMounted;
    return;
  }
  row.classList.add("art-filter-row", "art-filter-row--skinned");
  if (row.dataset.filterRowMounted === "1") {
    const bar = ensureFilterRowSkinStructure(row);
    applyNineSliceRowSkin(bar, assets, resolveFilterRowAssetId(row));
    return;
  }
  row.dataset.filterRowMounted = "1";
  wireFilterRowStates(row, assets);
}

export function mountFilterRows(
  root: ParentNode,
  assets: AssetLoader,
  selector = "[data-ui-filter-row]",
): void {
  for (const row of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
    mountFilterRow(row, assets);
  }
}

export function mountFilterBadgeDot(el: HTMLElement, assets: AssetLoader): void {
  mountBadgeDot(el, assets);
  if (!artSkinOff(el) && assets.getImageForAsset(BADGE_DOT_ASSET_ID)) {
    el.classList.add("art-filter-badge-dot", "art-filter-badge-dot--skinned");
    const sprite = el.querySelector(".art-badge-dot-sprite");
    sprite?.classList.add("art-filter-badge-dot-sprite");
  }
}

export function mountFilterBadgeCount(el: HTMLElement, assets: AssetLoader, count: number): void {
  if (!formatBadgeCount(count)) {
    hideCountBadgeElement(el);
    return;
  }
  el.hidden = false;
  el.classList.remove("hidden");
  mountBadgeCount(el, assets, count);
  if (!artSkinOff(el) && assets.getImageForAsset(BADGE_COUNT_ASSET_ID)) {
    el.classList.add("art-filter-badge-count", "art-filter-badge-count--skinned");
    const sprite = el.querySelector(".art-badge-count-sprite");
    sprite?.classList.add("art-filter-badge-count-sprite");
    const label = el.querySelector(".art-badge-count-label");
    label?.classList.add("art-filter-badge-count-label");
  } else if (artSkinOff(el)) {
    el.textContent = formatBadgeCount(count);
  }
}

export function mountFilterBadges(
  root: ParentNode,
  assets: AssetLoader,
  dotSelector = "[data-ui-filter-badge='dot']",
  countSelector = "[data-ui-filter-badge='count']",
): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(dotSelector))) {
    mountFilterBadgeDot(el, assets);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(countSelector))) {
    const raw = el.dataset.filterBadgeCount ?? el.textContent ?? "";
    const count = Number(raw);
    mountFilterBadgeCount(el, assets, Number.isFinite(count) ? count : 0);
  }
}

/** Wire chip / row / badge mounts for filter list chrome (panels opt-in via data attributes). */
export function mountFilterUiSkins(root: ParentNode, assets: AssetLoader): void {
  mountFilterChips(root, assets);
  mountFilterRows(root, assets);
  mountFilterBadges(root, assets);
}
