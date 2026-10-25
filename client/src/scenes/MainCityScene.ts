import type { AssetLoader } from "@/engine/AssetLoader";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { clearHudBarChrome, clearToolbarBarChrome, skinHudBar, skinToolbarBar, wrapToolbarButtonsForHit } from "@/engine/artChromeSkin";
import { skinToolbarButtons } from "@/engine/artToolbarButtonSkin";
import { applyUiCountBadge } from "@/engine/artBadgeSkin";
import { registerArtFilter008EvidenceHooks } from "@/engine/artFilter008EvidenceStaging";
import { remountPanelFilterChips } from "@/engine/artFilterChipRuntime";
import { mountToolbarIcons } from "@/engine/artToolbarIconSkin";
import {
  skinBagPanel,
  skinBattleReportPanel,
  skinChatPanel,
  skinDailyPanel,
  skinDefaultPanel,
  skinGuildPanel,
  skinMailPanel,
  skinMarchIntelPanel,
  skinMilitaryPanel,
  skinQueuePanel,
  skinRankPanel,
  skinShopPanel,
  skinWorldPanel,
} from "@/engine/artPanelSkin";
import { mountFilterListPanelSkins } from "@/engine/filterListNarrowManifest";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import {
  appendHudResourceStrip,
  readHudResourceStripExpanded,
  restoreHudResourceStripExpanded,
} from "@/engine/artResourceHud";
import {
  applyLayoutTransform,
  canvasToLayout,
  isNarrowLayoutViewport,
  type LayoutViewport,
} from "@/engine/layoutViewport";
import { resolveMinimapExpandedLayoutRect } from "@/ui/worldMinimap";
import {
  LAYOUT_FRAME,
  MAIN_CITY_SLOTS,
  STAGE_HEIGHT,
  STAGE_TOP_Y,
  type MainCitySlotDef,
} from "@/engine/mainCitySlots";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, CityTroopStack, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { scrollCitySlotIntoView } from "@/net/citySlotQueueLink";
import { highlightDomesticSlotForQueueRow } from "@/net/domesticSlotQueueFocusRing";
import { pulseDomesticSlotCompleteMarginResidualRing } from "@/net/nextQueueFinishPreviewResidual";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepRing } from "@/net/nextQueueFinishPreviewResidualDeep";
import { pulseDomesticSlotPreviewCrossLinkResidualDeeperRing } from "@/net/nextQueueFinishPreviewResidualDeeper";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepestRing } from "@/net/nextQueueFinishPreviewResidualDeepest";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepestDeeperRing } from "@/net/nextQueueFinishPreviewResidualDeepestDeeper";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRing } from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeeper";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestRing } from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepest";
import { pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRing } from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepestDeeper";
import {
  captureDomesticSlotScrollAnchor,
  restoreDomesticSlotScrollAnchor,
} from "@/net/domesticSlotScrollAnchor";
import { SocialPanels } from "@/ui/SocialPanels";
import { ContentPanels } from "@/ui/ContentPanels";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { BattleReportPanel } from "@/ui/BattleReportPanel";
import { MarchListPanel } from "@/ui/MarchListPanel";
import { DailyQuestPanels } from "@/ui/DailyQuestPanels";
import { WorldPanels } from "@/ui/WorldPanels";
import { appendManhattanToStatus } from "@/ui/marchWorldListLink";
import { QueuePanels } from "@/ui/QueuePanels";
import { resolveDailyQueueAnchorTarget } from "@/net/dailyQueueAnchor";
import type { DailyQuestNavAction } from "@/net/dailyQuestObjective";
import { DAILY_RECRUIT_QUEST_CFG_ID } from "@/net/dailyQuestState";
import { recruitEntryFromResponse } from "@/net/queueState";
import {
  formatMarchHint,
  formatTimeMs,
  formatTroopStacks,
  marchNeedsPoll,
  MARCH_LIST_REMAINING_TICK_MS,
  mergeCityTroops,
  unitLabel,
  type BattleReportSummary,
  type MarchSummary,
} from "@/net/militaryFormat";
import {
  extractBattleReportReplayCoord,
  formatBattleReportReplayStatusCollapsed,
  formatBattleReportReplayStatusExpanded,
} from "@/net/battleReportReplayCoord";
import {
  buildBattleReportReplaySessionFromSummary,
  canOfferBattleReportIntelJump,
  openMinimapForBattleCoords,
  writeBattleReportReplaySession,
} from "@/net/battleReportIntelReplayJump";
import {
  dispatchBattleReportListIntelJump,
  stubIntelMinimapSyncAfterReportListJump,
} from "@/net/battleReportListIntelJump";
import { resolveMarchIdForBattleReport } from "@/net/battleReportRoundSummaryIntelLink";
import { parseBattleReportLocation } from "@/net/battleReportMinimapFocus";
import { MarchEndBattleReportHint } from "@/net/battleReportDeepLink";
import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import {
  formatMarchArrivedStatusMessage,
  MARCH_ARRIVAL_VIEW_REPORT_LABEL,
  type MarchArrivalReminder,
} from "@/net/marchArrival";
import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
import { gatewayErrorMessage } from "@/net/contentFeedback";
import { CityStateFetch } from "@/net/cityStateFetch";
import { CityStatePoll } from "@/net/cityStatePoll";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import {
  formatMarchFormSummary,
  syncMarchFormInlineFeedback,
} from "@/net/marchFormSummary";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeeper";
import { setTroopRecruitFormError, syncTroopRecruitFormPreview } from "@/ui/troopRecruitForm";
import { setMarchFormErrorDisplay, validateMarchForm } from "@/net/marchFormValidation";
import {
  formatMarchFormValidationSweepLine,
  syncMarchFormValidationSweepLine,
} from "@/net/marchFormValidationSweep";
import { buildMarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import { clearMarchIntelRemarchResidualDeepSummary } from "@/net/marchIntelRemarchResidualDeep";
import {
  clearMarchIntelRemarchResidualDeeperSummary,
} from "@/net/marchIntelRemarchResidualDeeper";
import {
  clearMarchIntelRemarchResidualDeepestDeeperSummary,
} from "@/net/marchIntelRemarchResidualDeepestDeeper";
import {
  clearMarchIntelRemarchResidualDeepestDeepestDeeperSummary,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeeper";
import {
  clearMarchIntelRemarchResidualDeepestDeepestDeepestSummary,
  prefillMarchFormFromIntelResidualDeepestDeepestDeepest,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeepest";
import {
  clearMarchIntelRemarchResidualDeepestSummary,
} from "@/net/marchIntelRemarchResidualDeepest";
import { clearMarchIntelRemarchResidualSummary } from "@/net/marchIntelRemarchResidual";
import { restoreMarchTargetPrefill } from "@/net/marchTargetMemory";
import { BuildCompleteTodoTracker } from "@/net/buildCompleteTodo";
import { detectBuildJustCompleted } from "@/net/buildQueueComplete";
import {
  formatHudCenterTodoBadge,
  hudCenterTodoTitle,
  pickHudCenterTodoTarget,
  shouldSkipRepeatCenterTodoScroll,
  sumHudCenterTodoCounts,
  type HudCenterTodoCounts,
} from "@/net/hudCenterTodo";
import {
  buildSubmitStateMachine,
  formatBuildSubmitSuccess,
  type BuildSubmitState,
  walletBuildDeductPulseKeys,
} from "@/net/buildSubmitFeedback";
import {
  applyRecruitQueueJumpToMilitaryPanel,
  readRecruitHighlightQueueSession,
  resolveRecruitQueueJumpTarget,
  syncMilitaryRecruitViewQueueLink,
  writeRecruitHighlightQueueSession,
} from "@/net/recruitQueueJump";
import type { RecruitQueueEntry } from "@/net/queueState";
import {
  formatRecruitTroopSuccess,
  queueRecruitRowDomId,
  recruitTroopSubmitStateMachine,
  scheduleRecruitRowPulse,
  syncMilitaryRecruitQueueList,
  syncRecruitTroopSubmitButton,
  type RecruitTroopSubmitState,
  walletRecruitTroopDeductPulseKeys,
} from "@/net/recruitTroopSubmitFeedback";
import {
  formatMarchDepartedStatusToast,
  marchSubmitStateMachine,
  type MarchSubmitState,
  syncMarchSubmitButton,
} from "@/net/marchSubmitFeedback";
import {
  applyMarchQueueMutualHighlight,
  MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION,
  marchQueueBannerTargetFromMarch,
  openMarchPanelAndHighlight,
  openMilitaryQueueBannerAndHighlight,
  syncMarchQueueBanner,
  type MarchQueueBannerTarget,
} from "@/net/marchQueueBanner";
import {
  applyMarchFormIntelMutualHighlight,
  openMarchIntelInfoCardFromMilitary,
  openMilitaryFromMarchInfoCard as navigateMilitaryFromMarchInfoCard,
  resolveMarchFormIntelJumpIndex,
} from "@/net/marchInfoCard";
import {
  MARCH_FORM_VIEW_INTEL_INFO_ACTION,
  resolveMarchFormReadonlyStripModel,
  syncMarchFormReadonlyStripFromInput,
} from "@/net/marchFormReadonlyStrip";
import {
  buildMarchFormTroopReserveLine,
  buildScrollIntelContextFromMarchForm,
  MARCH_FORM_RESERVE_JUMP_INTEL_ACTION,
  marchFormAllowsSubmit,
  scrollIntelRowForMarchForm,
  syncMarchFormTroopReserveLine,
  type ScrollIntelRowForMarchFormContext,
} from "@/net/marchFormTroopReserve";
import {
  collectMarchBusyHeroIdsFromStatus,
  HERO_STATUS_MARCH,
  mapListPlayerHeroesForMarch,
  readMarchHeroIdRaw,
  syncMarchHeroSelect,
  type MarchHeroRow,
} from "@/net/marchHeroPick";
import { readMarchFormSnapshot } from "@/net/marchFormSummary";
import {
  createMarchFormCoordSyncTimers,
  highlightMarchFormCoordsFromIntel,
  scrollIntelRowForCoords,
  type MarchFormCoordSyncTimers,
} from "@/net/marchFormCoordSync";
import { ChatUnreadPoll } from "@/net/chatUnreadPoll";
import { ChatUnreadTracker } from "@/net/chatUnread";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";
import { HudTodoBadgePoll } from "@/net/hudTodoBadgePoll";
import type { HudTodoBadgeCounts } from "@/net/hudTodoBadge";
import {
  resolveHudTodoOpenTarget,
  type HudTodoToolbarAction,
} from "@/net/hudTodoOpenTarget";
import { buildHudCenterTodoCounts, hudTodoSocialBadgesFromChatSummary } from "@/net/hudTodoBadges";
import {
  HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  centerPanelTabToolbarAction,
  hudCenterPanelDeepLinkSegments,
  resolveCenterPanelTabFromHudTodo,
  scheduleCenterPanelTabPulse,
  type CenterPanelTabFromHudTodo,
  type HudCenterPanelDeepLinkCounts,
  type HudCenterPanelDeepLinkFacet,
} from "@/net/hudCenterPanelDeepLink";
import {
  scheduleMailTabHudSyncPulse,
  setHudCenterPanelDeepLinkRefreshStamp,
} from "@/net/mailTabUnreadSweep";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";
import {
  HUD_TODO_MERGED_SWEEP_FACET_ATTR,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  resolveToolbarPanelFromHudTodo,
  toolbarPanelActionFromHudTodo,
  type HudTodoMergedSweepCounts,
  type HudTodoMergedSweepFacet,
} from "@/net/hudTodoMergedSweep";
import { pulseHudTodoToolbarDeepLinkResidual } from "@/net/hudTodoToolbarDeepLinkResidual";
import {
  findFirstIntelInProgressMarchId,
  HUD_MILITARY_TODO_FACET_ATTR,
  HUD_MILITARY_TODO_SWEEP_CLASS,
  HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
  buildHudMilitaryTodoSweepCounts,
  hudMilitaryTodoFacetForToolbarAction,
  hudMilitaryTodoSweepSegments,
  resolveToolbarPanelFromHudMilitaryTodo,
  scheduleHudMilitaryTodoPulse,
  toolbarPanelActionFromHudMilitaryTodo,
  type HudMilitaryTodoSweepCounts,
  type HudMilitaryTodoSweepFacet,
} from "@/net/hudMilitaryTodoSweep";
import { isToolbarBadgeDeepLinkClick, setToolbarBadge, toolbarButtonLabel } from "@/ui/toolbarBadge";
import { syncToolbarAriaExpanded } from "@/ui/toolbarAriaExpanded";
import { drawWorldMinimap } from "@/ui/drawWorldMinimap";
import { applyMinimapBattleReplayPulse } from "@/ui/minimapBattleReplayPulse";
import { syncMinimapMarchStackBadgeClass } from "@/ui/minimapMarchStack";
import {
  beginMinimapIntelSyncRingForMarch,
  createMinimapIntelSyncTimers,
  highlightIntelRowForMinimapTile,
  type MinimapIntelSyncRingState,
  type MinimapIntelSyncTimers,
} from "@/ui/minimapIntelSyncHighlight";
import {
  createMinimapViewportIntelSyncTimers,
  scrollIntelListToVisibleMarch,
  type MinimapViewportIntelSyncTimers,
} from "@/net/minimapViewportIntelSync";
import {
  createMinimapViewportIntelScrollResidualTimers,
  type MinimapViewportIntelScrollResidualTimers,
} from "@/net/minimapViewportIntelScrollResidual";
import {
  createMinimapViewportIntelScrollResidualDeepTimers,
  type MinimapViewportIntelScrollResidualDeepTimers,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import {
  createMinimapViewportIntelScrollResidualDeeperTimers,
  type MinimapViewportIntelScrollResidualDeeperTimers,
} from "@/net/minimapViewportIntelScrollResidualDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestTimers,
  type MinimapViewportIntelScrollResidualDeepestTimers,
} from "@/net/minimapViewportIntelScrollResidualDeepest";
import {
  createMinimapViewportIntelScrollResidualDeepestDeeperTimers,
  type MinimapViewportIntelScrollResidualDeepestDeeperTimers,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers,
  type MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers,
  type MinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepest";
import {
  createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers,
  syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper,
  type MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper";
import {
  applyMinimapFocusPulseClass,
  highlightMinimapMarchEnd,
  type MinimapMarchEndHighlight,
  syncMinimapFocusFromTileCard,
} from "@/ui/minimapTileFocusLink";
import {
  DEFAULT_MARCH_TARGET,
  applyMarchTargetAndRemember,
  clearMarchTargetFromForm,
  marchTargetStatusMessage,
  readMarchTargetFromForm,
  resolveMarchTargetTruth,
  setMarchTargetFieldHighlight,
  syncMarchTargetSessionFromForm,
  writeMarchTargetSession,
} from "@/net/marchTargetMemory";
import {
  DEFAULT_MINIMAP_VIEW,
  applyMinimapPan,
  applyMinimapWheelZoom,
  computeMinimapWorldBounds,
  computeMinimapViewFramingPoints,
  findMarchIdForMinimapDestClick,
  type MinimapWorldPoint,
  layoutPointInMinimapMap,
  layoutPointInMinimapToggle,
  minimapLayoutToWorld,
  formatMinimapCollapsedSelectedMarchStatus,
  readMinimapCollapsedFromSession,
  writeMinimapCollapsedToSession,
  type MinimapView,
} from "@/ui/worldMinimap";
import {
  buildingBySlot,
  formatKeyBuildingHudLine,
  formatSlotBuildingCaption,
  formatWalletGainBrief,
  hasActiveBuildingUpgrade,
  KEY_BUILDING_SLOTS,
} from "@/net/hudFormat";
import { MainCityDomesticSlotStrip } from "@/ui/MainCityDomesticSlotStrip";
import { MainCitySlotUpgradeOverlay } from "@/ui/MainCitySlotUpgradeOverlay";
import { MainCityBuildingPanel } from "@/ui/MainCityBuildingPanel";
import { MainCityCityOfficePanel } from "@/ui/MainCityCityOfficePanel";
import {
  CITY_CHIEF_HALL_SLOT_KEY,
  formatCityChiefGatewayError,
  heroIdsOnActiveMarch,
  loadCityOfficeBundle,
  runClearCityChief,
  runSetCityChief,
} from "@/net/cityChiefOffice";
import {
  collectHudPulseKeysForQueueCompletes,
  refreshHudProductionWalletLine,
  type QueueCompleteHudEvent,
} from "@/net/hudQueueCompletePulse";
import {
  formatDomesticQueueCompleteSlotMarginLabel,
  scheduleDomesticQueueCompleteSlotMargin,
} from "@/net/domesticQueueCompleteSlotMargin";
import { scheduleDomesticQueueCompleteFocusResidualDeepRing } from "@/net/domesticQueueCompleteFocusResidualDeepRing";
import { scheduleDomesticQueueCompleteFocusResidualDeeperRing } from "@/net/domesticQueueCompleteFocusResidualDeeperRing";
import { scheduleDomesticQueueCompleteFocusResidualDeepestRing } from "@/net/domesticQueueCompleteFocusResidualDeepestRing";
import { scheduleDomesticQueueCompleteFocusResidualDeepestDeeperRing } from "@/net/domesticQueueCompleteFocusResidualDeepestDeeperRing";
import { scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeeperRing } from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeeperRing";
import { scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRing } from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestRing";
import { scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeeperRing } from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestDeeperRing";
import { scheduleDomesticQueueCompleteFocusResidualRing } from "@/net/domesticQueueCompleteFocusResidualRing";
import {
  collectCitySlotKeysForQueueCompleteFocus,
  scheduleCitySlotCompleteFocusRing,
} from "@/net/queueCompleteFocusRing";
import { scheduleHudResourcePulse, walletResourcePulseKeys } from "@/net/hudResourcePulse";

const SLOT_LABEL: Record<string, string> = {
  hall: "城主府",
  farm: "农田",
  lumber: "伐木场",
  quarry: "采石场",
  iron: "铁矿",
  barracks: "兵营",
  wall: "城墙",
};

const PURPOSE_ATTACK = 1;
const WALLET_GAIN_FLASH_MS = 2800;
const MINIMAP_MARCH_REFRESH_S = 5;
const MINIMAP_ETA_TICK_S = MARCH_LIST_REMAINING_TICK_MS / 1000;
/** 小地图单击与拖拽区分阈值（layout px）。 */
const MINIMAP_TAP_MOVE_THRESHOLD = 8;

export class MainCityScene implements Scene {
  readonly name = "mainCity";
  private session: MainCitySession | null = null;
  private hud!: HTMLElement;
  private toolbar!: HTMLElement;
  private militaryPanel!: HTMLElement;
  private gateway!: SceneContext["gateway"];
  private status = "";
  private lastMarch: MarchSummary | null = null;
  private marchQueueBannerTarget: MarchQueueBannerTarget | null = null;
  private marchSubmitState: MarchSubmitState = "idle";
  private marchFormHeroes: MarchHeroRow[] = [];
  private marchLocalBusyHeroIds = new Set<number>();
  private marchHeroListLoading = false;
  private marchFormIntelScrollContext: ScrollIntelRowForMarchFormContext = {
    preferredMarchId: null,
    toX: null,
    toY: null,
  };
  private buildSubmitState: BuildSubmitState = "idle";
  private recruitTroopSubmitState: RecruitTroopSubmitState = "idle";
  /** 募兵队列↔军事互跳高亮 queue_id（CLIENT-157，与 session 同步）。 */
  private recruitQueueHighlightId: number | null = null;
  private intelRemarchTroopsLine: string | null = null;
  private suppressMarchTargetHighlightClear = false;
  private readonly marchFormCoordSyncTimers: MarchFormCoordSyncTimers =
    createMarchFormCoordSyncTimers();
  private social!: SocialPanels;
  private content!: ContentPanels;
  private heroMail!: HeroMailPanels;
  private battleReports!: BattleReportPanel;
  private marchList!: MarchListPanel;
  private dailyQuest!: DailyQuestPanels;
  private world!: WorldPanels;
  private queuePanels!: QueuePanels;
  private slotUpgradeOverlay!: MainCitySlotUpgradeOverlay;
  private domesticSlotStrip!: MainCityDomesticSlotStrip;
  private buildingPanel!: MainCityBuildingPanel;
  private cityOfficePanel!: MainCityCityOfficePanel;
  private activeDomesticSlotKey: string | null = null;
  private slotOverlayRefreshAccum = 0;
  private assets!: AssetLoader;
  private getViewport!: () => LayoutViewport;
  private canvas!: HTMLCanvasElement;
  private hitDebug = "";
  private hudRefreshAccum = 0;
  private cityStateFetch!: CityStateFetch;
  private cityStatePoll!: CityStatePoll;
  private hudTodoBadgePoll!: HudTodoBadgePoll;
  private readonly chatUnreadTracker = new ChatUnreadTracker();
  private chatUnreadPoll!: ChatUnreadPoll;
  private readonly buildCompleteTodos = new BuildCompleteTodoTracker();
  /** Last focused bottom-toolbar toggle (CLIENT-135 Esc focus return). */
  private lastToolbarFocus: HTMLElement | null = null;
  private lastCenterTodoScrollKey: string | null = null;
  /** CLIENT-209：HUD 中心深链与邮件 tab 扫读共用刷新戳记。 */
  private hudCenterPanelDeepLinkRefreshStamp = 0;
  private mailTabHudSyncPulsePending = false;
  private marchArrivalPoll!: MarchArrivalPoll;
  private readonly battleReportUnread = new BattleReportUnreadSession();
  private readonly marchEndReportHint = new MarchEndBattleReportHint();
  private marchArrivalHudReminder: MarchArrivalReminder | null = null;
  private walletGainBrief: string | null = null;
  private walletGainUntilMs = 0;
  private layoutFrame!: HTMLElement;
  private minimapMarches: MarchSummary[] = [];
  private minimapView: MinimapView = { ...DEFAULT_MINIMAP_VIEW };
  private minimapMarchRefreshAccum = 0;
  private minimapPanPointerId: number | null = null;
  private minimapPanLastLayout: { x: number; y: number } | null = null;
  private minimapPanStartLayout: { x: number; y: number } | null = null;
  private minimapCollapsed = readMinimapCollapsedFromSession();
  private minimapBattleReportReplay: MinimapWorldPoint | null = null;
  /** 世界信息卡选中格（小地图高亮与视野纳入，CLIENT-073）。 */
  private minimapFocusGrid: MinimapWorldPoint | null = null;
  /** CLIENT-188：信息卡反向定位脉冲截止（`marchClockMs` 轴）。 */
  private minimapFocusPulseUntilMs = 0;
  /** CLIENT-188：军情选中行军终点叠加高亮。 */
  private minimapMarchEndHighlight: MinimapMarchEndHighlight | null = null;
  /** CLIENT-220：军情选中 → 小地图目的格 1.5s sync 环（canvas 状态）。 */
  private minimapIntelSyncRing: MinimapIntelSyncRingState | null = null;
  private readonly minimapIntelSyncTimers: MinimapIntelSyncTimers =
    createMinimapIntelSyncTimers();
  private readonly minimapViewportIntelSyncTimers: MinimapViewportIntelSyncTimers =
    createMinimapViewportIntelSyncTimers();
  private readonly minimapViewportIntelScrollResidualTimers: MinimapViewportIntelScrollResidualTimers =
    createMinimapViewportIntelScrollResidualTimers();
  private readonly minimapViewportIntelScrollResidualDeepTimers: MinimapViewportIntelScrollResidualDeepTimers =
    createMinimapViewportIntelScrollResidualDeepTimers();
  private readonly minimapViewportIntelScrollResidualDeeperTimers: MinimapViewportIntelScrollResidualDeeperTimers =
    createMinimapViewportIntelScrollResidualDeeperTimers();
  private readonly minimapViewportIntelScrollResidualDeepestTimers: MinimapViewportIntelScrollResidualDeepestTimers =
    createMinimapViewportIntelScrollResidualDeepestTimers();
  private readonly minimapViewportIntelScrollResidualDeepestDeeperTimers: MinimapViewportIntelScrollResidualDeepestDeeperTimers =
    createMinimapViewportIntelScrollResidualDeepestDeeperTimers();
  private readonly minimapViewportIntelScrollResidualDeepestDeepestDeeperTimers: MinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers =
    createMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers();
  private readonly minimapViewportIntelScrollResidualDeepestDeepestDeepestTimers: MinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers =
    createMinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers();
  private readonly minimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers: MinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers =
    createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers();
  private minimapViewportGestureActive = false;
  /** 与军情列表 {@link MarchListPanel} 共用的行军 ETA 时钟（毫秒）。 */
  private marchClockMs = Date.now();
  private minimapEtaTickAccum = 0;
  private readonly onCanvasPointerBound = (ev: PointerEvent) => this.onCanvasPointer(ev);
  private readonly onCanvasWheelBound = (ev: WheelEvent) => this.onCanvasWheel(ev);
  private readonly onHudClickBound = (ev: Event) => this.onHudClick(ev);

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.assets = ctx.assets;
    this.getViewport = ctx.getViewport;
    this.canvas = ctx.canvas;
    this.session = (data as MainCitySession) ?? null;
    this.buildCompleteTodos.reset();
    this.buildCompleteTodos.onCityBuildings(this.session?.buildings);
    this.lastCenterTodoScrollKey = null;
    this.hud = ctx.hud;
    this.gateway = ctx.gateway;
    this.layoutFrame = ctx.layoutFrame;
    this.cityStateFetch = new CityStateFetch(this.gateway, () => this.session?.cityId ?? null);
    this.cityStatePoll = new CityStatePoll({
      fetch: this.cityStateFetch,
      isPanelVisible: () => this.isAnyPanelVisible(),
      onState: (state) => this.applyCityStatePoll(state),
    });
    this.hudTodoBadgePoll = new HudTodoBadgePoll({
      gateway: this.gateway,
      getServerId: () =>
        this.session?.serverId ??
        this.gateway.getBoundServerId() ??
        this.session?.player?.server_id ??
        0,
      getCityId: () => this.session?.cityId ?? null,
      getBuildings: () => this.session?.buildings,
      getBuildCompleteCount: () => this.buildCompleteTodos.pendingCount(),
      battleReportUnread: this.battleReportUnread,
      isPanelVisible: () => this.isAnyPanelVisible(),
      isMailSuppressed: () => this.heroMail?.isMailOpen() ?? false,
      isDailySuppressed: () => this.dailyQuest?.isOpen() ?? false,
      isReportsSuppressed: () => this.battleReports?.isOpen() ?? false,
      isQueueSuppressed: () => this.queuePanels?.isOpen() ?? false,
      onCounts: (counts) => this.applyHudTodoBadgeCounts(counts),
    });
    this.marchArrivalPoll = new MarchArrivalPoll({
      getCityId: () => this.session?.cityId,
      listMarches: async (cityId) => {
        const res = (await this.gateway.listMarches(cityId, 20, 0)) as {
          marches?: MarchSummary[];
        };
        return res.marches ?? [];
      },
      onCompletions: (reminders) => this.applyMarchArrivalHudReminders(reminders),
    });
    this.renderHud();
    skinHudBar(this.hud, this.assets);
    this.toolbar = document.createElement("div");
    this.toolbar.className = "main-city-toolbar layout-toolbar";
    this.toolbar.innerHTML = `
      <div class="toolbar-scroll" data-role="toolbar-scroll">
      <div class="toolbar-scroll-inner">
      <button type="button" data-action="upgrade-farm" title="升级农田">升级</button>
      <button type="button" data-action="refresh" title="刷新状态">刷新</button>
      <button type="button" data-action="toggle-military" data-role="military-toolbar-btn" title="军事"><span class="toolbar-btn-label">军事</span></button>
      <button type="button" data-action="toggle-reports" data-role="reports-toolbar-btn"><span class="toolbar-btn-label">战报</span></button>
      <button type="button" data-action="toggle-marches" data-role="marches-toolbar-btn">行军</button>
      <button type="button" data-action="toggle-chat" data-role="chat-toolbar-btn"><span class="toolbar-btn-label">聊天</span></button>
      <button type="button" data-action="toggle-guild" data-role="guild-toolbar-btn"><span class="toolbar-btn-label">军团</span></button>
      <button type="button" data-action="toggle-rank">排行</button>
      <button type="button" data-action="toggle-quest">任务</button>
      <button type="button" data-action="toggle-daily" data-role="daily-toolbar-btn" title="日常"><span class="toolbar-btn-label">日常</span></button>
      <button type="button" data-action="toggle-bag" title="背包"><span class="toolbar-btn-label">背包</span></button>
      <button type="button" data-action="toggle-shop" title="商城"><span class="toolbar-btn-label">商城</span></button>
      <button type="button" data-action="toggle-hero" title="将领"><span class="toolbar-btn-label">将领</span></button>
      <button type="button" data-action="toggle-mail" data-role="mail-toolbar-btn" title="邮件"><span class="toolbar-btn-label">邮件</span></button>
      <button type="button" data-action="toggle-world" title="世界"><span class="toolbar-btn-label">世界</span></button>
      <button type="button" data-action="toggle-queue" data-role="queue-toolbar-btn" title="队列"><span class="toolbar-btn-label">队列</span></button>
      </div>
      </div>
    `;
    wrapToolbarButtonsForHit(this.toolbar);
    this.militaryPanel = document.createElement("div");
    this.militaryPanel.className = "military-panel hidden";
    this.militaryPanel.dataset.centerPanel = "military";
    this.militaryPanel.innerHTML = `
      <h3>军事</h3>
      <button type="button" class="march-queue-banner hidden" data-role="march-queue-banner"></button>
      <div class="march-form-readonly-strip hidden" data-role="march-form-readonly-strip" aria-live="polite">
        <p class="march-form-readonly-strip-line" data-role="march-form-readonly-strip-line"></p>
        <button type="button" class="march-form-view-intel-info hidden" data-action="${MARCH_FORM_VIEW_INTEL_INFO_ACTION}">查看军情信息卡</button>
      </div>
      <button type="button" class="march-form-troop-reserve-line hidden" data-role="march-form-troop-reserve-line" data-action="${MARCH_FORM_RESERVE_JUMP_INTEL_ACTION}" aria-live="polite"></button>
      <p class="military-troops" data-role="troops"></p>
      <div class="panel-scroll-body" data-role="military-scroll">
        <div class="military-recruit-section" data-role="military-recruit-section">
        <label>募兵兵种
          <select data-field="unit">
            <option value="1">步兵</option>
            <option value="2">骑兵</option>
            <option value="3">弓兵</option>
            <option value="4">器械</option>
          </select>
        </label>
        <label>数量 <input type="number" data-field="recruit-count" min="1" value="20" /></label>
        <p class="troop-recruit-preview" data-role="troop-recruit-preview"></p>
        <p class="march-form-error hidden" data-role="troop-recruit-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="recruit">募兵</button>
        <p class="military-recruit-view-queue hidden" data-role="recruit-view-queue-wrap">
          <button type="button" data-action="view-recruit-queue">查看队列</button>
        </p>
        <ul class="queue-list military-recruit-queue hidden" data-role="military-recruit-queue-list"></ul>
        </div>
        <hr />
        <p class="march-target-hint" data-role="march-target-hint">出征目标可从小地图空白单击或「世界」城池填入；以下坐标会记住到本次会话。</p>
        <div class="march-target-fields" data-role="march-target-fields">
          <label>目标 X <input type="number" data-field="to-x" value="${DEFAULT_MARCH_TARGET.x}" /></label>
          <label>目标 Y <input type="number" data-field="to-y" value="${DEFAULT_MARCH_TARGET.y}" /></label>
        </div>
        <p class="march-intel-last-troops hidden" data-role="march-intel-last-troops"></p>
        <p class="march-intel-remarch-residual-summary hidden" data-role="march-intel-remarch-residual-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deep-summary hidden" data-role="march-intel-remarch-residual-deep-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deeper-summary hidden" data-role="march-intel-remarch-residual-deeper-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deepest-summary hidden" data-role="march-intel-remarch-residual-deepest-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deepest-deeper-summary hidden" data-role="march-intel-remarch-residual-deepest-deeper-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deepest-deepest-deeper-summary hidden" data-role="march-intel-remarch-residual-deepest-deepest-deeper-summary" aria-live="polite"></p>
        <p class="march-intel-remarch-residual-deepest-deepest-deepest-summary hidden" data-role="march-intel-remarch-residual-deepest-deepest-deepest-summary" aria-live="polite"></p>
        <button type="button" data-action="clear-march-target">清除出征目标记忆</button>
        <label>带队将领
          <select data-field="march-hero" aria-label="出征带队将领"></select>
        </label>
        <label>出征步兵 <input type="number" data-field="march-count" min="1" value="50" /></label>
        <p class="march-form-summary" data-role="march-form-summary" aria-live="polite"></p>
        <p class="march-form-summary-warn hidden" data-role="march-form-summary-warn" role="status"></p>
        <p class="march-form-error hidden" data-role="march-form-error" role="alert"></p>
        <p class="march-form-validation-sweep-line" data-role="march-form-validation-sweep-line" aria-live="polite"></p>
        <p class="march-form-troop-margin-residual-line hidden" data-role="march-form-troop-margin-residual-line" aria-live="polite">
          <span data-role="march-form-troop-margin-residual-primary"></span>
          <span class="march-form-troop-margin-residual-subline" data-role="march-form-troop-margin-residual-subline"></span>
          <span class="march-form-troop-margin-residual-deep-line hidden" data-role="march-form-troop-margin-residual-deep-line"></span>
          <span class="march-form-troop-margin-residual-deeper-line hidden" data-role="march-form-troop-margin-residual-deeper-line"></span>
          <span class="march-form-troop-margin-residual-deepest-line hidden" data-role="march-form-troop-margin-residual-deepest-line"></span>
          <span class="march-form-troop-margin-residual-deepest-deeper-line hidden" data-role="march-form-troop-margin-residual-deepest-deeper-line"></span>
          <span class="march-form-troop-margin-residual-deepest-deepest-deeper-line hidden" data-role="march-form-troop-margin-residual-deepest-deepest-deeper-line"></span>
          <span class="march-form-troop-margin-residual-deepest-deepest-deepest-line hidden" data-role="march-form-troop-margin-residual-deepest-deepest-deepest-line"></span>
          <span class="march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line hidden" data-role="march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line"></span>
        </p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="march">出征攻击</button>
        <p class="military-march" data-role="march"></p>
      </div>
    `;
    const parent = ctx.layoutFrame;
    this.slotUpgradeOverlay = new MainCitySlotUpgradeOverlay(parent);
    this.slotUpgradeOverlay.attach();
    this.domesticSlotStrip = new MainCityDomesticSlotStrip(
      parent,
      SLOT_LABEL,
      () => this.session,
      (slotKey) => this.activateMainCitySlot(slotKey),
    );
    this.domesticSlotStrip.attach();
    parent.appendChild(this.toolbar);
    parent.appendChild(this.militaryPanel);
    this.chatUnreadTracker.onCounts = () => this.applyChatUnreadCounts();
    this.social = new SocialPanels(
      parent,
      this.gateway,
      () => this.session,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      this.chatUnreadTracker,
    );
    this.chatUnreadPoll = new ChatUnreadPoll({
      gateway: this.gateway,
      getServerId: () =>
        this.session?.serverId ??
        this.gateway.getBoundServerId() ??
        this.session?.player?.server_id ??
        0,
      getGuildId: () => this.social.getGuildId(),
      tracker: this.chatUnreadTracker,
      isPanelVisible: () => this.isAnyPanelVisible(),
    });
    this.social.attach();
    this.content = new ContentPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => this.patchSession(patch),
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      (keys) => {
        if (keys.length) scheduleHudResourcePulse(this.hud, keys);
      },
    );
    this.content.attach();
    this.dailyQuest = new DailyQuestPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => this.patchSession(patch),
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      this.cityStateFetch,
      (action) => this.navigateDailyQuest(action),
      () => this.hudTodoBadgePoll.getDeepLinkSnapshot().battleReportUnread,
      () => this.openBattleReportsFromDailyBanner(),
      () => this.openMailPanelFromDailyCrossLink(),
      () => this.session?.buildings,
      SLOT_LABEL,
      () => this.queuePanels?.getRecruitQueueSnapshot() ?? [],
      this.assets,
      (rows) => this.hudTodoBadgePoll.applyDailyChainRowsSnapshot(rows),
    );
    this.dailyQuest.attach();
    this.heroMail = new HeroMailPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => this.patchSession(patch),
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      () => {
        if (!this.heroMail?.isMailOpen()) this.hudTodoBadgePoll.recomputeToolbarCounts();
      },
      this.cityStateFetch,
      () => this.dailyQuest.refreshChainList(DAILY_RECRUIT_QUEST_CFG_ID),
      (snap) => this.hudTodoBadgePoll.applyMailUnreadSnapshot(snap.count, snap.firstId),
      (mails, unreadTotal) =>
        this.hudTodoBadgePoll.applyMailInboxSnapshot(mails, unreadTotal),
      (reportId) => {
        this.marchReportToastActive = false;
        void this.battleReports
          .openPanelWithDeepLink(reportId ?? undefined)
          .then(() => this.renderHud());
      },
      (link) => {
        if (link.recruitItemGap) {
          this.content.openBagFromRecruitItemGapDeepLink(link);
          this.status =
            link.highlightItemId > 0
              ? `背包已高亮招募所需道具 ${link.highlightItemId}（${link.bagCategory}）`
              : "背包暂无招募所需道具";
        } else {
          this.content.openBagFromHeroDeepLink(link);
          this.status = link.highlightItemId > 0
            ? `背包已高亮养成道具 ${link.highlightItemId}（${link.bagCategory}），请「使用道具」`
            : "背包暂无养成消耗品（将魂碎晶等）";
        }
        this.renderHud();
      },
      (keys) => {
        if (keys.length) scheduleHudResourcePulse(this.hud, keys);
      },
      this.assets,
      () => this.toolbarTrigger("toggle-hero"),
    );
    this.heroMail.attach();
    this.content.setBagReturnHeroDetailHandler((heroId) => {
      void this.heroMail.openHeroDetailDeepLink(heroId).then(() => this.renderHud());
    });
    this.heroMail.mountMailFilterSkins(this.assets);
    this.heroMail.mountHeroListFilterSkins(this.assets);
    this.battleReports = new BattleReportPanel(
      parent,
      this.gateway,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      {
        unreadSession: this.battleReportUnread,
        onUnreadChange: (count) => this.updateReportsToolbarBadge(count),
        onViewOnMap: (summary) => this.focusMinimapOnBattleReport(summary),
        onCoordReplay: (summary) => this.replayBattleReportOnMinimap(summary),
        onViewIntelNearReport: (summary) => this.openIntelNearBattleReport(summary),
        canOfferIntelJump: (summary) =>
          canOfferBattleReportIntelJump(this.minimapMarches, summary),
        onClearMapReplay: () => this.clearBattleReportMinimapReplay(),
        onOpenRelatedMail: (mailId) => {
          this.heroMail.openAndHighlightMail(mailId);
          this.renderHud();
        },
        getDailyChainRows: () => {
          const fromPanel = this.dailyQuest.getRowsSnapshot();
          if (fromPanel.length) return fromPanel;
          return this.hudTodoBadgePoll.getDeepLinkSnapshot().dailyChainRows;
        },
        onOpenRelatedDaily: (questCfgId) => {
          this.dailyQuest.openAndFocusQuest(questCfgId);
          this.status = "已打开「日常」并定位对应日课（只读，不自动领奖）";
          this.renderHud();
        },
        getBattleReportLinkContext: () => ({
          viewerPlayerId: this.session?.player?.player_id,
          viewerHeroes: this.heroMail.getHeroesSnapshot(),
        }),
        onOpenBattleReportHero: (heroId) => {
          this.heroMail.openAndHighlightHero(heroId);
          this.status = `已打开「将领」详情 #${heroId}（战报互链）`;
          this.renderHud();
        },
        onOpenBattleReportRank: (playerId) => {
          this.social.openPowerRankHighlightEntity(playerId);
          this.status = `已打开「排行」并高亮玩家#${playerId}`;
          this.renderHud();
        },
        onBattleReportReadonlyHint: (message) => {
          this.status = message;
          this.renderHud();
        },
        onOpenReplayWorldTile: (summary) => this.openWorldTileFromBattleReport(summary),
        onListIntelJump: (summary) => this.jumpFromBattleReportListToIntelOrMinimap(summary),
        filterListSkinAssets: this.assets,
      },
    );
    this.battleReports.attach();
    this.marchList = new MarchListPanel(
      parent,
      this.gateway,
      () => this.session?.cityId,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      {
        assets: this.assets,
        nowMs: () => this.marchClockMs,
        getWorldSelectedGrid: () => this.world?.getSelectedGrid() ?? null,
        onMarchesUpdated: (marches) => {
          this.minimapMarches = marches;
          if (this.activeDomesticSlotKey === CITY_CHIEF_HALL_SLOT_KEY) {
            this.cityOfficePanel?.setMarchingHeroIds(heroIdsOnActiveMarch(marches));
          }
          this.world?.refreshMarchDestCounts();
        },
        onMarchArrivalReminders: (reminders) => this.applyMarchArrivalHudReminders(reminders),
        onRemarchFromRow: (march) => this.openMilitaryFromIntelRemarch(march),
        onOpenMilitaryQueueBanner: (marchId) => this.openMilitaryQueueBannerHighlight(marchId),
        onViewMarchDestTile: (march) => {
          const tx = march.to_x;
          const ty = march.to_y;
          if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
            this.status = "该行缺少有效目的格点";
            this.renderHud();
            return;
          }
          this.world.openAndFocusTile(tx!, ty!);
          this.focusMinimapOnWorldGrid(tx!, ty!);
          this.status = `世界：已定位军情目的格 (${tx},${ty})`;
          this.renderHud();
        },
        onOpenMilitaryFromInfoCard: (march) => this.handleOpenMilitaryFromMarchInfoCard(march),
        onReplayBattleReportFromInfoCard: (_march, reportId) => {
          if (!this.battleReports.isOpen()) this.battleReports.openPanel();
          void this.battleReports.openPanelWithDeepLink(reportId).then(() => this.renderHud());
          this.status = `战报：已定位 #${reportId}（军情复盘互链）`;
          this.renderHud();
        },
        onSelectionChange: (march) => {
          this.syncMilitaryPanel();
          this.world?.syncIntelEtaResidualHighlightFromMarch(march);
          highlightMarchFormCoordsFromIntel(this.militaryPanel, march, {
            timers: this.marchFormCoordSyncTimers,
          });
          this.minimapMarchEndHighlight = highlightMinimapMarchEnd(march);
          this.minimapIntelSyncRing = beginMinimapIntelSyncRingForMarch(march, this.layoutFrame, {
            timers: this.minimapIntelSyncTimers,
            nowMs: this.marchClockMs,
          });
          if (march) {
            const tx = march.to_x;
            const ty = march.to_y;
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
              this.world.setMarchDestHighlight({ x: tx, y: ty });
              this.syncMinimapViewportForIntelSelection(march);
            } else {
              this.world.setMarchDestHighlight(null);
            }
            let base: string;
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
              base = `军情联动：行军 #${march.march_id ?? "?"}（无目的坐标）`;
            } else if (this.minimapCollapsed) {
              base = formatMinimapCollapsedSelectedMarchStatus(march, this.marchClockMs);
            } else {
              base = `小地图联动：行军 #${march.march_id ?? "?"}`;
            }
            this.status =
              Number.isFinite(tx) && Number.isFinite(ty)
                ? appendManhattanToStatus(
                    base,
                    this.session?.cityX,
                    this.session?.cityY,
                    tx,
                    ty,
                  )
                : base;
          } else {
            this.world.setMarchDestHighlight(null);
            this.minimapIntelSyncRing = null;
          }
          this.renderHud();
        },
      },
    );
    this.marchList.attach();
    this.world = new WorldPanels(
      parent,
      this.gateway,
      () => this.session,
      {
        marchFormRoot: this.militaryPanel,
        onFilled: (x, y) => {
          this.militaryPanel.classList.remove("hidden");
          setMarchTargetFieldHighlight(this.militaryPanel, false);
          this.renderHud();
          this.syncMilitaryPanel();
        },
      },
      (msg) => {
        const grid = this.world.getSelectedGrid();
        this.status =
          grid != null
            ? appendManhattanToStatus(
                msg,
                this.session?.cityX,
                this.session?.cityY,
                grid.x,
                grid.y,
              )
            : msg;
        this.renderHud();
      },
      {
        onGridSelectionChange: (grid) => {
          this.marchList.syncWorldGridSelection(grid);
          this.world?.syncIntelEtaResidualHighlightFromMarch(this.marchList.getSelectedMarch());
          if (grid) {
            this.focusMinimapOnWorldGrid(grid.x, grid.y);
          } else {
            this.clearMinimapWorldGridFocus();
          }
        },
        getSelectedIntelMarch: () => this.marchList.getSelectedMarch(),
        getIntelPanelRoot: () => this.marchList.getRoot(),
        getMarchesSnapshot: () => {
          const fromPanel = this.marchList.getMarches();
          return fromPanel.length ? fromPanel : this.minimapMarches;
        },
        onMarchCountClick: (grid) => {
          const opened = this.marchList.selectMarchByDest(grid.x, grid.y);
          if (opened) {
            this.pulseIntelRowFromMinimapTile(grid.x, grid.y);
            this.status = `军情：已选中指向 (${grid.x},${grid.y}) 的首条行军`;
          } else {
            this.status = `格点 (${grid.x},${grid.y}) 暂无进行中行军`;
          }
          this.renderHud();
        },
        onViewMarchesAtGrid: (grid) => {
          this.marchList.openIntelViewForGrid(grid.x, grid.y);
          this.pulseIntelRowFromMinimapTile(grid.x, grid.y);
          this.status = `军情：已筛选目的格 (${grid.x},${grid.y})`;
          this.renderHud();
        },
        getBattleReportsSnapshot: () => this.battleReports.getReportsSnapshot(),
        onCenterMinimapAtGrid: (grid) => {
          this.applyMinimapFocusFromWorldTileCard(grid);
        },
        onViewBattleReportsAtGrid: (grid, hintReportId) => {
          void this.battleReports.openListFilteredByGrid(grid.x, grid.y, hintReportId);
          this.status = `战报：已筛选战场格点 (${grid.x},${grid.y})`;
          this.renderHud();
        },
        assets: this.assets,
      },
    );
    this.world.attach();
    this.wireSocialRankDeepLinks();
    const skinCenterPrimary = (root: HTMLElement) => skinPrimaryButtons(root, this.assets);
    this.queuePanels = new QueuePanels(
      parent,
      this.gateway,
      () => this.session,
      SLOT_LABEL,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
      () => {
        this.renderHud();
      },
      () => this.syncMilitaryPanel(),
      () => {
        const fromPanel = this.dailyQuest.getRowsSnapshot();
        if (fromPanel.length) return fromPanel;
        return this.hudTodoBadgePoll.getDeepLinkSnapshot().dailyChainRows;
      },
      (questCfgId) => {
        this.dailyQuest.openAndFocusQuest(questCfgId);
        this.status = "已打开「日常」并定位对应建造日课";
        this.renderHud();
      },
      skinCenterPrimary,
      (slotKey) => this.onQueueBuildSlotHighlightChange(slotKey),
      () => this.toolbarTrigger("toggle-queue"),
      (entry) => this.openMilitaryRecruitFromQueueRow(entry),
      (slotKey) => {
        const building = buildingBySlot(this.session?.buildings, slotKey);
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        highlightDomesticSlotForQueueRow(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
          building,
        );
      },
      (queueIds) => {
        const events = queueIds.map((id) => ({ kind: "recruit" as const, queueId: id }));
        this.applyQueueCompleteHudPulse(events);
        this.applyQueueCompleteFocusRing(events);
      },
      (open) => this.onQueuePanelVisibilityChange(open),
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotCompleteMarginResidualRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeeperRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepestRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepestDeeperRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
      (slotKey) => {
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRing(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
        );
      },
    );
    this.queuePanels.attach();
    this.buildingPanel = new MainCityBuildingPanel(
      parent,
      SLOT_LABEL,
      () => this.session,
      (slotKey, buildingCfgId) => void this.startBuildingUpgrade(slotKey, buildingCfgId),
      () => this.buildSubmitState,
      (root) => skinDefaultPanel(root, this.assets, 380, 300),
      () => this.buildingDismissTrigger(),
    );
    this.buildingPanel.attach();
    this.cityOfficePanel = new MainCityCityOfficePanel({
      onAppoint: (heroId) => void this.appointCityChief(heroId),
      onClear: () => void this.clearCityChief(),
    });
    this.cityOfficePanel.mountInto(this.buildingPanel.getRoot());
    skinToolbarBar(this.toolbar, this.assets);
    skinToolbarButtons(this.toolbar, this.assets);
    mountToolbarIcons(this.toolbar, this.assets);
    skinPrimaryButtons(this.militaryPanel, this.assets);
    skinDefaultPanel(this.buildingPanel.getRoot(), this.assets, 380, 300);
    skinPrimaryButtons(this.buildingPanel.getRoot(), this.assets);
    skinMilitaryPanel(this.militaryPanel, this.assets, 420, 320);
    skinMarchIntelPanel(this.marchList.getRoot(), this.assets, 520, 320);
    skinBattleReportPanel(this.battleReports.getRoot(), this.assets, 520, 360);
    skinMilitaryPanel(this.queuePanels.getMilitarySectionRoot(), this.assets, 480, 160);
    this.heroMail.mountHeroPanelArtShell(this.assets);
    skinBagPanel(this.content.getBagRoot(), this.assets, 520, 320);
    skinShopPanel(this.content.getShopRoot(), this.assets, 520, 320);
    skinQueuePanel(this.queuePanels.getRoot(), this.assets, 520, 320);
    skinMailPanel(this.heroMail.getMailRoot(), this.assets, 520, 320);
    skinDailyPanel(this.dailyQuest.getRoot(), this.assets, 520, 320);
    registerArtFilter008EvidenceHooks(this.assets);
    remountPanelFilterChips(this.heroMail.getMailRoot(), this.assets);
    remountPanelFilterChips(this.dailyQuest.getRoot(), this.assets);
    remountPanelFilterChips(this.battleReports.getRoot(), this.assets);
    mountFilterListPanelSkins(this.heroMail.getMailRoot(), this.assets);
    mountFilterListPanelSkins(this.dailyQuest.getRoot(), this.assets);
    mountFilterListPanelSkins(this.marchList.getRoot(), this.assets);
    mountFilterListPanelSkins(this.battleReports.getRoot(), this.assets);
    skinWorldPanel(this.world.getRoot(), this.assets, 520, 320);
    skinRankPanel(this.social.getRankRoot(), this.assets, 520, 320);
    skinGuildPanel(this.social.getGuildRoot(), this.assets, 520, 320);
    skinChatPanel(this.social.getChatRoot(), this.assets, 520, 320);
    skinCenterPrimary(this.heroMail.getHeroRoot());
    skinCenterPrimary(this.content.getBagRoot());
    skinCenterPrimary(this.content.getShopRoot());
    skinCenterPrimary(this.queuePanels.getRoot());
    skinCenterPrimary(this.heroMail.getMailRoot());
    skinCenterPrimary(this.dailyQuest.getRoot());
    skinCenterPrimary(this.world.getRoot());
    skinCenterPrimary(this.social.getRankRoot());
    skinCenterPrimary(this.social.getGuildRoot());
    skinCenterPrimary(this.social.getChatRoot());
    this.toolbar.addEventListener("focusin", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button[data-action]");
      if (btn instanceof HTMLElement) this.lastToolbarFocus = btn;
    });
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.militaryPanel.addEventListener("change", (ev) => this.onMilitaryRecruitFieldChange(ev));
    this.militaryPanel.addEventListener("input", (ev) => {
      this.onMilitaryRecruitFieldChange(ev);
      this.onMilitaryFormInput(ev);
      const field = (ev.target as HTMLElement).getAttribute("data-field");
      if (field === "unit" || field === "recruit-count" || field === "march-hero") {
        this.syncMilitaryPanel();
      }
    });
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerBound);
    this.canvas.addEventListener("wheel", this.onCanvasWheelBound, { passive: false });
    this.canvas.addEventListener("pointermove", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointerup", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointercancel", this.onCanvasPointerBound);
    this.hud.addEventListener("click", this.onHudClickBound);
    restoreMarchTargetPrefill(
      this.militaryPanel,
      DEFAULT_MARCH_TARGET,
      typeof sessionStorage !== "undefined" ? sessionStorage : null,
      this.marchFormFeedbackContext(),
    );
    this.syncMinimapFocusFromMarchTarget();
    this.syncMilitaryPanel();
    this.queuePanels?.setBuildCompleteTodoSlots(this.buildCompleteTodos.pendingSlotKeys());
    void this.hudTodoBadgePoll.pollOnce();
    void this.chatUnreadPoll.pollOnce();
    void this.refreshMinimapMarches();
    void this.refreshMarchFormHeroes();
    this.syncSlotUpgradeOverlay();
  }

  update(dt: number): void {
    if (!this.session || !this.militaryPanel) return;
    this.cityStatePoll?.tick(dt);
    this.hudTodoBadgePoll?.tick(dt);
    this.chatUnreadPoll?.tick(dt);
    this.marchArrivalPoll?.tick(dt);
    this.minimapMarchRefreshAccum += dt;
    if (this.minimapMarchRefreshAccum >= MINIMAP_MARCH_REFRESH_S) {
      this.minimapMarchRefreshAccum = 0;
      void this.refreshMinimapMarches();
    }
    this.minimapEtaTickAccum += dt;
    if (this.minimapEtaTickAccum >= MINIMAP_ETA_TICK_S) {
      this.minimapEtaTickAccum = 0;
      if (marchNeedsPoll(this.minimapMarches)) {
        this.marchClockMs = Date.now();
        this.syncMinimapCollapsedMarchStatus();
      }
      if (this.militaryPanel && !this.militaryPanel.classList.contains("hidden")) {
        this.syncMilitaryPanel();
      }
    }
    if (this.queuePanels?.isOpen()) {
      this.queuePanels.tick(dt);
    }
    if (hasActiveBuildingUpgrade(this.session.buildings)) {
      this.hudRefreshAccum += dt;
      this.slotOverlayRefreshAccum += dt;
      if (this.hudRefreshAccum >= 1) {
        this.hudRefreshAccum = 0;
        this.renderHud();
      }
      if (this.slotOverlayRefreshAccum >= 1) {
        this.slotOverlayRefreshAccum = 0;
        this.syncSlotUpgradeOverlay();
      }
    } else {
      this.hudRefreshAccum = 0;
      this.slotOverlayRefreshAccum = 0;
      this.syncSlotUpgradeOverlay();
    }
    if (this.walletGainBrief && Date.now() > this.walletGainUntilMs) {
      this.walletGainBrief = null;
      this.renderHud();
    }
  }

  leave(): void {
    this.cityStateFetch?.clear();
    this.hudTodoBadgePoll?.reset();
    this.chatUnreadPoll?.reset();
    this.buildCompleteTodos.reset();
    this.lastCenterTodoScrollKey = null;
    this.marchArrivalPoll?.reset();
    this.hud?.removeEventListener("click", this.onHudClickBound);
    this.canvas?.removeEventListener("pointerdown", this.onCanvasPointerBound);
    this.canvas?.removeEventListener("wheel", this.onCanvasWheelBound);
    this.canvas?.removeEventListener("pointermove", this.onCanvasPointerBound);
    this.canvas?.removeEventListener("pointerup", this.onCanvasPointerBound);
    this.canvas?.removeEventListener("pointercancel", this.onCanvasPointerBound);
    this.social?.detach();
    this.content?.detach();
    this.heroMail?.detach();
    this.battleReports?.detach();
    this.marchList?.detach();
    this.dailyQuest?.detach();
    this.world?.detach();
    this.queuePanels?.detach();
    this.buildingPanel?.detach();
    this.domesticSlotStrip?.detach();
    this.slotUpgradeOverlay?.detach();
    if (this.hud) clearHudBarChrome(this.hud);
    if (this.toolbar) clearToolbarBarChrome(this.toolbar);
    this.toolbar?.remove();
    this.militaryPanel?.remove();
  }

  private openMailPanelFromDailyCrossLink(): void {
    this.heroMail.openMailPanel();
    this.renderHud();
  }

  private openBattleReportsFromDailyBanner(): void {
    this.marchArrivalHudReminder = null;
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    void this.battleReports
      .openPanelWithDeepLink(snap.firstUnreadBattleReportId)
      .then(() => {
        this.dailyQuest.syncBattleReportUnreadBanner();
        this.renderHud();
      });
  }

  private navigateDailyQuest(action: DailyQuestNavAction): void {
    const queueAnchorQuest = this.dailyQuest.getSelectedQuestRow();
    const queueAnchorTarget = resolveDailyQueueAnchorTarget(
      queueAnchorQuest,
      this.session?.buildings,
      this.queuePanels.getRecruitQueueSnapshot(),
    );
    switch (action.kind) {
      case "train_troops":
        this.queuePanels.open();
        this.queuePanels.flashDailyQueueAnchorHighlight(queueAnchorTarget);
        this.militaryPanel.classList.remove("hidden");
        this.syncMilitaryPanel();
        this.status = "已打开「队列」与「军事」募兵（练兵日常 QUEST-003）";
        break;
      case "build_level":
        this.queuePanels.open();
        this.queuePanels.flashDailyQueueAnchorHighlight(queueAnchorTarget);
        this.status = "已打开「队列」；点选主城建筑或「升级农田」完成建造日常";
        break;
      case "use_item":
        this.content.openBagHighlightItem(action.itemCfgId);
        this.status = `背包已高亮 item_cfg_id=${action.itemCfgId}，请「使用道具」`;
        break;
      case "recruit_hero":
        this.heroMail.toggleHero();
        this.status = "已打开「将领」招募（访贤日常）";
        break;
      case "collect_resource":
        this.status = "资源采集日常由服务端自动累计，可点「刷新状态」查看 HUD";
        break;
      default:
        break;
    }
    this.renderHud();
  }

  private onToolbarClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (isToolbarBadgeDeepLinkClick(ev)) {
      if (action === "toggle-chat") {
        const social = hudTodoSocialBadgesFromChatSummary(
          this.chatUnreadTracker.getSummary(this.social.getGuildId()),
        );
        if (social.chatToolbar > 0) {
          if (!this.social.isChatOpen()) this.social.toggleChat();
          this.pulseToolbarPanelDeepLink("social");
          return;
        }
      }
      const toolbarAction = action as HudTodoToolbarAction | null;
      if (
        toolbarAction === "toggle-mail" ||
        toolbarAction === "toggle-daily" ||
        toolbarAction === "toggle-queue" ||
        toolbarAction === "toggle-reports"
      ) {
        const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
        const target = resolveHudTodoOpenTarget(
          toolbarAction,
          snap,
          this.session?.buildings,
        );
        if (target.kind === "mail") {
          this.heroMail.openFromTodoBadge(target.mailId, {
            mailFilter: target.mailFilter,
            filterTabCounts: {
              unreadForTab: target.unreadForTab,
              unclaimedCount: target.unclaimedCount,
            },
          });
          this.pulseToolbarPanelDeepLink("mail");
          return;
        }
        if (target.kind === "daily") {
          this.dailyQuest.openFromTodoBadge(target.cfgId, {
            listFilter: target.listFilter,
            claimableCount: target.claimableCount,
          });
          this.updateDailyToolbarBadge(0);
          this.pulseToolbarPanelDeepLink("daily");
          return;
        }
        if (target.kind === "queue-building") {
          this.queuePanels.openFromTodoBadge(target.slotKey);
          this.updateQueueToolbarBadge(0);
          this.pulseToolbarPanelDeepLink("queue");
          return;
        }
        if (target.kind === "battle-report") {
          this.marchArrivalHudReminder = null;
          void this.battleReports
            .openPanelWithDeepLink(target.reportId)
            .then(() => this.renderHud());
          this.pulseHudMilitaryTodoForFacet("reports");
          return;
        }
      }
      const militaryCounts = this.hudMilitaryTodoSweepCounts();
      const militaryFacet = hudMilitaryTodoFacetForToolbarAction(action ?? "", militaryCounts);
      if (militaryFacet) {
        this.openHudMilitaryTodoDeepLink(militaryFacet);
        return;
      }
    }
    if (action === "upgrade-farm") {
      this.resetBuildSubmitState();
      this.buildingPanel.selectSlot("farm");
      this.status = "建造：农田";
      this.renderHud();
    }
    if (action === "refresh") void this.refreshState();
    if (action === "toggle-military") {
      this.militaryPanel.classList.toggle("hidden");
      if (!this.militaryPanel.classList.contains("hidden")) {
        resetCenterPanelViewportScroll(this.militaryPanel);
        void this.refreshMarchFormHeroes();
      }
      this.syncMilitaryPanel();
    }
    if (action === "toggle-reports") {
      this.marchArrivalHudReminder = null;
      this.battleReports.toggle();
    }
    if (action === "toggle-marches") {
      this.content.capturePanelReturnSourceBeforeRankIntel("intel");
      this.marchList.toggle();
    }
    if (action === "toggle-chat") this.social.toggleChat();
    if (action === "toggle-guild") this.social.toggleGuild();
    if (action === "toggle-rank") {
      this.content.capturePanelReturnSourceBeforeRankIntel("rank");
      this.social.toggleRank();
    }
    if (action === "toggle-quest") this.content.toggleQuest();
    if (action === "toggle-daily") {
      this.dailyQuest.toggle();
      if (this.dailyQuest.isOpen()) this.updateDailyToolbarBadge(0);
      else void this.hudTodoBadgePoll.pollOnce();
    }
    if (action === "toggle-bag") this.content.toggleBag();
    if (action === "toggle-shop") this.content.toggleShop();
    if (action === "toggle-hero") this.heroMail.toggleHero();
    if (action === "toggle-mail") {
      this.heroMail.toggleMail();
      if (this.heroMail.isMailOpen()) this.bumpMailTabHudSyncFromPoll(false);
      else void this.hudTodoBadgePoll.pollOnce();
    }
    if (action === "toggle-world") this.world.toggle();
    if (action === "toggle-queue") {
      this.queuePanels.toggle();
      if (this.queuePanels.isOpen()) this.updateQueueToolbarBadge(0);
      else this.hudTodoBadgePoll.recomputeToolbarCounts();
    }
  }

  private onMilitaryClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const recruitLi = target.closest(
      '[data-role="military-recruit-queue-list"] li.queue-list-row[data-queue-id]',
    );
    if (recruitLi instanceof HTMLElement) {
      const qid = Number(recruitLi.dataset.queueId) || 0;
      if (qid > 0) this.openRecruitQueueAndHighlight(qid);
      return;
    }
    const btn = target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION) {
      const marchId = Number(btn.getAttribute("data-march-id"));
      if (marchId > 0) this.openMarchIntelPanelHighlight(marchId);
      return;
    }
    if (action === MARCH_FORM_VIEW_INTEL_INFO_ACTION) {
      const marchId = Number(btn.getAttribute("data-march-id"));
      if (marchId > 0) this.openMarchIntelFromFormStrip(marchId);
      return;
    }
    if (action === MARCH_FORM_RESERVE_JUMP_INTEL_ACTION) {
      this.openMarchIntelFromTroopReserveWarn();
      return;
    }
    if (action === "view-recruit-queue") {
      const qid = Number(btn.dataset.queueId) || this.recruitQueueHighlightId || 0;
      if (qid > 0) this.openRecruitQueueAndHighlight(qid);
      return;
    }
    if (action === "recruit") void this.recruit();
    if (action === "march") void this.startMarch();
    if (action === "clear-march-target") {
      clearMarchTargetFromForm(this.militaryPanel);
      this.clearMinimapWorldGridFocus();
      this.intelRemarchTroopsLine = null;
      clearMarchIntelRemarchResidualSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeepestDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeepestDeepestSummary(this.militaryPanel);
      this.marchList.clearRecentMarchHighlight();
      this.status = "已清除出征目标记忆，表单恢复默认坐标";
      this.renderHud();
      this.syncMilitaryPanel();
    }
  }

  private onMilitaryFormInput(ev: Event): void {
    const field = (ev.target as HTMLElement).getAttribute("data-field");
    if (field !== "to-x" && field !== "to-y" && field !== "march-count" && field !== "march-hero") {
      return;
    }
    if (field === "to-x" || field === "to-y") {
      if (!this.suppressMarchTargetHighlightClear) {
        this.marchList.clearRecentMarchHighlight();
        this.intelRemarchTroopsLine = null;
        clearMarchIntelRemarchResidualSummary(this.militaryPanel);
        clearMarchIntelRemarchResidualDeepSummary(this.militaryPanel);
        clearMarchIntelRemarchResidualDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeepestDeeperSummary(this.militaryPanel);
      clearMarchIntelRemarchResidualDeepestDeepestDeepestSummary(this.militaryPanel);
      }
      syncMarchTargetSessionFromForm(this.militaryPanel);
      this.syncMinimapFocusFromMarchTarget();
      this.syncIntelListFromMarchFormCoords();
    }
    this.syncMilitaryPanel();
  }

  private syncIntelListFromMarchFormCoords(): void {
    const coords = readMarchTargetFromForm(this.militaryPanel);
    if (!coords) return;
    scrollIntelRowForCoords(
      this.marchList.getPanelElement(),
      this.marchList.getMarches(),
      coords.x,
      coords.y,
      { timers: this.marchFormCoordSyncTimers, assets: this.assets },
    );
  }

  private openMarchIntelFromTroopReserveWarn(): void {
    const marches = this.marchList.getMarches();
    const marchId = scrollIntelRowForMarchForm(
      this.marchList.getPanelElement(),
      marches,
      this.marchFormIntelScrollContext,
      { timers: this.marchFormCoordSyncTimers, assets: this.assets },
    );
    if (marchId == null || marchId <= 0) {
      this.status = "军情：暂无与出征表单关联的行军可定位";
      this.renderHud();
      return;
    }
    this.openMarchIntelFromFormStrip(marchId);
    this.status = `军情：已定位行军 #${marchId}（出征兵力余量警示互跳）`;
    this.renderHud();
  }

  private openMarchIntelFromFormStrip(marchId: number): void {
    const layoutFrame = document.getElementById("layout-frame");
    openMarchIntelInfoCardFromMilitary(marchId, {
      openMarchIntel: (id) => {
        this.marchList.selectMarchById(id, { openPanel: true });
        this.status = `军情：已打开信息卡并选中行军 #${id}（军事汇总互跳）`;
        this.renderHud();
      },
      highlightIntel: (jump) => {
        if (layoutFrame) {
          applyMarchFormIntelMutualHighlight(layoutFrame, jump, "intel-card");
          applyMarchFormIntelMutualHighlight(layoutFrame, jump, "intel-row");
        }
      },
      scrollInfoCardIntoView: () => {
        this.marchList
          .getPanelElement()
          ?.querySelector('[data-role="march-info-card"]')
          ?.scrollIntoView?.({ block: "nearest" });
      },
    });
    if (layoutFrame) {
      const jump = resolveMarchFormIntelJumpIndex(marchId);
      applyMarchFormIntelMutualHighlight(layoutFrame, jump, "military-strip");
    }
    this.syncMilitaryPanel();
  }

  private handleOpenMilitaryFromMarchInfoCard(march: MarchSummary): void {
    const layoutFrame = document.getElementById("layout-frame");
    navigateMilitaryFromMarchInfoCard(march, {
      openMilitaryWithMarch: (m) => this.openMilitaryFromIntelRemarch(m),
      highlightMilitaryStrip: (jump) => {
        if (layoutFrame) applyMarchFormIntelMutualHighlight(layoutFrame, jump, "military-strip");
      },
    });
    this.status = `军事：已从军情信息卡预填目的格（行军 #${march.march_id ?? "?"})`;
    this.renderHud();
  }

  private openMarchIntelPanelHighlight(marchId: number): void {
    const layoutFrame = document.getElementById("layout-frame");
    openMarchPanelAndHighlight(marchId, {
      openMarchIntel: (id) => {
        this.marchList.selectMarchById(id, { openPanel: true });
        this.status = `军情：已定位行军 #${id}（军事队列摘要互跳）`;
        this.renderHud();
      },
      highlightIntelRow: (jump) => {
        if (layoutFrame) applyMarchQueueMutualHighlight(layoutFrame, jump, "intel-row");
      },
    });
  }

  private openMilitaryQueueBannerHighlight(marchId: number): void {
    const layoutFrame = document.getElementById("layout-frame");
    openMilitaryQueueBannerAndHighlight(marchId, {
      openMilitaryPanel: () => {
        this.militaryPanel.classList.remove("hidden");
        resetCenterPanelViewportScroll(this.militaryPanel);
      },
      highlightMilitaryBanner: (jump) => {
        if (layoutFrame) applyMarchQueueMutualHighlight(layoutFrame, jump, "military-banner");
        const banner = this.militaryPanel.querySelector<HTMLElement>(
          `#${CSS.escape(jump.bannerDomId)}`,
        );
        banner?.scrollIntoView?.({ block: "nearest" });
      },
    });
    this.status = `军事：队列顶栏已定位行军 #${marchId}`;
    this.renderHud();
  }

  private openMilitaryFromIntelRemarch(march: MarchSummary): void {
    if (!buildMarchIntelRemarchPrefill(march)) {
      this.status = "该行缺少有效目的格点，无法再出征";
      this.renderHud();
      return;
    }
    this.militaryPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.militaryPanel);
    this.suppressMarchTargetHighlightClear = true;
    const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeepest(
      this.militaryPanel,
      march,
      this.marchFormFeedbackContext(),
    )!;
    this.suppressMarchTargetHighlightClear = false;
    this.intelRemarchTroopsLine = prefill.lastTroopsSummary;
    setMarchTargetFieldHighlight(this.militaryPanel, false);
    this.status = marchTargetStatusMessage("march_intel", prefill.toX, prefill.toY);
    this.syncMilitaryPanel();
    this.renderHud();
  }

  private field(name: string): HTMLInputElement | HTMLSelectElement | null {
    return this.militaryPanel.querySelector(`[data-field="${name}"]`);
  }

  private syncMilitaryPanel(): void {
    const troopsEl = this.militaryPanel.querySelector('[data-role="troops"]');
    const marchEl = this.militaryPanel.querySelector('[data-role="march"]');
    const hintEl = this.militaryPanel.querySelector('[data-role="march-target-hint"]');
    if (troopsEl) {
      troopsEl.textContent = `城内兵力：${formatTroopStacks(this.session?.cityTroops)}`;
    }
    if (marchEl) {
      marchEl.textContent = this.lastMarch ? formatMarchHint(this.lastMarch) : "暂无行军";
    }
    if (hintEl) {
      const fields = this.militaryPanel.querySelector('[data-role="march-target-fields"]');
      const highlighted = fields?.classList.contains("march-target-field-highlight");
      hintEl.textContent = highlighted
        ? "小地图选点已填入下方目标坐标（高亮）；与世界城池点选冲突时以最后一次操作为准。"
        : "出征目标可从小地图空白单击或「世界」城池填入；以下坐标会记住到本次会话。";
    }
    const lastTroopsEl = this.militaryPanel.querySelector('[data-role="march-intel-last-troops"]');
    if (lastTroopsEl) {
      const line = this.intelRemarchTroopsLine;
      lastTroopsEl.textContent = line ?? "";
      lastTroopsEl.classList.toggle("hidden", !line);
    }
    const marchSnap = readMarchFormSnapshot(this.militaryPanel, {
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      wallet: this.session?.wallet,
    });
    const troopReserve = buildMarchFormTroopReserveLine(
      marchSnap.marchCountRaw,
      this.session?.cityTroops ?? [],
    );
    syncMarchFormTroopReserveLine(this.militaryPanel, troopReserve);
    const stripModel = resolveMarchFormReadonlyStripModel({
      intelSelectedMarch: this.marchList.getSelectedMarch(),
      queueBannerMarchId: this.marchQueueBannerTarget?.march_id ?? null,
      queueBannerMarch:
        this.marchQueueBannerTarget?.march_id != null
          ? this.minimapMarches.find((m) => m.march_id === this.marchQueueBannerTarget?.march_id) ??
            null
          : null,
      formRoot: this.militaryPanel,
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      wallet: this.session?.wallet,
      nowMs: this.marchClockMs,
    });
    this.marchFormIntelScrollContext = buildScrollIntelContextFromMarchForm(
      stripModel.jumpMarchId,
      {
        toXRaw: marchSnap.toXRaw,
        toYRaw: marchSnap.toYRaw,
      },
    );
    const marchValidated = validateMarchForm({
      toXRaw: marchSnap.toXRaw,
      toYRaw: marchSnap.toYRaw,
      marchCountRaw: marchSnap.marchCountRaw,
      heroIdRaw: marchSnap.heroIdRaw,
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      cityTroops: this.session?.cityTroops ?? [],
    });
    syncMarchSubmitButton(
      this.militaryPanel,
      this.marchSubmitState,
      marchFormAllowsSubmit(marchValidated, troopReserve),
    );
    const recruitPreview = syncTroopRecruitFormPreview(this.militaryPanel, this.session?.wallet);
    syncRecruitTroopSubmitButton(
      this.militaryPanel,
      this.recruitTroopSubmitState,
      recruitPreview?.canAfford ?? false,
    );
    const recruitSnapshot = this.queuePanels?.getRecruitQueueSnapshot() ?? [];
    const highlightId =
      this.recruitQueueHighlightId ??
      readRecruitHighlightQueueSession() ??
      this.queuePanels?.getHighlightedRecruitQueueId() ??
      null;
    syncMilitaryRecruitQueueList(this.militaryPanel, recruitSnapshot, Date.now(), highlightId);
    syncMilitaryRecruitViewQueueLink(
      this.militaryPanel,
      recruitSnapshot,
      highlightId,
    );
    syncMarchFormInlineFeedback(this.militaryPanel, this.marchFormFeedbackContext());
    syncMarchFormValidationSweepLine(
      this.militaryPanel,
      formatMarchFormValidationSweepLine(marchValidated, troopReserve, {
        toXRaw: marchSnap.toXRaw,
        toYRaw: marchSnap.toYRaw,
      }),
    );
    const marchSummary = formatMarchFormSummary(marchSnap, this.marchClockMs);
    syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
      this.militaryPanel,
      formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
        troopReserve,
        marchSummary,
        this.session?.wallet,
      ),
    );
    syncMarchQueueBanner(this.militaryPanel, this.marchQueueBannerTarget);
    const queueId = this.marchQueueBannerTarget?.march_id ?? null;
    syncMarchFormReadonlyStripFromInput(this.militaryPanel, {
      intelSelectedMarch: this.marchList.getSelectedMarch(),
      queueBannerMarchId: queueId,
      queueBannerMarch:
        queueId != null ? this.minimapMarches.find((m) => m.march_id === queueId) ?? null : null,
      formRoot: this.militaryPanel,
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      wallet: this.session?.wallet,
      nowMs: this.marchClockMs,
    });
  }

  private marchFormFeedbackContext() {
    return {
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      cityTroops: this.session?.cityTroops ?? [],
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      wallet: this.session?.wallet,
      clockMs: this.marchClockMs,
    };
  }

  private isNarrowLayout(): boolean {
    return isNarrowLayoutViewport(this.getViewport());
  }

  private currentMinimapLayoutRect() {
    return resolveMinimapExpandedLayoutRect(this.isNarrowLayout());
  }

  /** 打开队列面板并高亮募兵行（session `recruit-highlight-queue-id`）。 */
  openRecruitQueueAndHighlight(queueId: number): void {
    if (queueId <= 0) return;
    writeRecruitHighlightQueueSession(queueId);
    this.recruitQueueHighlightId = queueId;
    this.queuePanels.openAndHighlightRecruitQueue(queueId);
    this.syncMilitaryPanel();
    this.renderHud();
  }

  private openMilitaryRecruitFromQueueRow(entry: RecruitQueueEntry): void {
    const target = resolveRecruitQueueJumpTarget(
      entry.queue_id,
      this.queuePanels.getRecruitQueueSnapshot(),
    );
    if (!target) return;
    writeRecruitHighlightQueueSession(target.queue_id);
    this.recruitQueueHighlightId = target.queue_id;
    this.militaryPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.militaryPanel);
    applyRecruitQueueJumpToMilitaryPanel(this.militaryPanel, target);
    this.queuePanels.highlightRecruitQueue(target.queue_id);
    syncTroopRecruitFormPreview(this.militaryPanel, this.session?.wallet);
    this.syncMilitaryPanel();
    this.renderHud();
  }

  private onMilitaryRecruitFieldChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (!t.matches('[data-field="unit"], [data-field="recruit-count"]')) return;
    this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
      type: "CLEAR_ERROR",
    });
    this.syncMilitaryPanel();
  }

  private minimapBoundsExtra(): MinimapWorldPoint[] {
    const out: MinimapWorldPoint[] = [];
    if (this.minimapBattleReportReplay) out.push(this.minimapBattleReportReplay);
    if (this.minimapFocusGrid) out.push(this.minimapFocusGrid);
    return out;
  }

  private currentMinimapWorldBounds() {
    return computeMinimapWorldBounds(
      this.session?.cityX,
      this.session?.cityY,
      this.minimapMarches,
      this.marchList?.getSelectedMarch(),
      this.minimapBoundsExtra(),
    );
  }

  private syncMinimapViewportForIntelSelection(march: MarchSummary): void {
    const bounds = this.currentMinimapWorldBounds();
    const synced = syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper(
      {
        march,
        bounds,
        currentView: this.minimapView,
        layoutFrame: this.layoutFrame,
        intelRoot: this.marchList.getRoot(),
      },
      {
        viewportTimers: this.minimapViewportIntelSyncTimers,
        residualTimers: this.minimapViewportIntelScrollResidualTimers,
        residualDeepTimers: this.minimapViewportIntelScrollResidualDeepTimers,
        residualDeeperTimers: this.minimapViewportIntelScrollResidualDeeperTimers,
        residualDeepestTimers: this.minimapViewportIntelScrollResidualDeepestTimers,
        residualDeepestDeeperTimers: this.minimapViewportIntelScrollResidualDeepestDeeperTimers,
        residualDeepestDeepestDeeperTimers:
          this.minimapViewportIntelScrollResidualDeepestDeepestDeeperTimers,
        residualDeepestDeepestDeepestTimers:
          this.minimapViewportIntelScrollResidualDeepestDeepestDeepestTimers,
        residualDeepestDeepestDeepestDeeperTimers:
          this.minimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers,
      },
    );
    if (synced.applied) {
      this.minimapView = synced.view;
    }
  }

  private flushMinimapViewportIntelListScroll(): void {
    if (this.minimapCollapsed) return;
    const panelMarches = this.marchList.getMarches();
    const marches = panelMarches.length ? panelMarches : this.minimapMarches;
    scrollIntelListToVisibleMarch({
      intelRoot: this.marchList.getRoot(),
      marches,
      ownCityX: this.session?.cityX,
      ownCityY: this.session?.cityY,
      bounds: this.currentMinimapWorldBounds(),
      rect: this.currentMinimapLayoutRect(),
      view: this.minimapView,
      preferredMarchId: this.marchList.getSelectedMarch()?.march_id ?? null,
    });
  }

  private focusMinimapOnWorldGrid(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.minimapFocusGrid = { wx: x, wy: y };
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = computeMinimapViewFramingPoints(bounds, [{ wx: x, wy: y }]);
  }

  /** CLIENT-188：格点信息卡点击 → 居中视野 + 2s `minimap-focus-pulse`。 */
  private applyMinimapFocusFromWorldTileCard(grid: { x: number; y: number }): void {
    const bounds = this.currentMinimapWorldBounds();
    const synced = syncMinimapFocusFromTileCard(grid, bounds, this.marchClockMs);
    this.minimapFocusGrid = synced.focusGrid;
    this.minimapView = synced.view;
    this.minimapFocusPulseUntilMs = synced.focusPulseUntilMs;
    applyMinimapFocusPulseClass(this.layoutFrame);
  }

  private clearMinimapWorldGridFocus(): void {
    this.minimapFocusGrid = null;
  }

  private focusMinimapOnBattleReport(summary: BattleReportSummary): void {
    const location = parseBattleReportLocation(summary);
    if (!location) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    const bounds = this.currentMinimapWorldBounds();
    const applied = openMinimapForBattleCoords({
      location,
      bounds,
      currentView: this.minimapView,
      minimapCollapsed: this.minimapCollapsed,
    });
    this.minimapCollapsed = applied.minimapCollapsed;
    this.minimapBattleReportReplay = applied.focus.replay;
    this.minimapFocusGrid = applied.focus.focusGrid;
    this.minimapView = applied.focus.view;
    this.world?.selectGridAt(location.x, location.y);
    this.status = applied.focus.status;
    this.renderHud();
  }

  /** CLIENT-191：坐标复盘 → 世界面板 + 小地图脉冲 + session 互链。 */
  private replayBattleReportOnMinimap(summary: BattleReportSummary): void {
    const location = parseBattleReportLocation(summary);
    if (!location) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    this.world.openPanel();
    const bounds = this.currentMinimapWorldBounds();
    const applied = openMinimapForBattleCoords({
      location,
      bounds,
      currentView: this.minimapView,
      minimapCollapsed: this.minimapCollapsed,
    });
    this.minimapCollapsed = applied.minimapCollapsed;
    this.minimapBattleReportReplay = applied.focus.replay;
    this.minimapFocusGrid = applied.focus.focusGrid;
    this.minimapView = applied.focus.view;
    this.world.selectGridAt(location.x, location.y);
    applyMinimapBattleReplayPulse(document.getElementById("layout-frame"));
    const session = buildBattleReportReplaySessionFromSummary(summary);
    if (session) writeBattleReportReplaySession(session);
    this.status = applied.focus.status;
    this.renderHud();
  }

  /** CLIENT-223：战报列表坐标标签 → 军情或小地图（CLIENT-191/142 详情互链不退化）。 */
  private jumpFromBattleReportListToIntelOrMinimap(summary: BattleReportSummary): void {
    const location = parseBattleReportLocation(summary);
    if (!location) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    const session = buildBattleReportReplaySessionFromSummary(summary);
    if (session) writeBattleReportReplaySession(session);
    const mode = dispatchBattleReportListIntelJump(summary, this.minimapMarches, {
      openIntelMarch: (marchId) => this.openMarchIntelPanelHighlight(marchId),
      openMinimapAtCoords: () => this.replayBattleReportOnMinimap(summary),
      afterIntelJumpSyncStub: stubIntelMinimapSyncAfterReportListJump,
    });
    if (mode === "intel") {
      this.status = `军情：已选中与战报坐标 ${location.x},${location.y} 匹配的行军`;
    } else if (mode === "minimap") {
      /* replayBattleReportOnMinimap 已写入 status */
    } else {
      this.status = "战报缺少有效战场坐标";
    }
    this.renderHud();
  }

  private openIntelNearBattleReport(summary: BattleReportSummary): void {
    const location = parseBattleReportLocation(summary);
    if (!location) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    const session = buildBattleReportReplaySessionFromSummary(summary);
    if (session) writeBattleReportReplaySession(session);
    const marchId = resolveMarchIdForBattleReport(this.minimapMarches, summary);
    if (marchId == null) {
      this.status = "军情列表无同坐标行军可匹配";
      this.renderHud();
      return;
    }
    this.openMarchIntelPanelHighlight(marchId);
    this.status = `军情：已选中行军 #${marchId}（战报坐标 ${location.x},${location.y}）`;
    this.renderHud();
  }

  private openWorldTileFromBattleReport(summary: BattleReportSummary): void {
    const coord = extractBattleReportReplayCoord(summary);
    if (!coord) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    this.world.openPanel();
    this.world.selectGridAt(coord.wx, coord.wy);
    this.focusMinimapOnWorldGrid(coord.wx, coord.wy);
    this.status = `已打开世界格点信息 (${coord.wx},${coord.wy})`;
    this.renderHud();
  }

  private clearBattleReportMinimapReplay(): void {
    this.minimapBattleReportReplay = null;
  }

  private layoutFromPointerEvent(ev: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = ev.clientX - rect.left;
    const cssY = ev.clientY - rect.top;
    return canvasToLayout(cssX, cssY, this.getViewport());
  }

  private onCanvasWheel(ev: WheelEvent): void {
    const layout = this.layoutFromPointerEvent(ev);
    if (!layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed, this.isNarrowLayout()))
      return;
    ev.preventDefault();
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = applyMinimapWheelZoom(
      this.minimapView,
      bounds,
      layout.x,
      layout.y,
      ev.deltaY,
    );
    this.flushMinimapViewportIntelListScroll();
  }

  private onCanvasPointer(ev: PointerEvent): void {
    const layout = this.layoutFromPointerEvent(ev);

    if (ev.type === "pointermove" && this.minimapPanPointerId === ev.pointerId && this.minimapPanLastLayout) {
      const dx = layout.x - this.minimapPanLastLayout.x;
      const dy = layout.y - this.minimapPanLastLayout.y;
      const bounds = this.currentMinimapWorldBounds();
      this.minimapView = applyMinimapPan(this.minimapView, bounds, dx, dy);
      this.minimapPanLastLayout = layout;
      this.minimapViewportGestureActive = true;
      return;
    }

    if (ev.type === "pointerup" || ev.type === "pointercancel") {
      if (this.minimapPanPointerId === ev.pointerId) {
        const start = this.minimapPanStartLayout;
        if (
          start &&
          layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed, this.isNarrowLayout())
        ) {
          const dx = layout.x - start.x;
          const dy = layout.y - start.y;
          if (dx * dx + dy * dy <= MINIMAP_TAP_MOVE_THRESHOLD * MINIMAP_TAP_MOVE_THRESHOLD) {
            this.applyMinimapMarchTargetPick(layout.x, layout.y);
          }
        }
        if (this.minimapViewportGestureActive) {
          this.flushMinimapViewportIntelListScroll();
        }
        this.minimapViewportGestureActive = false;
        this.minimapPanPointerId = null;
        this.minimapPanLastLayout = null;
        this.minimapPanStartLayout = null;
      }
      return;
    }

    if (ev.type !== "pointerdown") return;

    if (layoutPointInMinimapToggle(layout.x, layout.y, this.minimapCollapsed, this.isNarrowLayout())) {
      this.minimapCollapsed = !this.minimapCollapsed;
      writeMinimapCollapsedToSession(this.minimapCollapsed);
      if (this.minimapBattleReportReplay) {
        this.status = this.minimapCollapsed
          ? formatBattleReportReplayStatusCollapsed(this.minimapBattleReportReplay)
          : formatBattleReportReplayStatusExpanded(this.minimapBattleReportReplay);
      } else if (this.minimapCollapsed) {
        const selected = this.marchList?.getSelectedMarch();
        this.status = selected
          ? formatMinimapCollapsedSelectedMarchStatus(selected, this.marchClockMs)
          : "小地图已折叠";
      } else {
        this.status = "小地图已展开";
      }
      this.renderHud();
      return;
    }

    if (layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed, this.isNarrowLayout())) {
      const marchId = findMarchIdForMinimapDestClick(
        layout.x,
        layout.y,
        this.minimapMarches,
        this.session?.cityX,
        this.session?.cityY,
        this.minimapView,
        this.currentMinimapLayoutRect(),
      );
      if (marchId != null) {
        this.marchList.selectMarchById(marchId, { openPanel: true });
        const march = this.minimapMarches.find((m) => m.march_id === marchId);
        const tx = march?.to_x;
        const ty = march?.to_y;
        if (Number.isFinite(tx) && Number.isFinite(ty)) {
          this.pulseIntelRowFromMinimapTile(tx!, ty!, marchId);
        }
        this.status = `小地图选中行军 #${marchId}`;
        this.renderHud();
        return;
      }
      this.minimapPanPointerId = ev.pointerId;
      this.minimapPanLastLayout = layout;
      this.minimapPanStartLayout = layout;
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const hits = [...MAIN_CITY_SLOTS]
      .sort((a, b) => b.z - a.z)
      .filter((slot) => this.pointInRect(layout, slot.hit));
    const top = hits[0];
    if (!top) return;
    this.hitDebug = top.slot_key;
    this.activateMainCitySlot(top.slot_key);
  }

  private activateMainCitySlot(slotKey: string): void {
    const key = slotKey.trim();
    if (!key) return;
    this.domesticSlotStrip?.setSelectedSlotKey(key);
    captureDomesticSlotScrollAnchor(this.domesticSlotStrip?.getStripRoot(), key);
    const building = buildingBySlot(this.session?.buildings, key);
    const now = Date.now();
    if ((building?.upgrade_finish_at_ms ?? 0) > now) {
      this.queuePanels.openAndHighlightBuildSlot(key);
      const label = SLOT_LABEL[key] ?? key;
      this.status = `队列：${label} 升级进行中`;
      this.renderHud();
      return;
    }
    this.resetBuildSubmitState();
    this.queuePanels.clearBuildSlotHighlight();
    this.activeDomesticSlotKey = key;
    this.buildingPanel.selectSlot(key, {
      dismissTrigger: this.buildingDismissTrigger(),
    });
    this.syncCityOfficePanelForSlot(key);
    this.queuePanels.pulseQueueRowForOverlaySlot(key);
    this.status = `建造：${SLOT_LABEL[key] ?? key}`;
    this.renderHud();
  }

  private syncCityOfficePanelForSlot(slotKey: string): void {
    const showHall = slotKey === CITY_CHIEF_HALL_SLOT_KEY;
    this.cityOfficePanel?.setVisibleForHallSlot(showHall ? slotKey : null);
    if (showHall) void this.refreshCityOfficePanel();
  }

  private async refreshCityOfficePanel(): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    this.cityOfficePanel.setPhase("loading");
    this.cityOfficePanel.setFormError(null);
    try {
      const bundle = await loadCityOfficeBundle(
        this.gateway,
        session.serverId,
        session.cityId,
        this.minimapMarches,
      );
      this.cityOfficePanel.setMarchingHeroIds(bundle.marchingHeroIds);
      this.cityOfficePanel.setHeroes(bundle.heroes);
      this.cityOfficePanel.setChiefView(bundle.chief);
    } catch (e) {
      this.cityOfficePanel.setFormError(formatCityChiefGatewayError(e));
    } finally {
      this.cityOfficePanel.setPhase("idle");
    }
  }

  private async appointCityChief(heroId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId || heroId <= 0 || !this.cityOfficePanel) return;
    this.cityOfficePanel.setPhase("appointing");
    this.cityOfficePanel.setFormError(null);
    const { chief, error } = await runSetCityChief(
      this.gateway,
      session.serverId,
      session.cityId,
      heroId,
    );
    this.cityOfficePanel.setChiefView(chief);
    if (error) this.cityOfficePanel.setFormError(error);
    else this.status = "城主已任命";
    this.cityOfficePanel.setPhase("idle");
    this.renderHud();
  }

  private async clearCityChief(): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    this.cityOfficePanel.setPhase("clearing");
    this.cityOfficePanel.setFormError(null);
    const { chief, error } = await runClearCityChief(
      this.gateway,
      session.serverId,
      session.cityId,
    );
    this.cityOfficePanel.setChiefView(chief);
    if (error) this.cityOfficePanel.setFormError(error);
    else this.status = "城主已卸任";
    this.cityOfficePanel.setPhase("idle");
    this.renderHud();
  }

  private onQueueBuildSlotHighlightChange(slotKey: string | null): void {
    this.slotUpgradeOverlay?.setMutualHighlightSlot(slotKey);
    this.domesticSlotStrip?.setSelectedSlotKey(slotKey);
    if (this.queuePanels?.isOpen() && slotKey) {
      captureDomesticSlotScrollAnchor(this.domesticSlotStrip?.getStripRoot(), slotKey);
    }
  }

  private onQueuePanelVisibilityChange(open: boolean): void {
    if (open) {
      const slotKey =
        this.queuePanels.getHighlightedBuildSlotKey() ??
        this.domesticSlotStrip?.getSelectedSlotKey();
      if (slotKey) {
        captureDomesticSlotScrollAnchor(this.domesticSlotStrip?.getStripRoot(), slotKey);
      }
      return;
    }
    this.domesticSlotStrip?.sync();
    restoreDomesticSlotScrollAnchor(
      this.domesticSlotStrip?.getStripRoot(),
      this.slotUpgradeOverlay?.getOverlayLayer(),
    );
  }

  private pointInRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
    return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  }

  private syncMinimapCollapsedMarchStatus(): void {
    if (!this.minimapCollapsed) return;
    const selected = this.marchList?.getSelectedMarch();
    if (!selected) return;
    const base = formatMinimapCollapsedSelectedMarchStatus(selected, this.marchClockMs);
    const tx = selected.to_x;
    const ty = selected.to_y;
    this.status =
      Number.isFinite(tx) && Number.isFinite(ty)
        ? appendManhattanToStatus(
            base,
            this.session?.cityX,
            this.session?.cityY,
            tx,
            ty,
          )
        : base;
    this.renderHud();
  }

  private pulseIntelRowFromMinimapTile(wx: number, wy: number, marchId?: number): void {
    const panelMarches = this.marchList.getMarches();
    const marches = panelMarches.length ? panelMarches : this.minimapMarches;
    highlightIntelRowForMinimapTile(this.marchList.getRoot(), marches, wx, wy, {
      marchId,
      timers: this.minimapIntelSyncTimers,
    });
  }

  private applyMinimapMarchTargetPick(layoutX: number, layoutY: number): void {
    const bounds = computeMinimapWorldBounds(
      this.session?.cityX,
      this.session?.cityY,
      this.minimapMarches,
      this.marchList?.getSelectedMarch(),
    );
    const world = minimapLayoutToWorld(
      layoutX,
      layoutY,
      bounds,
      this.currentMinimapLayoutRect(),
      this.minimapView,
    );
    if (!world) return;
    if (
      !applyMarchTargetAndRemember(this.militaryPanel, world.wx, world.wy, {
        source: "minimap",
      })
    ) {
      return;
    }
    this.world?.selectGridAt(world.wx, world.wy, { source: "minimap" });
    this.focusMinimapOnWorldGrid(world.wx, world.wy);
    this.militaryPanel.classList.remove("hidden");
    this.status = marchTargetStatusMessage("minimap", world.wx, world.wy);
    this.renderHud();
    this.syncMilitaryPanel();
  }

  /** 军事面板 to_x/to_y 与 marchTargetMemory 对齐后，小地图 focus 环与角标同源。 */
  private syncMinimapFocusFromMarchTarget(): void {
    const truth = resolveMarchTargetTruth(this.militaryPanel);
    if (truth) {
      this.focusMinimapOnWorldGrid(truth.x, truth.y);
    } else {
      this.clearMinimapWorldGridFocus();
    }
  }

  private async refreshMinimapMarches(): Promise<void> {
    const cityId = this.session?.cityId;
    if (!cityId) return;
    try {
      const res = (await this.gateway.listMarches(cityId, 20, 0)) as {
        marches?: MarchSummary[];
      };
      this.minimapMarches = res.marches ?? [];
      this.marchList?.syncMinimapMarchFocusFromSnapshot(this.minimapMarches);
      this.world?.refreshMarchDestCounts();
    } catch {
      /* 小地图只读：失败时保留上次数据 */
    }
  }

  private async syncSessionCityCoords(): Promise<void> {
    if (!this.session) return;
    try {
      const list = (await this.gateway.listPlayerCities()) as {
        cities?: { city_id?: number; x?: number; y?: number }[];
      };
      const city = list.cities?.find((c) => c.city_id === this.session?.cityId);
      if (city) {
        this.session.cityX = city.x ?? this.session.cityX;
        this.session.cityY = city.y ?? this.session.cityY;
      }
    } catch {
      /* ignore */
    }
  }

  private patchSession(patch: Partial<MainCitySession>, opts?: { flashWalletGain?: boolean }): void {
    if (!this.session) return;
    const beforeWallet = this.session.wallet;
    const pulseKeys =
      patch.wallet !== undefined ? walletResourcePulseKeys(beforeWallet, patch.wallet) : [];
    Object.assign(this.session, patch);
    const flash = opts?.flashWalletGain !== false;
    if (flash && patch.wallet !== undefined) {
      const brief = formatWalletGainBrief(beforeWallet, this.session.wallet);
      if (brief) {
        this.walletGainBrief = brief;
        this.walletGainUntilMs = Date.now() + WALLET_GAIN_FLASH_MS;
      }
    }
    this.renderHud();
    if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
    if (patch.wallet !== undefined || patch.bag !== undefined) {
      this.heroMail?.refreshRecruitAffordability();
    }
    if (patch.wallet !== undefined || patch.buildings !== undefined) {
      this.buildingPanel?.sync();
    }
    if (patch.wallet !== undefined) {
      this.syncMilitaryPanel();
    }
  }

  private isAnyPanelVisible(): boolean {
    if (this.buildingPanel?.isOpen()) return true;
    if (this.militaryPanel && !this.militaryPanel.classList.contains("hidden")) return true;
    if (this.layoutFrame.querySelector(".social-panel:not(.hidden)") !== null) return true;
    return this.layoutFrame.querySelector(".content-panel:not(.hidden)") !== null;
  }

  private syncSlotUpgradeOverlay(): void {
    this.slotUpgradeOverlay?.sync(this.session?.buildings, Date.now());
    this.domesticSlotStrip?.sync();
  }

  private applyCityStateFromFetch(state: {
    wallet?: ResourceWallet;
    buildings?: CityBuilding[];
    production_rates?: ResourceWallet;
  }): void {
    if (!this.session) return;
    const prevBuildings = this.session.buildings;
    const nowMs = Date.now();
    let justCompleted: string[] = [];
    if (state.buildings) {
      justCompleted = detectBuildJustCompleted(prevBuildings, state.buildings, nowMs);
      this.buildCompleteTodos.onCityBuildings(state.buildings, nowMs);
      this.queuePanels?.setBuildCompleteTodoSlots(this.buildCompleteTodos.pendingSlotKeys());
      this.hudTodoBadgePoll?.recomputeToolbarCounts();
      this.renderHud();
    }
    const afterWallet = state.wallet ?? this.session.wallet;
    this.patchSession(
      {
        wallet: afterWallet,
        buildings: state.buildings ?? this.session.buildings,
        productionRates: state.production_rates ?? this.session.productionRates,
      },
      { flashWalletGain: false },
    );
    const buildCompleteEvents = justCompleted.map((slotKey) => ({
      kind: "build" as const,
      slotKey,
    }));
    if (justCompleted.length) {
      this.queuePanels?.notifyBuildJustCompleted(justCompleted);
      this.applyQueueCompleteHudPulse(buildCompleteEvents);
    }
    this.syncSlotUpgradeOverlay();
    if (buildCompleteEvents.length) {
      this.applyQueueCompleteFocusRing(buildCompleteEvents);
    }
    this.slotUpgradeOverlay?.setMutualHighlightSlot(
      this.queuePanels?.getHighlightedBuildSlotKey() ?? null,
    );
  }

  private applyCityStatePoll(state: {
    wallet?: ResourceWallet;
    buildings?: CityBuilding[];
    production_rates?: ResourceWallet;
  }): void {
    this.applyCityStateFromFetch(state);
  }

  /** CLIENT-181：队列完成 → 顶栏资源脉冲 + 产出/仓库扫读次行刷新。 */
  private applyQueueCompleteHudPulse(events: readonly QueueCompleteHudEvent[]): void {
    if (!events.length || !this.session) return;
    const pulseKeys = collectHudPulseKeysForQueueCompletes(events, sessionStorage);
    refreshHudProductionWalletLine(this.hud, this.session.productionRates, this.session.wallet);
    if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
  }

  /** CLIENT-197 / CLIENT-212 / CLIENT-244 / CLIENT-260 / CLIENT-276 / CLIENT-292 / CLIENT-308 / CLIENT-324 / CLIENT-340：队列完成 → 七槽焦点环 + 残余/深/更深/最深/最深再加深二层/三层/四层环 + 完成态余量扫读。 */
  private applyQueueCompleteFocusRing(events: readonly QueueCompleteHudEvent[]): void {
    const slotKeys = collectCitySlotKeysForQueueCompleteFocus(events, sessionStorage);
    if (!slotKeys.length) return;
    const layer = this.slotUpgradeOverlay?.getOverlayLayer();
    const nowMs = Date.now();
    const buildings = this.session?.buildings;
    for (const key of slotKeys) {
      scheduleCitySlotCompleteFocusRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeeperRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepestRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepestDeeperRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeeperRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRing(layer, key);
      scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeeperRing(layer, key);
      const label = formatDomesticQueueCompleteSlotMarginLabel(
        buildingBySlot(buildings, key),
        nowMs,
      );
      scheduleDomesticQueueCompleteSlotMargin(layer, key, label);
    }
  }

  private renderHud(): void {
    const s = this.session;
    const now = Date.now();
    if (this.walletGainBrief && now > this.walletGainUntilMs) {
      this.walletGainBrief = null;
    }
    const p = s?.player;
    const troopHint = formatTroopStacks(s?.cityTroops);
    const dprTag = `art ${this.assets.getTextureScale()}× @${this.assets.getDevicePixelRatio().toFixed(1)}dpr`;
    const groups: string[] = [
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1}`,
    ];
    if (this.walletGainBrief) groups.push(this.walletGainBrief);
    groups.push(formatKeyBuildingHudLine(s?.buildings, SLOT_LABEL, ["hall", "farm"], now));
    if (troopHint !== "无") groups.push(`兵 ${troopHint}`);
    if (this.hitDebug) groups.push(`点选 ${SLOT_LABEL[this.hitDebug] ?? this.hitDebug}`);
    groups.push(dprTag);
    if (this.status) groups.push(this.status);

    const resourceStripExpanded = readHudResourceStripExpanded(this.hud);
    this.hud.replaceChildren();
    appendHudResourceStrip(this.hud, s?.wallet, this.assets, s?.productionRates);
    restoreHudResourceStripExpanded(this.hud, resourceStripExpanded);
    this.appendHudCenterTodoBadge();
    this.appendHudCenterPanelDeepLinkLine();
    this.appendHudMilitaryTodoSweepLine();
    for (const text of groups) {
      const span = document.createElement("span");
      span.className =
        text === this.walletGainBrief ? "hud-group hud-wallet-gain" : "hud-group";
      span.textContent = text;
      this.hud.appendChild(span);
    }
    if (this.marchArrivalHudReminder) {
      const wrap = document.createElement("span");
      wrap.className = "hud-group hud-march-arrival-toast";
      const msg = document.createElement("span");
      msg.className = "hud-march-arrival-msg";
      msg.textContent = formatMarchArrivedStatusMessage(
        this.marchArrivalHudReminder.marchId,
        this.marchArrivalHudReminder.toX,
        this.marchArrivalHudReminder.toY,
      );
      wrap.appendChild(msg);
      const link = document.createElement("button");
      link.type = "button";
      link.className = "hud-march-report-toast";
      link.textContent = MARCH_ARRIVAL_VIEW_REPORT_LABEL;
      link.setAttribute("data-action", "open-march-reports");
      link.setAttribute("title", "打开战报列表");
      wrap.appendChild(link);
      this.hud.appendChild(wrap);
    }
    this.syncToolbarChromeA11y();
  }

  private panelRootOpen(el: HTMLElement | null | undefined): boolean {
    return !!el && !el.classList.contains("hidden");
  }

  private toolbarTrigger(action: string): HTMLElement | null {
    return this.toolbar?.querySelector<HTMLElement>(`button[data-action="${action}"]`) ?? null;
  }

  private buildingDismissTrigger(): HTMLElement | null {
    return this.lastToolbarFocus ?? this.toolbarTrigger("toggle-queue");
  }

  private syncToolbarChromeA11y(): void {
    if (!this.toolbar) return;
    syncToolbarAriaExpanded(this.toolbar, {
      military: this.panelRootOpen(this.militaryPanel),
      reports: this.battleReports?.isOpen() ?? false,
      marches: this.marchList?.isOpen() ?? false,
      chat: this.social?.isChatOpen() ?? false,
      guild: this.social?.isGuildOpen() ?? false,
      rank: this.panelRootOpen(this.social?.getRankRoot()),
      quest: this.panelRootOpen(
        this.layoutFrame?.querySelector<HTMLElement>('.content-panel[data-center-panel="quest"]'),
      ),
      daily: this.dailyQuest?.isOpen() ?? false,
      bag: this.panelRootOpen(this.content?.getBagRoot()),
      shop: this.panelRootOpen(this.content?.getShopRoot()),
      hero: this.panelRootOpen(this.heroMail?.getHeroRoot()),
      mail: this.heroMail?.isMailOpen() ?? false,
      world: this.panelRootOpen(this.world?.getRoot()),
      queue: this.queuePanels?.isOpen() ?? false,
    });
  }

  private applyMarchArrivalHudReminders(reminders: MarchArrivalReminder[]): void {
    if (!reminders.length) return;
    const last = reminders[reminders.length - 1]!;
    this.marchArrivalHudReminder = last;
    if (last.reportId) {
      this.marchEndReportHint.setReportId(last.reportId);
    } else {
      void this.seedMarchEndBattleReportHint();
    }
    this.renderHud();
    void this.hudTodoBadgePoll.pollOnce();
  }

  private onHudClick(ev: Event): void {
    const militaryFacetBtn = (ev.target as HTMLElement).closest(
      `[${HUD_MILITARY_TODO_FACET_ATTR}]`,
    );
    if (militaryFacetBtn instanceof HTMLElement) {
      const militaryFacet = militaryFacetBtn.getAttribute(
        HUD_MILITARY_TODO_FACET_ATTR,
      ) as HudMilitaryTodoSweepFacet | null;
      if (militaryFacet) {
        this.openHudMilitaryTodoDeepLink(militaryFacet);
        return;
      }
    }
    const facetBtn = (ev.target as HTMLElement).closest(
      `[${HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR}], [${HUD_TODO_MERGED_SWEEP_FACET_ATTR}]`,
    );
    if (facetBtn instanceof HTMLElement) {
      const facet = (facetBtn.getAttribute(HUD_TODO_MERGED_SWEEP_FACET_ATTR) ??
        facetBtn.getAttribute(HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR)) as
        | HudCenterPanelDeepLinkFacet
        | null;
      if (facet) {
        this.openHudCenterPanelDeepLink(facet);
        return;
      }
    }
    const todoBtn = (ev.target as HTMLElement).closest('[data-action="open-hud-center-todo"]');
    if (todoBtn) {
      this.openHudCenterTodoDeepLink();
      return;
    }
    const el = (ev.target as HTMLElement).closest('[data-action="open-march-reports"]');
    if (!el) return;
    const reportHint =
      this.marchArrivalHudReminder?.reportId ?? this.marchEndReportHint.peek();
    this.marchArrivalHudReminder = null;
    const hint = reportHint ?? this.marchEndReportHint.consume();
    void this.battleReports.openPanelWithDeepLink(hint).then(() => this.renderHud());
    this.renderHud();
  }

  private centerTodoCountsFromSnapshot(): HudCenterTodoCounts {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    return buildHudCenterTodoCounts({
      mailClaimablePage: snap.mailClaimablePage,
      dailyRows: snap.dailyChainRows,
      buildCompleteCount: this.buildCompleteTodos.pendingCount(),
    });
  }

  private hudTodoMergedSweepCounts(): HudTodoMergedSweepCounts {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    const social = this.social
      ? hudTodoSocialBadgesFromChatSummary(
          this.chatUnreadTracker.getSummary(this.social.getGuildId()),
        )
      : { chat: 0, world: 0, guild: 0 };
    return {
      mailClaimable: snap.mailClaimable,
      dailyClaimable: snap.dailyClaimable,
      queueBuilding: snap.queueBuilding,
      chatUnread: social.chat ?? 0,
    };
  }

  private hudMilitaryTodoSweepCounts(): HudMilitaryTodoSweepCounts {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    const marchSnap = readMarchFormSnapshot(this.militaryPanel, {
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      wallet: this.session?.wallet,
    });
    const troopReserve = buildMarchFormTroopReserveLine(
      marchSnap.marchCountRaw,
      this.session?.cityTroops ?? [],
    );
    const marchValidated = validateMarchForm({
      toXRaw: marchSnap.toXRaw,
      toYRaw: marchSnap.toYRaw,
      marchCountRaw: marchSnap.marchCountRaw,
      heroIdRaw: marchSnap.heroIdRaw,
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      cityTroops: this.session?.cityTroops ?? [],
    });
    return buildHudMilitaryTodoSweepCounts({
      marches: this.minimapMarches,
      battleReportUnread: snap.battleReportUnread,
      marchSubmitState: this.marchSubmitState,
      marchFormValidation: marchValidated,
      troopReserve,
    });
  }

  private centerPanelDeepLinkCounts(): HudCenterPanelDeepLinkCounts {
    return this.hudTodoMergedSweepCounts();
  }

  private appendHudCenterPanelDeepLinkLine(): void {
    const counts = this.centerPanelDeepLinkCounts();
    const segments = hudCenterPanelDeepLinkSegments(counts);
    if (!segments.length) return;
    const wrap = document.createElement("span");
    wrap.className = "hud-center-panel-deeplink hud-todo-merged-sweep";
    wrap.setAttribute("data-role", HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE);
    if (this.hudCenterPanelDeepLinkRefreshStamp > 0) {
      setHudCenterPanelDeepLinkRefreshStamp(wrap, this.hudCenterPanelDeepLinkRefreshStamp);
      if (this.mailTabHudSyncPulsePending) {
        scheduleMailTabHudSyncPulse(wrap);
        this.mailTabHudSyncPulsePending = false;
      }
    }
    segments.forEach((seg, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "hud-center-panel-deeplink-sep";
        sep.textContent = " · ";
        sep.setAttribute("aria-hidden", "true");
        wrap.appendChild(sep);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hud-center-panel-deeplink-seg";
      btn.setAttribute(HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR, seg.facet);
      btn.setAttribute(HUD_TODO_MERGED_SWEEP_FACET_ATTR, seg.facet);
      btn.setAttribute("title", `打开${seg.label}`);
      btn.setAttribute("aria-label", `HUD 深链：${seg.label}`);
      btn.textContent = seg.label;
      wrap.appendChild(btn);
    });
    this.hud.appendChild(wrap);
  }

  private appendHudMilitaryTodoSweepLine(): void {
    const counts = this.hudMilitaryTodoSweepCounts();
    const segments = hudMilitaryTodoSweepSegments(counts);
    if (!segments.length) return;
    const wrap = document.createElement("span");
    wrap.className = `hud-center-panel-deeplink ${HUD_MILITARY_TODO_SWEEP_CLASS}`;
    wrap.setAttribute("data-role", HUD_MILITARY_TODO_SWEEP_LINE_ROLE);
    segments.forEach((seg, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "hud-center-panel-deeplink-sep";
        sep.textContent = " · ";
        sep.setAttribute("aria-hidden", "true");
        wrap.appendChild(sep);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hud-center-panel-deeplink-seg";
      btn.setAttribute(HUD_MILITARY_TODO_FACET_ATTR, seg.facet);
      btn.setAttribute("title", `打开${seg.label}`);
      btn.setAttribute("aria-label", `HUD 军事待办：${seg.label}`);
      btn.textContent = seg.label;
      wrap.appendChild(btn);
    });
    this.hud.appendChild(wrap);
  }

  private pulseCenterPanelToolbarTab(tab: CenterPanelTabFromHudTodo | null): void {
    if (!tab) return;
    const action = centerPanelTabToolbarAction(tab);
    const btn = this.toolbarTrigger(action);
    scheduleCenterPanelTabPulse(btn);
  }

  private pulseToolbarPanelDeepLink(panel: HudTodoMergedSweepFacet): void {
    const counts = this.hudTodoMergedSweepCounts();
    if (!resolveToolbarPanelFromHudTodo(panel, counts)) return;
    const action = toolbarPanelActionFromHudTodo(panel);
    pulseHudTodoToolbarDeepLinkResidual(this.toolbarTrigger(action));
  }

  private pulseHudMilitaryTodoForFacet(facet: HudMilitaryTodoSweepFacet): void {
    const counts = this.hudMilitaryTodoSweepCounts();
    const panel = resolveToolbarPanelFromHudMilitaryTodo(facet, counts);
    if (!panel) return;
    const action = toolbarPanelActionFromHudMilitaryTodo(panel);
    scheduleHudMilitaryTodoPulse(this.toolbarTrigger(action));
  }

  private openHudMilitaryTodoDeepLink(facet: HudMilitaryTodoSweepFacet): void {
    const counts = this.hudMilitaryTodoSweepCounts();
    const panel = resolveToolbarPanelFromHudMilitaryTodo(facet, counts);
    if (!panel) return;
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    if (panel === "marches") {
      const marchId = findFirstIntelInProgressMarchId(this.minimapMarches);
      this.marchList.selectMarchById(marchId > 0 ? marchId : null, { openPanel: true });
    } else if (panel === "reports") {
      this.marchArrivalHudReminder = null;
      void this.battleReports
        .openPanelWithDeepLink(snap.firstUnreadBattleReportId)
        .then(() => this.renderHud());
    } else if (panel === "military") {
      this.militaryPanel.classList.remove("hidden");
      resetCenterPanelViewportScroll(this.militaryPanel);
      this.syncMilitaryPanel();
    }
    this.pulseHudMilitaryTodoForFacet(facet);
    this.status = `已打开军事待办（${panel}）`;
    this.renderHud();
  }

  private openHudCenterPanelDeepLink(facet: HudCenterPanelDeepLinkFacet): void {
    const counts = this.centerPanelDeepLinkCounts();
    const tab = resolveCenterPanelTabFromHudTodo(facet, counts);
    if (!tab) return;
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    if (tab === "mail") {
      const target = resolveHudTodoOpenTarget("toggle-mail", snap, this.session?.buildings);
      if (target.kind === "mail") {
        this.heroMail.openFromTodoBadge(target.mailId, {
          mailFilter: target.mailFilter,
          filterTabCounts: {
            unreadForTab: target.unreadForTab,
            unclaimedCount: target.unclaimedCount,
          },
        });
      } else {
        this.heroMail.toggleMail();
      }
    } else if (tab === "daily") {
      const target = resolveHudTodoOpenTarget("toggle-daily", snap, this.session?.buildings);
      if (target.kind === "daily") {
        this.dailyQuest.openFromTodoBadge(target.cfgId, {
          listFilter: target.listFilter,
          claimableCount: target.claimableCount,
        });
        this.updateDailyToolbarBadge(0);
      } else {
        this.dailyQuest.toggle();
      }
    } else if (tab === "queue") {
      const target = resolveHudTodoOpenTarget("toggle-queue", snap, this.session?.buildings);
      if (target.kind === "queue-building") {
        this.queuePanels.openFromTodoBadge(target.slotKey);
        this.updateQueueToolbarBadge(0);
      } else {
        this.queuePanels.toggle();
      }
    } else if (tab === "social" && !this.social.isChatOpen()) {
      this.social.toggleChat();
    }
    this.pulseCenterPanelToolbarTab(tab);
    this.pulseToolbarPanelDeepLink(tab);
    this.status = `已打开中心面板（${tab}）`;
    this.renderHud();
  }

  private appendHudCenterTodoBadge(): void {
    const counts = this.centerTodoCountsFromSnapshot();
    const badgeText = formatHudCenterTodoBadge(counts);
    if (!badgeText) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-center-todo-badge";
    btn.setAttribute("data-action", "open-hud-center-todo");
    btn.setAttribute("title", hudCenterTodoTitle(counts));
    btn.setAttribute("aria-label", hudCenterTodoTitle(counts));
    const label = document.createElement("span");
    label.className = "hud-center-todo-label";
    label.textContent = "待办";
    const countEl = document.createElement("span");
    countEl.className = "hud-center-todo-count ui-badge-count";
    applyUiCountBadge(countEl, sumHudCenterTodoCounts(counts), { assets: this.assets });
    btn.append(label, countEl);
    this.hud.appendChild(btn);
  }

  private wireSocialRankDeepLinks(): void {
    this.social.setRankDeepLinkHandlers({
      getViewerHeroIds: async () => {
        const sid = this.session?.serverId ?? this.gateway.getBoundServerId() ?? 0;
        if (sid <= 0) return [];
        try {
          const res = (await this.gateway.listPlayerHeroes(sid)) as {
            heroes?: { hero_id?: number }[];
          };
          return (res.heroes ?? []).map((h) => h.hero_id ?? 0).filter((id) => id > 0);
        } catch {
          return [];
        }
      },
      onOpenHeroDetail: (heroId) => {
        this.openRankHeroDeepLink(heroId);
      },
      onOpenWorldAtGrid: (gridX, gridY) => {
        this.openWorldFromRankDeepLink(gridX, gridY);
      },
      onOpenWorldViewer: () => {
        this.openWorldFromRankDeepLink(this.session?.cityX ?? Number.NaN, this.session?.cityY ?? Number.NaN);
      },
    });
  }

  private openRankHeroDeepLink(heroId: number): void {
    this.social.getRankRoot().classList.add("hidden");
    void this.heroMail.openHeroDetailDeepLink(heroId).then(() => this.renderHud());
  }

  private openWorldFromRankDeepLink(x: number, y: number): void {
    this.social.getRankRoot().classList.add("hidden");
    const root = this.world.getRoot();
    if (root.classList.contains("hidden")) this.world.toggle();
    if (Number.isFinite(x) && Number.isFinite(y)) {
      this.world.selectGridAt(x, y);
      this.focusMinimapOnWorldGrid(x, y);
      this.status = `世界：已定位格点 (${x},${y})（来自排行）`;
    } else {
      this.status = "世界：已打开，可在城池列表或格点信息卡扫读";
    }
    this.renderHud();
  }

  private openHudCenterTodoDeepLink(): void {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    const counts = this.centerTodoCountsFromSnapshot();
    const buildSlots = this.buildCompleteTodos.pendingSlotKeys();
    const target = pickHudCenterTodoTarget({
      counts,
      firstClaimableMailId: snap.firstClaimableMailId,
      firstClaimableDailyCfgId: snap.firstClaimableDailyCfgId,
      firstBuildCompleteSlotKey: buildSlots[0] ?? "",
    });
    if (!target) return;

    const panelWasOpen =
      target.panel === "daily"
        ? this.dailyQuest.isOpen()
        : target.panel === "mail"
          ? this.heroMail.isMailOpen()
          : this.queuePanels.isOpen();
    const skipScroll = shouldSkipRepeatCenterTodoScroll(
      this.lastCenterTodoScrollKey,
      target,
      panelWasOpen,
    );

    if (target.panel === "daily") {
      this.dailyQuest.openFromCenterTodoClaimable(target.questCfgId ?? 0, { skipScroll });
    } else if (target.panel === "mail") {
      this.heroMail.openFromCenterTodoClaimable(target.mailId ?? 0, { skipScroll });
    } else if (target.panel === "queue" && target.slotKey) {
      this.queuePanels.openFromCenterTodoBuildComplete(target.slotKey, {
        skipScroll,
        onAcknowledge: () => this.buildCompleteTodos.dismissSlot(target.slotKey!),
      });
      this.queuePanels.setBuildCompleteTodoSlots(this.buildCompleteTodos.pendingSlotKeys());
    }

    if (!skipScroll) {
      this.lastCenterTodoScrollKey = target.scrollTargetId;
    }
    this.status = `已打开中心面板待办（${target.panel}）`;
    this.renderHud();
  }

  private async seedMarchEndBattleReportHint(): Promise<void> {
    try {
      const res = (await this.gateway.listBattleReports(10, 0)) as {
        reports?: { report_id?: number }[];
      };
      this.marchEndReportHint.setFromReports(res.reports ?? []);
    } catch {
      // 战报尚未落库时深链回退为刷新后选最近一条
    }
  }

  private applyChatUnreadCounts(): void {
    const summary = this.chatUnreadTracker.getSummary(this.social.getGuildId());
    const social = hudTodoSocialBadgesFromChatSummary(summary);
    this.social.syncChatUnreadBadges(summary);
    this.updateChatToolbarBadge(social.chat);
    this.updateGuildToolbarBadge(social.guild);
  }

  private hudTodoSweepTitleSuffix(): string {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    const line = formatHudTodoSweepLine({
      mailClaimable: snap.mailClaimable,
      dailyClaimable: snap.dailyClaimable,
    });
    return line ? ` · ${line}` : "";
  }

  private bumpMailTabHudSyncFromPoll(pulse = true): void {
    const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
    this.hudCenterPanelDeepLinkRefreshStamp = Date.now();
    if (pulse) this.mailTabHudSyncPulsePending = true;
    this.heroMail?.syncMailTabHudTodoLinkage({
      dailyRows: snap.dailyChainRows,
      stamp: this.hudCenterPanelDeepLinkRefreshStamp,
      pulse,
    });
  }

  private applyHudTodoBadgeCounts(counts: HudTodoBadgeCounts): void {
    this.bumpMailTabHudSyncFromPoll(true);
    const sweepSuffix = this.hudTodoSweepTitleSuffix();
    if (!this.heroMail?.isMailOpen()) {
      this.updateMailToolbarBadge(counts.mailUnread, sweepSuffix);
    }
    if (!this.dailyQuest?.isOpen()) {
      this.updateDailyToolbarBadge(counts.dailyTodo, sweepSuffix);
    } else {
      this.dailyQuest.syncBattleReportUnreadBanner();
    }
    if (!this.queuePanels?.isOpen()) {
      this.updateQueueToolbarBadge(counts.queueBuilding);
    }
    if (!this.battleReports?.isOpen()) {
      this.updateReportsToolbarBadge(counts.battleReportUnread);
    }
    const militaryCounts = this.hudMilitaryTodoSweepCounts();
    if (!this.marchList?.isOpen()) {
      this.updateMarchesToolbarBadge(militaryCounts.intelInProgress);
    }
    if (this.militaryPanel?.classList.contains("hidden")) {
      this.updateMilitaryToolbarBadge(militaryCounts.marchSubmittable);
    }
    this.renderHud();
  }

  private async refreshState(): Promise<void> {
    if (!this.session) return;
    this.status = "刷新中…";
    this.renderHud();
    try {
      const state = (await this.cityStateFetch.fetch()) as {
        wallet?: ResourceWallet;
        buildings?: CityBuilding[];
        production_rates?: ResourceWallet;
      } | null;
      if (state) {
        this.applyCityStateFromFetch({
          wallet: state.wallet,
          buildings: state.buildings ?? [],
          production_rates: state.production_rates,
        });
      }
      await this.syncSessionCityCoords();
      await this.refreshMinimapMarches();
      this.status = "已刷新";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private resetBuildSubmitState(): void {
    this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "CLEAR_ERROR" });
  }

  private async startBuildingUpgrade(slotKey: string, buildingCfgId: number): Promise<void> {
    if (!this.session) return;
    const building = buildingBySlot(this.session.buildings, slotKey);
    const level = building?.level ?? 0;
    const preview = previewUpgradeCost(slotKey, level, this.session.wallet);
    const targetLevel = preview?.targetLevel ?? level + 1;
    const walletBefore = this.session.wallet;
    this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "SUBMIT" });
    this.buildingPanel.setFormError(null);
    this.buildingPanel.sync();
    this.renderHud();
    try {
      const res = (await this.gateway.startBuildingUpgrade(
        this.session.cityId,
        slotKey,
        buildingCfgId,
      )) as {
        wallet?: ResourceWallet;
        building?: CityBuilding;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      const walletAfter = this.session.wallet;
      const pulseKeys = walletBuildDeductPulseKeys(walletBefore, walletAfter, preview?.cost);
      if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
      if (res.building) {
        const idx = this.session.buildings.findIndex((b) => b.slot_key === slotKey);
        if (idx >= 0) this.session.buildings[idx] = res.building;
        else this.session.buildings.push(res.building);
      }
      this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "SUCCESS" });
      await this.refreshState();
      this.status = formatBuildSubmitSuccess(slotKey, targetLevel, SLOT_LABEL);
      this.buildingPanel.sync();
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "FAIL" });
      this.buildingPanel.setFormError(msg);
      this.status = msg;
      this.buildingPanel.sync();
    }
    this.renderHud();
  }

  private async recruit(): Promise<void> {
    if (!this.session) return;
    const preview = syncTroopRecruitFormPreview(this.militaryPanel, this.session.wallet);
    if (!preview?.canAfford) {
      setTroopRecruitFormError(this.militaryPanel, preview?.insufficientHint ?? "资源不足");
      this.status = preview?.insufficientHint ?? "资源不足";
      this.renderHud();
      return;
    }
    const unitCfgId = preview.troopCfgId;
    const count = preview.qty;
    const walletBefore = this.session.wallet;
    setTroopRecruitFormError(this.militaryPanel, null);
    this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
      type: "SUBMIT",
    });
    this.syncMilitaryPanel();
    this.renderHud();
    let pulseQueueId: number | null = null;
    try {
      const res = (await this.gateway.recruitTroop(this.session.cityId, unitCfgId, count)) as {
        wallet?: ResourceWallet;
        troop?: CityTroopStack;
        queue_id?: number;
        finish_at_ms?: number;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      const pulseKeys = walletRecruitTroopDeductPulseKeys(
        walletBefore,
        this.session.wallet,
        preview.cost,
      );
      if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
      if (res.troop) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, [res.troop]);
      }
      const queued = recruitEntryFromResponse(res, unitCfgId, count);
      this.queuePanels.addRecruitEntry(queued);
      this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
        type: "SUCCESS",
      });
      this.status = formatRecruitTroopSuccess(unitCfgId, count, res);
      if (queued) {
        pulseQueueId = queued.queue_id;
        this.queuePanels.pulseRecruitRow(queued.queue_id);
        writeRecruitHighlightQueueSession(queued.queue_id);
        this.recruitQueueHighlightId = queued.queue_id;
        const jump = resolveRecruitQueueJumpTarget(
          queued.queue_id,
          this.queuePanels.getRecruitQueueSnapshot(),
        );
        if (jump) {
          this.queuePanels.highlightRecruitQueue(jump.head_queue_id);
        }
      }
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
        type: "FAIL",
      });
      setTroopRecruitFormError(this.militaryPanel, msg);
      this.status = msg;
    }
    this.renderHud();
    this.syncMilitaryPanel();
    if (pulseQueueId != null) {
      const milRow = this.militaryPanel.querySelector(
        `#${CSS.escape(queueRecruitRowDomId(pulseQueueId))}`,
      );
      scheduleRecruitRowPulse(milRow instanceof HTMLElement ? milRow : null);
    }
  }

  private async refreshMarchFormHeroes(): Promise<void> {
    if (!this.session || this.marchHeroListLoading) return;
    const sid = this.session.serverId ?? this.gateway.getBoundServerId() ?? 0;
    if (sid <= 0) return;
    this.marchHeroListLoading = true;
    try {
      const res = (await this.gateway.listPlayerHeroes(sid)) as {
        heroes?: MarchHeroRow[];
      };
      this.marchFormHeroes = mapListPlayerHeroesForMarch(res.heroes);
      const fromStatus = collectMarchBusyHeroIdsFromStatus(this.marchFormHeroes);
      for (const id of fromStatus) this.marchLocalBusyHeroIds.add(id);
      for (const h of this.marchFormHeroes) {
        const id = h.hero_id ?? 0;
        if (id > 0 && (h.status ?? 0) === 1) this.marchLocalBusyHeroIds.delete(id);
      }
      syncMarchHeroSelect(this.militaryPanel, this.marchFormHeroes, this.marchLocalBusyHeroIds);
    } catch {
      // 保留上次列表；出征仍可由网关报错兜底
    } finally {
      this.marchHeroListLoading = false;
      this.syncMilitaryPanel();
    }
  }

  private async startMarch(): Promise<void> {
    if (!this.session) return;
    const validated = validateMarchForm({
      toXRaw: (this.field("to-x") as HTMLInputElement)?.value ?? "",
      toYRaw: (this.field("to-y") as HTMLInputElement)?.value ?? "",
      marchCountRaw: (this.field("march-count") as HTMLInputElement)?.value ?? "",
      heroIdRaw: readMarchHeroIdRaw(this.militaryPanel),
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      cityX: this.session.cityX,
      cityY: this.session.cityY,
      cityTroops: this.session.cityTroops,
    });
    if (!validated.ok) {
      setMarchFormErrorDisplay(this.militaryPanel, validated.message);
      this.renderHud();
      return;
    }
    const { toX, toY, marchCount, heroId } = validated;
    setMarchFormErrorDisplay(this.militaryPanel, null);
    const troops = [{ unit_cfg_id: 1, count: marchCount }];
    this.marchSubmitState = marchSubmitStateMachine(this.marchSubmitState, { type: "SUBMIT" });
    this.syncMilitaryPanel();
    this.renderHud();
    try {
      const res = (await this.gateway.startMarch(
        this.session.cityId,
        toX,
        toY,
        PURPOSE_ATTACK,
        heroId,
        troops.map((t) => ({ unit_cfg_id: t.unit_cfg_id ?? 1, count: t.count ?? 0 })),
      )) as { march?: MarchSummary; city_troops?: CityTroopStack[] };
      this.marchLocalBusyHeroIds.add(heroId);
      this.marchFormHeroes = this.marchFormHeroes.map((h) =>
        h.hero_id === heroId ? { ...h, status: HERO_STATUS_MARCH } : h,
      );
      this.lastMarch = res.march ?? null;
      if (res.city_troops?.length) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, res.city_troops);
      } else {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, troops.map((t) => ({
          unit_cfg_id: t.unit_cfg_id,
          count: 0,
        })));
      }
      writeMarchTargetSession(toX, toY);
      setMarchFormErrorDisplay(this.militaryPanel, null);
      this.status = formatMarchDepartedStatusToast(toX, toY);
      setMarchTargetFieldHighlight(this.militaryPanel, false);
      this.marchArrivalPoll.trackMarch(this.lastMarch?.march_id, this.lastMarch ?? undefined);
      this.marchQueueBannerTarget = marchQueueBannerTargetFromMarch(this.lastMarch) ?? {
        march_id: this.lastMarch?.march_id ?? 0,
        to_x: toX,
        to_y: toY,
      };
      if ((this.marchQueueBannerTarget?.march_id ?? 0) <= 0) {
        this.marchQueueBannerTarget = null;
      }
      syncMarchQueueBanner(this.militaryPanel, this.marchQueueBannerTarget, { pulse: true });
      this.marchList.notifyMarchStarted(this.lastMarch?.march_id, {
        march: this.lastMarch,
        toX,
        toY,
      });
      void this.refreshMinimapMarches();
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("march", e);
      setMarchFormErrorDisplay(this.militaryPanel, msg);
      this.status = msg;
    } finally {
      this.marchSubmitState = marchSubmitStateMachine(this.marchSubmitState, { type: "SETTLE" });
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  draw(c2d: CanvasRenderingContext2D): void {
    const vp = this.getViewport();
    c2d.save();
    applyLayoutTransform(c2d, vp);

    // HUD / toolbar chrome is DOM-only (ART-CHROME-006); canvas leaves top/bottom clear.

    const bg = this.assets.getImageForAsset("mc.bg.plateau.v1");
    if (bg) {
      c2d.drawImage(bg.img, 0, STAGE_TOP_Y, LAYOUT_FRAME.w, STAGE_HEIGHT);
    } else {
      c2d.fillStyle = "#3d5c3a";
      c2d.fillRect(0, STAGE_TOP_Y, LAYOUT_FRAME.w, STAGE_HEIGHT);
    }

    const buildingLevels = new Map(
      (this.session?.buildings ?? []).map((b) => [b.slot_key ?? "", b] as const),
    );
    const sorted = [...MAIN_CITY_SLOTS].sort((a, b) => a.z - b.z);
    for (const slot of sorted) {
      this.drawSlot(c2d, slot, buildingLevels.get(slot.slot_key));
    }

    // Top-bar wallet icons/amounts: DOM only (`appendHudResourceStrip` in renderHud). Canvas draws
    // the opaque HUD band above; stacking canvas resource glyphs caused overlap at 1280×720 (CLIENT-039).

    syncMinimapMarchStackBadgeClass(
      this.minimapMarches,
      document.getElementById("layout-frame"),
    );

    drawWorldMinimap(c2d, {
      ownCityX: this.session?.cityX,
      ownCityY: this.session?.cityY,
      marches: this.minimapMarches,
      selectedMarchId: this.marchList?.getSelectedMarchId(),
      focusGrid: this.minimapFocusGrid,
      focusPulseUntilMs: this.minimapFocusPulseUntilMs,
      marchEndHighlight: this.minimapMarchEndHighlight,
      intelSyncRing: this.minimapIntelSyncRing,
      view: this.minimapView,
      rect: this.currentMinimapLayoutRect(),
      collapsed: this.minimapCollapsed,
      battleReportReplay: this.minimapBattleReportReplay,
      nowMs: this.marchClockMs,
      assets: this.assets,
      artSkinAnchor: document.getElementById("layout-frame"),
    });

    c2d.restore();
  }

  private drawSlot(
    c2d: CanvasRenderingContext2D,
    slot: MainCitySlotDef,
    building?: CityBuilding,
  ): void {
    const assetId = slot.asset_id ?? `mc.building.${slot.slot_key}.v1`;
    const pack = this.assets.getImageForAsset(assetId);
    const { display, ground_anchor: ga } = slot;
    if (pack) {
      const anchor = pack.meta.anchor;
      const ax = pack.meta.anchor_unit === "normalized" ? anchor.x * display.w : anchor.x;
      const ay = pack.meta.anchor_unit === "normalized" ? anchor.y * display.h : anchor.y;
      const topX = display.x + ga.x - ax;
      const topY = display.y + ga.y - ay;
      c2d.drawImage(pack.img, topX, topY, display.w, display.h);
    } else {
      c2d.fillStyle = "rgba(42, 61, 40, 0.75)";
      c2d.fillRect(display.x, display.y, display.w, display.h);
      c2d.fillStyle = "#e8dcc8";
      c2d.font = "14px system-ui";
      c2d.fillText(slot.label, display.x + 8, display.y + 24);
    }
    const now = Date.now();
    const caption = formatSlotBuildingCaption(
      slot.slot_key,
      slot.label,
      building,
      now,
    );
    if (KEY_BUILDING_SLOTS.has(slot.slot_key)) {
      c2d.fillStyle = "rgba(26, 20, 16, 0.72)";
      c2d.fillRect(display.x, display.y - 4, Math.min(display.w, 120), 22);
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "12px system-ui";
      c2d.fillText(caption.title, display.x + 6, display.y + 14);
    }
    if (building) {
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "13px system-ui";
      if (!KEY_BUILDING_SLOTS.has(slot.slot_key)) {
        c2d.fillText(caption.levelLine, display.x + 8, display.y + display.h - 12);
      }
    }
  }

  private updateChatToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="chat-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "聊天";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · ${unreadCount} 条未读` : "世界/军团聊天",
      this.assets,
    );
  }

  private updateGuildToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="guild-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "军团";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · 军团频道 ${unreadCount} 条未读` : "军团",
      this.assets,
    );
  }

  private updateMailToolbarBadge(unreadCount: number, sweepSuffix = ""): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="mail-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "邮件";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0
        ? `${label} · ${unreadCount} 项待处理（未读/未领）${sweepSuffix}`
        : "收件箱",
      this.assets,
    );
  }

  private updateDailyToolbarBadge(todoCount: number, sweepSuffix = ""): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="daily-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "日常";
    setToolbarBadge(
      btn,
      todoCount,
      todoCount > 0 ? `${label} · ${todoCount} 项可领取${sweepSuffix}` : "日常任务",
      this.assets,
    );
  }

  private updateQueueToolbarBadge(inProgressCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="queue-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "队列";
    setToolbarBadge(
      btn,
      inProgressCount,
      inProgressCount > 0 ? `${label} · ${inProgressCount} 槽建造中` : "内政/募兵队列",
      this.assets,
    );
  }

  private updateReportsToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="reports-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "战报";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · ${unreadCount} 条新战报` : "战报列表",
      this.assets,
    );
  }

  private updateMarchesToolbarBadge(intelInProgress: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="marches-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "行军";
    setToolbarBadge(
      btn,
      intelInProgress,
      intelInProgress > 0 ? `${label} · 军情进行中 ${intelInProgress}` : "军情行军列表",
      this.assets,
    );
  }

  private updateMilitaryToolbarBadge(marchSubmittable: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="military-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "军事";
    setToolbarBadge(
      btn,
      marchSubmittable,
      marchSubmittable > 0 ? `${label} · 出征可提交` : "军事",
      this.assets,
    );
  }
}
