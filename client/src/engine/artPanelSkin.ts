import type { AssetLoader } from "@/engine/AssetLoader";

export const PANEL_ASSET_DEFAULT = "ui.panel.default.v1";
export const PANEL_ASSET_MILITARY = "ui.panel.military.v1";

/** Stretch a nine_slice panel asset as CSS border-image (24px logical slice by default). */
export function skinNineSlicePanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 480,
  logicalH = 300,
  panelAssetId = PANEL_ASSET_DEFAULT,
): void {
  if (el.dataset.artSkin === "off") return;
  const pack = assets.getImageForAsset(panelAssetId);
  const meta = assets.getArtMeta(panelAssetId);
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
  el.style.minWidth = `${logicalW}px`;
  el.style.minHeight = `${logicalH}px`;
}
