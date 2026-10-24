import type { AssetLoader } from "@/engine/AssetLoader";

/** ART-UI-PANEL-STATE-009 runtime ids (assets from CLIENT-128 manifest when present). */
export const PANEL_STATE_LOADING_ASSET_ID = "ui.panel.loading.v1";
export const PANEL_STATE_EMPTY_ASSET_ID = "ui.panel.empty.v1";
export const PANEL_STATE_ERROR_ASSET_ID = "ui.panel.error.v1";

export const PANEL_STATE_ASSET_IDS = [
  PANEL_STATE_LOADING_ASSET_ID,
  PANEL_STATE_EMPTY_ASSET_ID,
  PANEL_STATE_ERROR_ASSET_ID,
] as const;

export type PanelStateKind = "loading" | "empty" | "error";

export const PANEL_STATE_CHROME_CLASS = "panel-state-chrome";

export const PANEL_STATE_LOADING_MESSAGE = "加载中…";

const PANEL_STATE_SKIN_BY_KIND: Record<PanelStateKind, string> = {
  loading: PANEL_STATE_LOADING_ASSET_ID,
  empty: PANEL_STATE_EMPTY_ASSET_ID,
  error: PANEL_STATE_ERROR_ASSET_ID,
};

export function resolvePanelStateSkin(kind: PanelStateKind): string {
  return PANEL_STATE_SKIN_BY_KIND[kind];
}

export function isPanelStateArtSkinOff(el: HTMLElement): boolean {
  if (el.dataset.artSkin === "off") return true;
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    if (cur.dataset.artSkin === "off") return true;
    cur = cur.parentElement;
  }
  return false;
}

function applyPanelStateNineSlice(el: HTMLElement, assets: AssetLoader, assetId: string): void {
  const pack = assets.getImageForAsset(assetId);
  const meta = assets.getArtMeta(assetId);
  if (!pack || !meta?.nine_slice) return;
  const slice = meta.nine_slice;
  const scale = pack.scale;
  const url = pack.img.src;
  el.classList.add("panel-state-chrome--skinned");
  el.style.borderStyle = "solid";
  el.style.borderWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageSource = `url(${url})`;
  el.style.borderImageSlice = `${slice.top * scale} ${slice.right * scale} ${slice.bottom * scale} ${slice.left * scale} fill`;
  el.style.borderImageWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageRepeat = "stretch";
  el.style.background = "transparent";
  el.style.boxSizing = "border-box";
}

/** Apply `data-panel-state` + optional CLIENT-128 nine-slice; off / missing assets keep CLIENT-067 text. */
export function applyPanelStateChrome(
  el: HTMLElement,
  kind: PanelStateKind,
  assets?: AssetLoader,
): void {
  el.setAttribute("data-panel-state", kind);
  el.classList.add(PANEL_STATE_CHROME_CLASS);
  if (isPanelStateArtSkinOff(el) || !assets) return;
  applyPanelStateNineSlice(el, assets, resolvePanelStateSkin(kind));
}

export function renderPanelStateListRow(
  ul: HTMLElement,
  kind: PanelStateKind,
  message: string,
  options?: { legacyClass?: string; assets?: AssetLoader },
): HTMLLIElement {
  const li = document.createElement("li");
  if (options?.legacyClass) {
    for (const cls of options.legacyClass.split(/\s+/).filter(Boolean)) {
      li.classList.add(cls);
    }
  }
  li.textContent = message;
  applyPanelStateChrome(li, kind, options?.assets);
  ul.appendChild(li);
  return li;
}
