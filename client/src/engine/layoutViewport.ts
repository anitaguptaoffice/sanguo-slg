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

/** CLIENT-235: wave:40 主城·将领·背包·日常·军团组合窄屏 manifest at 1280×720. */
export {
  CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client235NarrowManifestCenterPanelId,
  WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_SELECTOR,
  HERO_PANEL_ART_MOUNT_SELECTOR,
  BAG_USE_CONSUMABLE_PULSE_SELECTOR,
  QUEST_CLAIM_PROGRESS_PULSE_SELECTOR,
  GUILD_CHAT_UNREAD_SEPARATOR_SELECTOR,
} from "@/engine/wave40MainCityHeroBagDailyGuildNarrowManifest";

/** CLIENT-243: wave:41 世界·军情·战报·邮件·商城·排行·招募组合窄屏 manifest at 1280×720. */
export {
  CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client243NarrowManifestCenterPanelId,
  WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_SELECTOR,
  REPORT_LIST_DENSITY_ROW_SELECTOR,
  BAG_SHOP_CATEGORY_SCAN_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_PULSE_SELECTOR,
} from "@/engine/wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest";

/** CLIENT-251: wave:42 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest at 1280×720. */
export {
  CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client251NarrowManifestCenterPanelId,
  WAVE42_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_SELECTOR,
} from "@/engine/wave42MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-259: wave:43 世界·军情·战报·邮件·商城·排行·招募组合窄屏 manifest at 1280×720. */
export {
  CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client259NarrowManifestCenterPanelId,
  WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_LINE_SELECTOR,
} from "@/engine/wave43WorldIntelBattleReportMailShopRankNarrowManifest";

/** CLIENT-267: wave:44 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固 at 1280×720. */
export {
  CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client267NarrowManifestCenterPanelId,
  WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_SELECTOR,
} from "@/engine/wave44MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-275: wave:45 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固 at 1280×720. */
export {
  CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client275NarrowManifestCenterPanelId,
  WAVE45_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_SELECTOR,
} from "@/engine/wave45WorldIntelBattleReportMailShopRankNarrowManifest";

/** CLIENT-283: wave:46 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深 at 1280×720. */
export {
  CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client283NarrowManifestCenterPanelId,
  WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_SELECTOR,
} from "@/engine/wave46MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-291: wave:47 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深 at 1280×720. */
export {
  CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client291NarrowManifestCenterPanelId,
  WAVE47_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPER_LINE_SELECTOR,
} from "@/engine/wave47WorldIntelBattleReportMailShopRankNarrowManifest";

/** CLIENT-299: wave:48 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深一层 at 1280×720. */
export {
  CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client299NarrowManifestCenterPanelId,
  WAVE48_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_SELECTOR,
} from "@/engine/wave48MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-307: wave:49 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深一层 at 1280×720. */
export {
  CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client307NarrowManifestCenterPanelId,
  WAVE49_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_SELECTOR,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_SELECTOR,
} from "@/engine/wave49WorldIntelBattleReportMailShopRankNarrowManifest";

/** CLIENT-315: wave:50 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深二层 at 1280×720. */
export {
  CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client315NarrowManifestCenterPanelId,
  WAVE50_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_SELECTOR,
} from "@/engine/wave50MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-331: wave:52 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深三层 at 1280×720. */
export {
  CLIENT_331_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client331NarrowManifestCenterPanelId,
  WAVE52_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_SELECTOR,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_SELECTOR,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_SELECTOR,
} from "@/engine/wave52MainCityHeroDailySocialQueueNarrowManifest";

/** CLIENT-339: wave:53 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深三层 at 1280×720. */
export {
  CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client339NarrowManifestCenterPanelId,
  WAVE53_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_SELECTOR,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_SELECTOR,
} from "@/engine/wave53WorldIntelBattleReportMailShopRankNarrowManifest";

/** CLIENT-323: wave:51 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深二层 at 1280×720. */
export {
  CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client323NarrowManifestCenterPanelId,
  WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_SELECTOR,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_SELECTOR,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPER_LINE_SELECTOR,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_SELECTOR,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_SELECTOR,
} from "@/engine/wave51WorldIntelBattleReportMailShopRankNarrowManifest";
