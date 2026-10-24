/** ART-WORLD-MINIMAP-010 (#558): minimap dest marker + legend chrome ids (CLIENT-139 wires runtime). */
export const ART_WORLD_MINIMAP_010_ASSET_IDS = [
  "ui.minimap.dest.v1",
  "ui.minimap.legend.v1",
] as const;

export type ArtWorldMinimap010AssetId = (typeof ART_WORLD_MINIMAP_010_ASSET_IDS)[number];

export const MINIMAP_DEST_ASSET_ID: ArtWorldMinimap010AssetId = "ui.minimap.dest.v1";
export const MINIMAP_LEGEND_ASSET_ID: ArtWorldMinimap010AssetId = "ui.minimap.legend.v1";

/** Logical dest marker diameter (1×); anchor center. Matches canvas fallback radius ~7px. */
export const MINIMAP_DEST_DISPLAY_SIZE = 14;
export const MINIMAP_DEST_ANCHOR_X = 7;
export const MINIMAP_DEST_ANCHOR_Y = 7;

/** Legend chrome strip under title row (1×); copy still drawn in code (`MINIMAP_DEST_ETA_LEGEND`). */
export const MINIMAP_LEGEND_DISPLAY_W = 240;
export const MINIMAP_LEGEND_DISPLAY_H = 14;

export function resolveMinimapDestAssetId(): ArtWorldMinimap010AssetId {
  return MINIMAP_DEST_ASSET_ID;
}

export function resolveMinimapLegendAssetId(): ArtWorldMinimap010AssetId {
  return MINIMAP_LEGEND_ASSET_ID;
}

export function isArtWorldMinimap010AssetId(id: string): boolean {
  return (ART_WORLD_MINIMAP_010_ASSET_IDS as readonly string[]).includes(id);
}
