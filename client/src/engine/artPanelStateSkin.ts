/** ART-UI-PANEL-STATE-009 (#532): loading / empty / error nine-slice ids for panel body chrome (CLIENT-129 wires runtime). */
export const ART_UI_PANEL_STATE_009_ASSET_IDS = [
  "ui.panel.loading.v1",
  "ui.panel.empty.v1",
  "ui.panel.error.v1",
] as const;

export type ArtUiPanelState009AssetId = (typeof ART_UI_PANEL_STATE_009_ASSET_IDS)[number];

export type PanelStateKind = "loading" | "empty" | "error";

export const PANEL_STATE_ASSET_BY_KIND: Record<PanelStateKind, ArtUiPanelState009AssetId> = {
  loading: "ui.panel.loading.v1",
  empty: "ui.panel.empty.v1",
  error: "ui.panel.error.v1",
};

/** Logical display size for panel-state chrome (1×); nine_slice L/T/R/B = 16. */
export const PANEL_STATE_DISPLAY_W = 320;
export const PANEL_STATE_DISPLAY_H = 120;

export function resolvePanelStateAssetId(kind: PanelStateKind): ArtUiPanelState009AssetId {
  return PANEL_STATE_ASSET_BY_KIND[kind];
}

export function isArtUiPanelState009AssetId(id: string): boolean {
  return (ART_UI_PANEL_STATE_009_ASSET_IDS as readonly string[]).includes(id);
}
