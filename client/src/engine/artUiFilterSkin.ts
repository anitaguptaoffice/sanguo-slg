import type { AssetLoader } from "@/engine/AssetLoader";

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

export const BADGE_DOT_ASSET_ID: ArtUiFilter008AssetId = "ui.badge.dot.v1";
export const BADGE_COUNT_ASSET_ID: ArtUiFilter008AssetId = "ui.badge.count.v1";

/** Manifest chip sprite is 72×32; CSS hit wrap must be ≥44×44 (#108 / engineering mount). */
export const FILTER_CHIP_DISPLAY_W = 72;
export const FILTER_CHIP_DISPLAY_H = 32;
export const FILTER_CHIP_HIT_MIN = 44;

export const BADGE_COUNT_DISPLAY_W = 20;
export const BADGE_COUNT_DISPLAY_H = 16;

/** Count badge label: 1–9 digits, overflow as 9+ (frozen #108). */
export function formatFilterBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > 9) return "9+";
  return String(Math.trunc(count));
}

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

function wireChipPointerStates(btn: HTMLButtonElement, assets: AssetLoader): void {
  if (btn.dataset.filterChipWired === "1") return;
  btn.dataset.filterChipWired = "1";
  const sync = () => {
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
  const sync = () => applyNineSliceRowSkin(row, assets, resolveFilterRowAssetId(row));
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
    applyNineSliceRowSkin(row, assets, resolveFilterRowAssetId(row));
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
  if (artSkinOff(el)) {
    el.classList.remove("art-filter-badge-dot", "art-filter-badge-dot--skinned");
    el.querySelector(".art-filter-badge-dot-sprite")?.remove();
    return;
  }
  const pack = assets.getImageForAsset(BADGE_DOT_ASSET_ID);
  if (!pack) return;
  el.classList.add("art-filter-badge-dot", "art-filter-badge-dot--skinned");
  let sprite = el.querySelector<HTMLSpanElement>(".art-filter-badge-dot-sprite");
  if (!sprite) {
    sprite = document.createElement("span");
    sprite.className = "art-filter-badge-dot-sprite";
    sprite.setAttribute("aria-hidden", "true");
    el.appendChild(sprite);
  }
  sprite.style.backgroundImage = `url(${pack.img.src})`;
}

export function mountFilterBadgeCount(el: HTMLElement, assets: AssetLoader, count: number): void {
  const formatted = formatFilterBadgeCount(count);
  if (!formatted) {
    el.hidden = true;
    el.classList.add("hidden");
    el.textContent = "";
    el.classList.remove("art-filter-badge-count", "art-filter-badge-count--skinned");
    el.querySelector(".art-filter-badge-count-sprite")?.remove();
    return;
  }
  el.hidden = false;
  el.classList.remove("hidden");
  if (artSkinOff(el)) {
    el.classList.remove("art-filter-badge-count", "art-filter-badge-count--skinned");
    el.textContent = formatted;
    return;
  }
  const pack = assets.getImageForAsset(BADGE_COUNT_ASSET_ID);
  if (!pack) return;
  el.classList.add("art-filter-badge-count", "art-filter-badge-count--skinned");
  let sprite = el.querySelector<HTMLSpanElement>(".art-filter-badge-count-sprite");
  if (!sprite) {
    el.textContent = "";
    sprite = document.createElement("span");
    sprite.className = "art-filter-badge-count-sprite";
    const label = document.createElement("span");
    label.className = "art-filter-badge-count-label";
    sprite.appendChild(label);
    el.appendChild(sprite);
  }
  const label = sprite.querySelector<HTMLSpanElement>(".art-filter-badge-count-label");
  sprite.style.backgroundImage = `url(${pack.img.src})`;
  if (label) label.textContent = formatted;
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
