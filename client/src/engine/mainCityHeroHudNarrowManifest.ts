import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
} from "@/engine/artPanelSkin";
import { HUD_HEIGHT, LAYOUT_FRAME, TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";

/** Bottom toolbar + focus ring slack (matches CLIENT-127 / CLIENT-111). */
export const MAIN_CITY_HERO_HUD_BOTTOM_CLEARANCE_PX = 64;

/** CLIENT-135: 主城建造侧栏 / 队列 / 将领列表面板 at 1280×720. */
export const CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS = ["building", "queue", "hero"] as const;

export type Client135NarrowManifestCenterPanelId =
  (typeof CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export const CLIENT_135_PANEL_ASSET_BY_CENTER_ID: Record<
  Client135NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
};

export const CLIENT_135_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client135NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
};

/** Canvas/DOM seven-slot upgrade overlay layer (CLIENT-066 / CLIENT-130). */
export const MAIN_CITY_SLOT_OVERLAY_LAYER_SELECTOR = ".main-city-slot-upgrade-layer";

/** Soft-dep CLIENT-131: seven-slot status matrix in queue panel header. */
export const QUEUE_SLOT_MATRIX_SELECTOR = '[data-role="queue-slot-matrix"]';

/** Soft-dep CLIENT-129: unified loading/empty/error chrome inside panel roots. */
export const PANEL_STATE_CHROME_SELECTOR = "[data-panel-state]";

export function isMainCityHeroHudArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient135PanelRoot(
  doc: ParentNode,
  panelId: Client135NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "building") {
    return doc.querySelector<HTMLElement>(`.building-panel[data-center-panel="building"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** Layout-space box must end above bottom toolbar (1600×900 frame, 56px bar). */
export function layoutBoxClearOfBottomToolbar(
  bottomY: number,
  frameHeight = LAYOUT_FRAME.h,
  toolbarHeight = TOOLBAR_HEIGHT,
): boolean {
  return bottomY <= frameHeight - toolbarHeight + 1e-6;
}

/** HUD strip occupies top HUD_HEIGHT; content must not extend under bottom bar. */
export function narrowHudChromeVerticalBounds(): { stageTop: number; stageBottom: number } {
  return {
    stageTop: HUD_HEIGHT,
    stageBottom: LAYOUT_FRAME.h - TOOLBAR_HEIGHT,
  };
}

/** No-op skin hook for tests; panel nine-slice wired in MainCityScene (CLIENT-111/119). */
export function mountClient135PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isMainCityHeroHudArtSkinOff(_root)) return;
}
