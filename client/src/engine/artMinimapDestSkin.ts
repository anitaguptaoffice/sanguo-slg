import type { AssetLoader } from "@/engine/AssetLoader";
import { isArtSkinOff } from "@/engine/artBadgeSkin";

/** CLIENT-138 / ART-WORLD-MINIMAP-010 目的点 chrome（资产可选，缺失时 canvas 回退）。 */
export const MINIMAP_DEST_MARKER_ASSET_ID = "ui.minimap.dest.v1";

export type MinimapDestMarkerDrawMode = "sprite" | "canvas";

/** `data-art-skin=off` 或资产未登记时走 canvas 描边圆点。 */
export function resolveMinimapDestMarkerDrawMode(
  artSkinAnchor: HTMLElement | null | undefined,
  assets: AssetLoader | null | undefined,
): MinimapDestMarkerDrawMode {
  if (!assets) return "canvas";
  if (artSkinAnchor && isArtSkinOff(artSkinAnchor)) return "canvas";
  if (!assets.getImageForAsset(MINIMAP_DEST_MARKER_ASSET_ID)) return "canvas";
  return "sprite";
}
