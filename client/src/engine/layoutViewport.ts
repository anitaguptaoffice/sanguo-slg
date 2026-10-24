import { LAYOUT_FRAME, MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";

export { MIN_CONTENT_VIEWPORT };

export type LayoutViewport = {
  uiScale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
};

/** Letterboxed fit of 1600×900 design frame into the canvas CSS box. */
export function computeLayoutViewport(
  cssWidth: number,
  cssHeight: number,
  designW = LAYOUT_FRAME.w,
  designH = LAYOUT_FRAME.h,
): LayoutViewport {
  const uiScale = Math.min(cssWidth / designW, cssHeight / designH);
  const contentW = designW * uiScale;
  const contentH = designH * uiScale;
  const offsetX = (cssWidth - contentW) / 2;
  const offsetY = (cssHeight - contentH) / 2;
  return { uiScale, offsetX, offsetY, cssWidth, cssHeight };
}

/** Multiplies the current canvas transform (e.g. GameApp DPR scale) — do not use setTransform here. */
export function applyLayoutTransform(ctx: CanvasRenderingContext2D, vp: LayoutViewport): void {
  ctx.transform(vp.uiScale, 0, 0, vp.uiScale, vp.offsetX, vp.offsetY);
}

export function layoutToCanvas(
  layoutX: number,
  layoutY: number,
  vp: LayoutViewport,
): { x: number; y: number } {
  return {
    x: vp.offsetX + layoutX * vp.uiScale,
    y: vp.offsetY + layoutY * vp.uiScale,
  };
}

export function canvasToLayout(
  canvasX: number,
  canvasY: number,
  vp: LayoutViewport,
): { x: number; y: number } {
  return {
    x: (canvasX - vp.offsetX) / vp.uiScale,
    y: (canvasY - vp.offsetY) / vp.uiScale,
  };
}

/** CSS size of the scaled 1600×900 layout frame (letterbox content box). */
export function layoutFrameCssSize(vp: LayoutViewport): { width: number; height: number } {
  return {
    width: LAYOUT_FRAME.w * vp.uiScale,
    height: LAYOUT_FRAME.h * vp.uiScale,
  };
}

/** Position the DOM layout frame inside a full-viewport root (offsets from letterboxing). */
export function applyLayoutFrameStyles(frame: HTMLElement, vp: LayoutViewport): void {
  const { width, height } = layoutFrameCssSize(vp);
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.left = `${vp.offsetX}px`;
  frame.style.top = `${vp.offsetY}px`;
  frame.style.setProperty("--ui-scale", String(vp.uiScale));
}

/** Minimum uiScale so a layout-space hit box of `layoutPx` stays ≥ `minCssPx` on screen. */
export function minUiScaleForHitSize(layoutPx: number, minCssPx = 44): number {
  return minCssPx / layoutPx;
}

/** Applied to `#layout-frame` when content fits at or below MIN_CONTENT_VIEWPORT (1280×720). */
export const NARROW_LAYOUT_ROOT_CLASS = "layout-narrow";

const NARROW_UI_SCALE = MIN_CONTENT_VIEWPORT.w / LAYOUT_FRAME.w;

/** Letterboxed frame at or below the 1280×720 minimum content box (uiScale ≤ 0.8). */
export function isNarrowLayoutViewport(vp: LayoutViewport): boolean {
  return vp.uiScale <= NARROW_UI_SCALE + 1e-6;
}

/** Root class for narrow layout; empty string at 1600×900 baseline and wider. */
export function layoutViewportRootClass(vp: LayoutViewport): string {
  return isNarrowLayoutViewport(vp) ? NARROW_LAYOUT_ROOT_CLASS : "";
}

export function syncLayoutViewportRootClass(root: HTMLElement, vp: LayoutViewport): void {
  root.classList.toggle(NARROW_LAYOUT_ROOT_CLASS, isNarrowLayoutViewport(vp));
}

/** CLIENT-111: center-panel ids wired for 1280 manifest + scroll consolidation (主城侧栏/邮件/队列). */
export const CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS = ["building", "mail", "queue"] as const;

export type Client111NarrowManifestCenterPanelId =
  (typeof CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-119: center-panel ids wired for 1280 manifest + scroll (背包/商城/将领招募/军事出征). */
export const CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "bag",
  "shop",
  "hero",
  "military",
] as const;

export type Client119NarrowManifestCenterPanelId =
  (typeof CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-127: mail / daily / march / battle-report filter-list manifest at 1280×720. */
export {
  CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS as CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client127NarrowFilterListCenterPanelId as Client127NarrowManifestCenterPanelId,
} from "@/engine/filterListNarrowManifest";

/** CLIENT-135: main-city building / queue / hero list + HUD slot overlay narrow manifest. */
export {
  CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client135NarrowManifestCenterPanelId,
} from "@/engine/mainCityHeroHudNarrowManifest";

/** CLIENT-145: world minimap expanded + march/battle-report/rank/guild/chat manifest at 1280×720. */
export {
  CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client145NarrowManifestCenterPanelId,
  WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
} from "@/engine/worldIntelSocialNarrowManifest";
export { resolveMinimapExpandedLayoutRect as resolveWorldMinimapExpandedLayoutRect } from "@/ui/worldMinimap";

/** CLIENT-155: HUD 产出展开·队列顶栏·日常/将领/排行·背包商城 tab 组合窄屏 manifest at 1280×720. */
export {
  CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client155NarrowManifestCenterPanelId,
  MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX,
  HUD_RESOURCE_STRIP_SELECTOR,
  HUD_RESOURCE_SWEEP_SELECTOR,
} from "@/engine/mainCityWave30NarrowManifest";

/** CLIENT-163: wave:31 出征募兵·军情·战报邻接·邮件批量·军团/聊天草稿窄屏 manifest at 1280×720. */
export {
  CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client163NarrowManifestCenterPanelId,
  WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MARCH_QUEUE_BANNER_SELECTOR,
  MAIL_CLAIM_ALL_ATTACHMENTS_SELECTOR,
} from "@/engine/wave31MarchMailSocialNarrowManifest";

/** CLIENT-171: wave:32 主城建造·将领招募商城·日常 chain·世界格点组合窄屏 manifest at 1280×720. */
export {
  CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client171NarrowManifestCenterPanelId,
  WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DAILY_CHAIN_TAB_BAR_SELECTOR,
  SHOP_TAB_CURRENCY_SWEEP_SELECTOR,
  WORLD_TILE_INFO_SELECTOR,
} from "@/engine/wave32MainCityBuildHeroShopDailyWorldNarrowManifest";

/** CLIENT-179: wave:33 军情信息卡·战报·邮件·背包·日常·军事汇总组合窄屏 manifest at 1280×720. */
export {
  CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client179NarrowManifestCenterPanelId,
  WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MARCH_INFO_CARD_SELECTOR,
  MARCH_FORM_READONLY_STRIP_SELECTOR,
  BATTLE_REPORT_OUTCOME_SUMMARY_SELECTOR,
} from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";

/** CLIENT-187: wave:34 主城七槽·将领·排行·军团/聊天·HUD·队列日常锚点组合窄屏 manifest at 1280×720. */
export {
  CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client187NarrowManifestCenterPanelId,
  WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  HUD_PRODUCTION_WALLET_LINE_SELECTOR,
  CITY_SLOT_PULSE_SELECTOR,
  LEADERBOARD_TOP_DENSITY_LINE_SELECTOR,
} from "@/engine/wave34MainCityHeroRankSocialHudNarrowManifest";

/** CLIENT-195: wave:35 世界·军情·战报·邮件·日常·背包·商城组合窄屏 manifest at 1280×720. */
export {
  CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client195NarrowManifestCenterPanelId,
  WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_TILE_INFO_CARD_SELECTOR,
  BATTLE_REPORT_OUTCOME_BAND_SELECTOR,
  MINIMAP_BATTLE_REPLAY_PULSE_SELECTOR,
} from "@/engine/wave35WorldIntelBattleReportMailDailyNarrowManifest";

/** CLIENT-203: wave:36 主城队列·将领养成·社交·HUD 深链组合窄屏 manifest at 1280×720. */
export {
  CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client203NarrowManifestCenterPanelId,
  WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  QUEUE_ROW_ETA_LINE_SELECTOR,
  HUD_CENTER_PANEL_DEEPLINK_LINE_SELECTOR,
  CENTER_PANEL_TAB_PULSE_SELECTOR,
} from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";

/** CLIENT-211: wave:37 世界·军情·战报·邮件·背包组合窄屏 manifest at 1280×720. */
export {
  CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client211NarrowManifestCenterPanelId,
  WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_MARCH_STACK_BADGE_SELECTOR,
  MARCH_INTEL_PHASE_ETA_STRIP_SELECTOR,
  BATTLE_REPORT_ROUND_SUMMARY_STRIP_SELECTOR,
} from "@/engine/wave37WorldIntelBattleReportMailBagNarrowManifest";

/** CLIENT-219: wave:38 主城·将领·社交·队列·HUD 深链组合窄屏 manifest at 1280×720. */
export {
  CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client219NarrowManifestCenterPanelId,
  WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_SELECTOR,
  HUD_TODO_MERGED_SWEEP_LINE_SELECTOR,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_SELECTOR,
} from "@/engine/wave38MainCityHeroSocialQueueNarrowManifest";

/** CLIENT-227: wave:39 世界·军情·战报·邮件·出征·HUD 军事待办组合窄屏 manifest at 1280×720. */
export {
  CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client227NarrowManifestCenterPanelId,
  WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SYNC_RING_SELECTOR,
  INTEL_PHASE_CHANGE_FLASH_SELECTOR,
  REPORT_LIST_INTEL_JUMP_TAG_SELECTOR,
  HUD_MILITARY_TODO_SWEEP_LINE_SELECTOR,
} from "@/engine/wave39WorldIntelBattleReportMailMarchHudNarrowManifest";
