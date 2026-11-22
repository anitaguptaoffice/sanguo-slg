import { mergeCityResourceWallet } from "@/net/cityResourceWallet";
import { readMarchListSnapshot } from "@/net/marchListSnapshot";
import { beginMarchSnapshotRead } from "@/net/marchSnapshotRead";
import { captureActor } from "@/net/actorContext";
import { openCenterPanel, toggleCenterPanel, captureCenterPanelIntent } from "@/ui/centerPanelForeground";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { clearHudBarChrome, clearToolbarBarChrome, skinHudBar, skinToolbarBar, wrapToolbarButtonsForHit } from "@/engine/artChromeSkin";
import { skinToolbarButtons } from "@/engine/artToolbarButtonSkin";
import { applyUiCountBadge } from "@/engine/artBadgeSkin";
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
  citySlotsForMode,
  LAYOUT_FRAME,
  STAGE_HEIGHT,
  STAGE_TOP_Y,
  type CitySceneMode,
  type MainCitySlotDef,
} from "@/engine/mainCitySlots";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, CityTroopStack, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { scrollCitySlotIntoView } from "@/net/citySlotQueueLink";
import { highlightDomesticSlotForQueueRow } from "@/net/domesticSlotQueueFocusRing";
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
import { WorldMapScene } from "@/scenes/WorldMapScene";
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
  MARCH_PHASE_RETURNED,
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
import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import {
  formatMarchArrivedStatusMessage,
  MARCH_ARRIVAL_VIEW_REPORT_LABEL,
  type MarchArrivalReminder,
} from "@/net/marchArrival";
import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
import { gatewayErrorMessage } from "@/net/contentFeedback";
import { garrisonPatch, readyGarrison } from "@/net/garrisonState";
import { CityStateFetch, type CityStateSnapshot } from "@/net/cityStateFetch";
import { parseCurrentRecruitQueue, renderCurrentRecruitQueue } from "@/net/currentRecruitQueue";
import { CityStatePoll } from "@/net/cityStatePoll";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { syncMarchFormInlineFeedback } from "@/net/marchFormSummary";
import { readTroopRecruitForm, setTroopRecruitFormError, syncTroopRecruitFormPreview } from "@/ui/troopRecruitForm";
import { readMarchUnitCfgId, setMarchFormErrorDisplay, validateMarchForm } from "@/net/marchFormValidation";
import {
  applyMarchIntelRemarchPrefillWithFeedback,
  buildMarchIntelRemarchPrefill,
} from "@/net/marchIntelRemarch";
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
  syncMinimapViewportToIntelRow,
  type MinimapViewportIntelSyncTimers,
} from "@/net/minimapViewportIntelSync";
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
  marchShowsDestOnMinimap,
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
import { MainCityBuildingPanel, type CityOfficeRow, type TechnicRow, type WallDefenseRow } from "@/ui/MainCityBuildingPanel";
import { MainCityCityOfficePanel, type CityCivicView } from "@/ui/MainCityCityOfficePanel";
import {
  CITY_CHIEF_HALL_SLOT_KEY,
  formatCityChiefGatewayError,
  heroIdsOnActiveMarch,
  loadCityOfficeBundle,
  parseCityChiefView,
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
  barracks: "军营",
  wall: "城墙",
  academy: "书院",
  drill_ground: "校场",
  inn: "客栈",
  recruit_hall: "招贤馆",
  market: "市场",
  smithy: "铁匠铺",
  workshop: "工匠作坊",
  stable: "马厩",
  warehouse: "仓库",
  diplomacy: "鸿胪寺",
  relay: "驿站",
  beacon: "烽火台",
  house: "民房",
};

const PURPOSE_ATTACK = 1;
const WALLET_GAIN_FLASH_MS = 2800;
const MINIMAP_MARCH_REFRESH_S = 5;
const MINIMAP_ETA_TICK_S = MARCH_LIST_REMAINING_TICK_MS / 1000;
/** 小地图单击与拖拽区分阈值（layout px）。 */
const MINIMAP_TAP_MOVE_THRESHOLD = 8;

/** buildingTier maps a building level to its original-art tier. */
export function buildingTier(level: number): number {
  if (level >= 10) return 10;
  if (level >= 7) return 7;
  if (level >= 4) return 4;
  return 1;
}

export class MainCityScene implements Scene {
  readonly name = "mainCity";
  private session: MainCitySession | null = null;
  private hud!: HTMLElement;
  private toolbar!: HTMLElement;
  private militaryPanel!: HTMLElement;
  private gateway!: SceneContext["gateway"];
  private status = "";
  private sceneActive = false;
  private returningToServers = false;
  private returnToServers: (() => void) | null = null;
  private lastMarch: MarchSummary | null = null;
  private marchQueueBannerTarget: MarchQueueBannerTarget | null = null;
  private marchSubmitState: MarchSubmitState = "idle";
  private marchFormHeroes: MarchHeroRow[] = [];
  private marchLocalBusyHeroIds = new Set<number>();
  private marchLocalHeroOrders = new Map<number, number>();
  private marchHeroActor: (() => boolean) | null = null;
  private marchHeroListLoading = false;
  private marchFormIntelScrollContext: ScrollIntelRowForMarchFormContext = {
    preferredMarchId: null,
    toX: null,
    toY: null,
  };
  private buildSubmitState: BuildSubmitState = "idle";
  private buildSubmitOwner: (() => boolean) | null = null;
  private recruitSubmitOwner: (() => boolean) | null = null;
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
  private worldMap!: WorldMapScene;
  private queuePanels!: QueuePanels;
  private slotUpgradeOverlay!: MainCitySlotUpgradeOverlay;
  private domesticSlotStrip!: MainCityDomesticSlotStrip;
  private buildingPanel!: MainCityBuildingPanel;
  private citySceneMode: CitySceneMode = "inner";
  private cityOfficePanel!: MainCityCityOfficePanel;
  private cityOfficeContext?: { current: () => boolean; version: number; busy: boolean; uncertain: boolean };
  private activeDomesticSlotKey: string | null = null;
  private slotOverlayRefreshAccum = 0;
  private assets!: AssetLoader;
  private getViewport!: () => LayoutViewport;
  private canvas!: HTMLCanvasElement;
  private hudRefreshAccum = 0;
  private cityStateFetch!: CityStateFetch;
  private cityStatePoll!: CityStatePoll;
  private hudTodoBadgePoll!: HudTodoBadgePoll;
  private chatUnreadTracker = new ChatUnreadTracker();
  private chatUnreadPoll!: ChatUnreadPoll;
  private readonly buildCompleteTodos = new BuildCompleteTodoTracker();
  /** Last focused bottom-toolbar toggle (CLIENT-135 Esc focus return). */
  private lastToolbarFocus: HTMLElement | null = null;
  private lastCenterTodoScrollKey: string | null = null;
  /** CLIENT-209：HUD 中心深链与邮件 tab 扫读共用刷新戳记。 */
  private marchArrivalPoll!: MarchArrivalPoll;
  private battleReportUnread = new BattleReportUnreadSession();
  private marchArrivalHudReminder: MarchArrivalReminder | null = null;
  private walletGainBrief: string | null = null;
  private walletGainUntilMs = 0;
  private layoutFrame!: HTMLElement;
  private minimapMarches: MarchSummary[] = [];
  private marchSnapshotGeneration = 0;
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
  private minimapViewportGestureActive = false;
  /** 与军情列表 {@link MarchListPanel} 共用的行军 ETA 时钟（毫秒）。 */
  private marchClockMs = Date.now();
  private minimapEtaTickAccum = 0;
  private readonly onCanvasPointerBound = (ev: PointerEvent) => this.onCanvasPointer(ev);
  private readonly onCanvasWheelBound = (ev: WheelEvent) => this.onCanvasWheel(ev);
  private readonly onHudClickBound = (ev: Event) => this.onHudClick(ev);

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.marchSnapshotGeneration++;
    this.sceneActive = true;
    this.returningToServers = false;
    const lifecycle = this.marchSnapshotGeneration;
    const currentScene = () => this.sceneActive && lifecycle === this.marchSnapshotGeneration;
    this.chatUnreadTracker = new ChatUnreadTracker();
    this.battleReportUnread = new BattleReportUnreadSession();
    this.lastMarch = this.marchQueueBannerTarget = this.marchArrivalHudReminder = null;
    this.recruitQueueHighlightId = this.intelRemarchTroopsLine = this.activeDomesticSlotKey = null;
    this.lastToolbarFocus = null;
    this.marchFormIntelScrollContext = { preferredMarchId: null, toX: null, toY: null };
    this.minimapMarches = [];
    this.minimapBattleReportReplay = this.minimapFocusGrid = this.minimapMarchEndHighlight = this.minimapIntelSyncRing = null;
    this.minimapView = { ...DEFAULT_MINIMAP_VIEW };
    this.minimapPanPointerId = this.minimapPanLastLayout = this.minimapPanStartLayout = null;
    this.walletGainBrief = null;
    this.walletGainUntilMs = this.minimapFocusPulseUntilMs = 0;
    this.status = "";
    this.minimapViewportGestureActive = false;
    this.returnToServers = () => {
      if (!this.sceneActive || this.returningToServers || lifecycle !== this.marchSnapshotGeneration) return;
      if (!window.confirm("返回选服会断开当前连接。已提交的操作不会撤销；尚未收到结果的操作可能已成功，请重新进入后核实，勿重复提交。是否返回选服？")) return;
      this.returningToServers = true;
      ctx.gateway.close();
      void ctx.switchScene("serverSelect", { fromMainCity: true }).catch(() => {
        if (!this.sceneActive && this.marchSnapshotGeneration === lifecycle + 1) {
          ctx.hud.textContent = "返回选服失败，请刷新页面。已提交的操作不会撤销，请重新进入后核实结果。";
        }
      });
    };
    this.buildSubmitOwner = null;
    this.buildSubmitState = "idle";
    this.recruitSubmitOwner = null;
    this.recruitTroopSubmitState = "idle";
    this.resetMarchHeroTracking();
    this.assets = ctx.assets;
    this.getViewport = ctx.getViewport;
    this.canvas = ctx.canvas;
    this.session = (data as MainCitySession) ?? null;
    this.buildCompleteTodos.reset();
    this.buildCompleteTodos.onCityBuildings(this.session?.buildings);
    this.lastCenterTodoScrollKey = null;
    this.hud = ctx.hud;
    // Detached panels retain this facade: they cannot continue a multi-step command
    // sequence through the shared gateway after returning or entering another actor.
    this.gateway = new Proxy(ctx.gateway, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (typeof value !== "function") return value;
        if (["getSessionId", "getSessionGeneration", "getBoundServerId"].includes(String(key))) return value.bind(target);
        return (...args: unknown[]) => currentScene()
          ? Reflect.apply(value, target, args)
          : Promise.reject(new Error("场景已离开，请重新进入后核实操作结果"));
      },
    });
    this.layoutFrame = ctx.layoutFrame;
    this.cityStateFetch = new CityStateFetch(this.gateway, () => this.session?.cityId ?? null,
      () => `${this.gateway.getSessionId()}:${this.session?.serverId}:${this.session?.player.player_id}`);
    this.cityStatePoll = new CityStatePoll({
      fetch: this.cityStateFetch,
      isPanelVisible: () => this.isAnyPanelVisible(),
      onState: (state) => { if (currentScene()) this.applyCityStatePoll(state); },
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
      onCounts: (counts) => { if (currentScene()) this.applyHudTodoBadgeCounts(counts); },
    });
    this.marchArrivalPoll = new MarchArrivalPoll({
      getCityId: () => this.session?.cityId,
      listMarches: (cityId) => this.readMarchesForArrival(cityId),
      onCompletions: (reminders) => { if (currentScene()) this.applyMarchArrivalHudReminders(reminders); },
    });
    skinHudBar(this.hud, this.assets);
    this.toolbar = document.createElement("div");
    this.toolbar.className = "main-city-toolbar layout-toolbar";
    this.toolbar.innerHTML = `
      <div class="toolbar-scroll" data-role="toolbar-scroll">
      <div class="toolbar-scroll-inner">
      <button type="button" data-action="return-server-select" title="断开当前连接并返回选服；已提交的操作不会撤销">返回选服</button>
      <button type="button" data-action="toggle-city-scene" data-role="city-scene-btn" title="切换内城/外城">外城</button>
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
      <button type="button" data-action="open-world-map" title="全屏世界大地图"><span class="toolbar-btn-label">大地图</span></button>
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
      <div class="unit-art-strip" data-role="unit-art-strip" style="display:flex;flex-wrap:wrap;gap:3px;margin:4px 0"></div>
      <div class="panel-scroll-body" data-role="military-scroll">
        <div class="military-recruit-section" data-role="military-recruit-section">
        <label>募兵兵种
          <select data-field="unit">
            <option value="1">步兵</option>
            <option value="2">骑兵</option>
            <option value="3">弓兵</option>
            <option value="4">器械</option>
            <option value="5">民夫</option>
            <option value="6">义兵</option>
            <option value="7">斥候</option>
            <option value="8">长枪兵</option>
            <option value="9">刀盾兵</option>
            <option value="10">长弓手</option>
            <option value="11">轻骑</option>
            <option value="12">铁骑</option>
          </select>
        </label>
        <label>数量 <input type="number" data-field="recruit-count" min="1" value="20" /></label>
        <p class="troop-recruit-preview" data-role="troop-recruit-preview"></p>
        <p class="march-form-error hidden" data-role="troop-recruit-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="recruit">募兵</button>
        <button type="button" data-action="retry-prepared-recruit" hidden>重试上次募兵</button>
        <p data-role="prepared-recruit-status" role="status"></p>
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
        <button type="button" data-action="clear-march-target">清除出征目标记忆</button>
        <label>带队将领
          <select data-field="march-hero" aria-label="出征带队将领"></select>
        </label>
        <label>出征目的
          <select data-field="march-purpose" aria-label="出征目的">
            <option value="1">攻击</option>
            <option value="2">侦察</option>
            <option value="3">掠夺</option>
            <option value="4">占领</option>
          </select>
        </label>
        <label>出征兵种
          <select data-field="march-unit" aria-label="出征兵种">
            <option value="1">步兵</option><option value="2">骑兵</option>
            <option value="3">弓兵</option><option value="4">器械</option>
            <option value="5">民夫</option><option value="6">义兵</option>
            <option value="7">斥候</option><option value="8">长枪兵</option>
            <option value="9">刀盾兵</option><option value="10">长弓手</option>
            <option value="11">轻骑</option><option value="12">铁骑</option>
            <option value="13">西凉铁骑</option><option value="14">虎豹骑</option>
            <option value="15">青州兵</option><option value="16">南蛮象兵</option>
            <option value="17">藤甲兵</option><option value="18">突骑兵</option>
          </select>
        </label>
        <label>出征数量 <input type="number" data-field="march-count" min="1" value="50" /></label>
        <p class="march-form-summary" data-role="march-form-summary" aria-live="polite"></p>
        <p class="march-form-summary-warn hidden" data-role="march-form-summary-warn" role="status"></p>
        <p class="march-form-error hidden" data-role="march-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="march">出征</button>
        <p class="military-march" data-role="march"></p>
      </div>
    `;
    const parent = ctx.layoutFrame;
    this.slotUpgradeOverlay = new MainCitySlotUpgradeOverlay(parent);
    this.slotUpgradeOverlay.setSlots(citySlotsForMode(this.citySceneMode));
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
    this.mountUnitArtStrip();
    this.worldMap = new WorldMapScene(parent, {
      gateway: () => this.gateway,
      getSession: () => this.session,
      onMarchTarget: (x, y) => this.prefillMarchTargetFromWorld(x, y),
      assets: this.assets,
    });
    this.worldMap.attach();
    this.chatUnreadTracker.onCounts = () => { if (currentScene()) this.applyChatUnreadCounts(); };
    this.social = new SocialPanels(
      parent,
      this.gateway,
      () => this.session,
      (msg) => {
        if (!currentScene()) return;
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
      (patch) => { if (currentScene()) this.patchSession(patch); },
      (msg) => {
        if (!currentScene()) return;
        this.status = msg;
        this.renderHud();
      },
      (keys) => {
        if (!currentScene()) return;
        if (keys.length) scheduleHudResourcePulse(this.hud, keys);
      },
      this.assets,
    );
    this.content.attach();
    this.dailyQuest = new DailyQuestPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => { if (currentScene()) this.patchSession(patch); },
      (msg) => {
        if (!currentScene()) return;
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
      (rows) => { if (currentScene()) this.hudTodoBadgePoll.applyDailyChainRowsSnapshot(rows); },
    );
    this.dailyQuest.attach();
    this.heroMail = new HeroMailPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => { if (currentScene()) this.patchSession(patch); },
      (msg) => {
        if (!currentScene()) return;
        this.status = msg;
        this.renderHud();
      },
      () => {
        if (currentScene() && !this.heroMail?.isMailOpen()) this.hudTodoBadgePoll.recomputeToolbarCounts();
      },
      this.cityStateFetch,
      () => currentScene() ? this.dailyQuest.refreshChainList(DAILY_RECRUIT_QUEST_CFG_ID) : undefined,
      (snap) => { if (currentScene()) this.hudTodoBadgePoll.applyMailUnreadSnapshot(snap.count, snap.firstId); },
      (mails, unreadTotal) => {
        if (currentScene()) this.hudTodoBadgePoll.applyMailInboxSnapshot(mails, unreadTotal);
      },
      (reportId) => {
        if (!currentScene()) return;
        this.marchArrivalHudReminder = null;
        void this.battleReports
          .openPanelWithDeepLink(reportId ?? undefined)
          .then(() => this.renderHud());
      },
      (link) => {
        if (!currentScene()) return;
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
        if (!currentScene()) return;
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
        if (!currentScene()) return;
        this.status = msg;
        this.renderHud();
      },
      {
        unreadSession: this.battleReportUnread,
        onUnreadChange: (count) => { if (currentScene()) this.updateReportsToolbarBadge(count); },
        onViewOnMap: (summary) => { if (currentScene()) this.focusMinimapOnBattleReport(summary); },
        onCoordReplay: (summary) => { if (currentScene()) this.replayBattleReportOnMinimap(summary); },
        onViewIntelNearReport: (summary) => { if (currentScene()) this.openIntelNearBattleReport(summary); },
        canOfferIntelJump: (summary) =>
          currentScene() && canOfferBattleReportIntelJump(this.minimapMarches, summary),
        onClearMapReplay: () => { if (currentScene()) this.clearBattleReportMinimapReplay(); },
        onOpenRelatedMail: (mailId) => {
          if (!currentScene()) return;
          this.heroMail.openAndHighlightMail(mailId);
          this.renderHud();
        },
        getDailyChainRows: () => {
          if (!currentScene()) return [];
          const fromPanel = this.dailyQuest.getRowsSnapshot();
          if (fromPanel.length) return fromPanel;
          return this.hudTodoBadgePoll.getDeepLinkSnapshot().dailyChainRows;
        },
        onOpenRelatedDaily: (questCfgId) => {
          if (!currentScene()) return;
          this.dailyQuest.openAndFocusQuest(questCfgId);
          this.status = "已打开「日常」并定位对应日课（只读，不自动领奖）";
          this.renderHud();
        },
        getBattleReportLinkContext: () => currentScene() ? ({
          viewerPlayerId: this.session?.player?.player_id,
          viewerHeroes: this.heroMail.getHeroesSnapshot(),
        }) : ({}),
        onOpenBattleReportHero: (heroId) => {
          if (!currentScene()) return;
          this.heroMail.openAndHighlightHero(heroId);
          this.status = `已打开「将领」详情 #${heroId}（战报互链）`;
          this.renderHud();
        },
        onOpenBattleReportRank: (playerId) => {
          if (!currentScene()) return;
          this.social.openPowerRankHighlightEntity(playerId);
          this.status = `已打开「排行」并高亮玩家#${playerId}`;
          this.renderHud();
        },
        onBattleReportReadonlyHint: (message) => {
          if (!currentScene()) return;
          this.status = message;
          this.renderHud();
        },
        onOpenReplayWorldTile: (summary) => { if (currentScene()) this.openWorldTileFromBattleReport(summary); },
        onListIntelJump: (summary) => { if (currentScene()) this.jumpFromBattleReportListToIntelOrMinimap(summary); },
        filterListSkinAssets: this.assets,
      },
    );
    this.battleReports.attach();
    this.marchList = new MarchListPanel(
      parent,
      this.gateway,
      () => this.session?.cityId,
      (msg) => {
        if (!currentScene()) return;
        this.status = msg;
        this.renderHud();
      },
      {
        assets: this.assets,
        nowMs: () => this.marchClockMs,
        getWorldSelectedGrid: () => this.world?.getSelectedGrid() ?? null,
        onMarchesUpdated: (marches) => { if (currentScene()) this.applyMarchesSnapshot(marches); },
        onMarchArrivalReminders: (reminders) => { if (currentScene()) this.applyMarchArrivalHudReminders(reminders); },
        onRemarchFromRow: (march) => this.openMilitaryFromIntelRemarch(march),
        onRecallMarch: (march) => void this.recallMarch(march),
        onSpeedupMarch: (march) => void this.speedupMarch(march),
        speedupItemAvailable: () => this.hasMarchSpeedupItem(),
        onOpenMilitaryQueueBanner: (marchId) => this.openMilitaryQueueBannerHighlight(marchId),
        onViewMarchDestTile: (march) => {
          if (!currentScene()) return;
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
          if (!currentScene()) return;
          if (!this.battleReports.isOpen()) this.battleReports.openPanel();
          void this.battleReports.openPanelWithDeepLink(reportId).then(() => this.renderHud());
          this.status = `战报：已定位 #${reportId}（军情复盘互链）`;
          this.renderHud();
        },
        onSelectionChange: (march) => {
          if (!currentScene()) return;
          this.syncMilitaryPanel();
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
            if (typeof tx === "number" && typeof ty === "number" && Number.isFinite(tx) && Number.isFinite(ty)) {
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
          if (!currentScene()) return;
          this.openMilitaryPanel();
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
          if (!currentScene()) return;
          this.marchList.syncWorldGridSelection(grid);
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
          if (!currentScene()) return;
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
          if (!currentScene()) return;
          this.marchList.openIntelViewForGrid(grid.x, grid.y);
          this.pulseIntelRowFromMinimapTile(grid.x, grid.y);
          this.status = `军情：已筛选目的格 (${grid.x},${grid.y})`;
          this.renderHud();
        },
        getBattleReportsSnapshot: () => this.battleReports.getReportsSnapshot(),
        onCenterMinimapAtGrid: (grid) => {
          if (!currentScene()) return;
          this.applyMinimapFocusFromWorldTileCard(grid);
        },
        onViewBattleReportsAtGrid: (grid, hintReportId) => {
          if (!currentScene()) return;
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
        if (!currentScene()) return;
        this.status = msg;
        this.renderHud();
      },
      () => {
        this.renderHud();
        if (this.gateway.preparedRecruit === true) void this.cityStatePoll.pollOnce();
      },
      () => this.syncMilitaryPanel(),
      () => {
        const fromPanel = this.dailyQuest.getRowsSnapshot();
        if (fromPanel.length) return fromPanel;
        return this.hudTodoBadgePoll.getDeepLinkSnapshot().dailyChainRows;
      },
      (questCfgId) => {
        if (!currentScene()) return;
        this.dailyQuest.openAndFocusQuest(questCfgId);
        this.status = "已打开「日常」并定位对应建造日课";
        this.renderHud();
      },
      skinCenterPrimary,
      (slotKey) => this.onQueueBuildSlotHighlightChange(slotKey),
      () => this.toolbarTrigger("toggle-queue"),
      (entry) => this.openMilitaryRecruitFromQueueRow(entry),
      (slotKey) => {
        if (!currentScene()) return;
        const building = buildingBySlot(this.session?.buildings, slotKey);
        scrollCitySlotIntoView(this.slotUpgradeOverlay?.getOverlayLayer(), slotKey);
        highlightDomesticSlotForQueueRow(
          this.slotUpgradeOverlay?.getOverlayLayer(),
          slotKey,
          building,
        );
      },
      (queueIds) => {
        this.cityStateFetch.clear();
        void this.refreshState(); // Read completion; never infer ready troops from a deadline.
        const events = queueIds.map((id) => ({ kind: "recruit" as const, queueId: id }));
        this.applyQueueCompleteHudPulse(events);
        this.applyQueueCompleteFocusRing(events);
      },
      (open) => this.onQueuePanelVisibilityChange(open),
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
      (slotKey) => void this.demolishBuilding(slotKey),
      (tid) => void this.startTechnicResearch(tid),
      (action, office, heroId) => void this.cityOfficeAction(action, office, heroId),
      (action, defenseType, unitId) => void this.wallAction(action, defenseType, unitId),
      (action, resourceType, amount, priceMilli, hours, offerId) =>
        void this.marketAction(action, resourceType, amount, priceMilli, hours, offerId),
      (unitCfgId, targetType, hold) => void this.saveTactic(unitCfgId, targetType, hold),
      () => void this.runDrill(),
      (action, slotType, tier, equipmentId, gemCfgId) =>
        void this.equipmentAction(action, slotType, tier, equipmentId, gemCfgId),
      (action, npcCfgId) => void this.historicalAction(action, npcCfgId),
      (trickType, targetMarchId) => void this.castTrick(trickType, targetMarchId),
      (action, name, x, y) => void this.rankAction(action, name, x, y),
      (action, guildId, targetGuildId, cityId, unit, count, fromCityId) =>
        void this.diplomacyAction(action, guildId, targetGuildId, cityId, unit, count, fromCityId),
      (action, unit, count) => void this.specialCityAction(action, unit, count),
      (action, stageId, unit, count) => void this.campaignAction(action, stageId, unit, count),
      (action, opponentId, unit, count) => void this.arenaAction(action, opponentId, unit, count),
      (achievementId) => void this.claimAchievement(achievementId),
      (cfgId) => (cfgId ? this.assets.getImageForAsset(`equip.icon.${cfgId}.v1`)?.img.src : undefined),
    );
    this.buildingPanel.attach();
    this.cityOfficePanel = new MainCityCityOfficePanel({
      onAppoint: (heroId) => void this.appointCityChief(heroId),
      onClear: () => void this.clearCityChief(),
      onCivicDecree: (decree, value, name) => void this.applyCityDecree(decree, value, name),
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
    remountPanelFilterChips(this.heroMail.getMailRoot(), this.assets);
    remountPanelFilterChips(this.dailyQuest.getRoot(), this.assets);
    remountPanelFilterChips(this.battleReports.getRoot(), this.assets);
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
    this.militaryPanel.addEventListener("change", (ev) => {
      this.onMilitaryRecruitFieldChange(ev);
      if ((ev.target as HTMLElement).getAttribute("data-field") === "march-unit") this.onMilitaryFormInput(ev);
    });
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
    this.renderHud();
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
    this.sceneActive = false;
    this.returnToServers = null;
    this.marchSnapshotGeneration++;
    this.buildSubmitOwner = null;
    this.buildSubmitState = "idle";
    this.recruitSubmitOwner = null;
    this.recruitTroopSubmitState = "idle";
    this.resetMarchHeroTracking();
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
    this.battleReports?.getRoot().remove();
    this.marchList?.detach();
    this.dailyQuest?.detach();
    this.world?.detach();
    this.worldMap?.detach();
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
        this.openMilitaryPanel();
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
    if (action === "return-server-select") {
      if (this.toolbar.contains(btn)) this.returnToServers?.();
      return;
    }
    if (isToolbarBadgeDeepLinkClick(ev)) {
      if (action === "toggle-chat") {
        const social = hudTodoSocialBadgesFromChatSummary(
          this.chatUnreadTracker.getSummary(this.social.getGuildId()),
        );
        if (social.chat > 0) {
          if (!this.social.isChatOpen()) this.social.toggleChat();
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
          return;
        }
        if (target.kind === "daily") {
          this.dailyQuest.openFromTodoBadge(target.cfgId, {
            listFilter: target.listFilter,
            claimableCount: target.claimableCount,
          });
          this.updateDailyToolbarBadge(0);
          return;
        }
        if (target.kind === "queue-building") {
          this.queuePanels.openFromTodoBadge(target.slotKey);
          this.updateQueueToolbarBadge(0);
          return;
        }
        if (target.kind === "battle-report") {
          this.marchArrivalHudReminder = null;
          void this.battleReports
            .openPanelWithDeepLink(target.reportId)
            .then(() => this.renderHud());
          return;
        }
      }
    }
    if (action === "upgrade-farm") {
      this.resetBuildSubmitState();
      this.buildingPanel.selectSlot("farm");
      this.status = "建造：农田";
      this.renderHud();
    }
    if (action === "refresh") void this.refreshState();
    if (action === "toggle-city-scene") {
      this.citySceneMode = this.citySceneMode === "inner" ? "outer" : "inner";
      this.slotUpgradeOverlay?.setSlots(citySlotsForMode(this.citySceneMode));
      this.slotUpgradeOverlay?.sync(this.session?.buildings, Date.now());
      this.activeDomesticSlotKey = null;
      this.buildingPanel.close();
      this.domesticSlotStrip?.setSelectedSlotKey("");
      this.status = this.citySceneMode === "outer" ? "外城：资源田随官府等级扩展" : "内城：官府与功能建筑";
      this.renderHud();
      return;
    }
    if (action === "toggle-military") {
      toggleCenterPanel(this.militaryPanel);
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
      if (!this.heroMail.isMailOpen()) void this.hudTodoBadgePoll.pollOnce();
    }
    if (action === "open-world-map") this.openWorldMap();
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
      if (this.gateway.preparedRecruit === true) {
        this.queuePanels.open();
        return;
      }
      const qid = Number(btn.dataset.queueId) || this.recruitQueueHighlightId || 0;
      if (qid > 0) this.openRecruitQueueAndHighlight(qid);
      return;
    }
    if (action === "recruit") void this.recruit();
    if (action === "retry-prepared-recruit") void this.recruitPrepared(true);
    if (action === "march") void this.startMarch();
    if (action === "clear-march-target") {
      clearMarchTargetFromForm(this.militaryPanel);
      this.clearMinimapWorldGridFocus();
      this.intelRemarchTroopsLine = null;
      this.marchList.clearRecentMarchHighlight();
      this.status = "已清除出征目标记忆，表单恢复默认坐标";
      this.renderHud();
      this.syncMilitaryPanel();
    }
  }

  private onMilitaryFormInput(ev: Event): void {
    const field = (ev.target as HTMLElement).getAttribute("data-field");
    if (field !== "to-x" && field !== "to-y" && field !== "march-count" && field !== "march-hero" && field !== "march-unit") {
      return;
    }
    if (field === "to-x" || field === "to-y") {
      if (!this.suppressMarchTargetHighlightClear) {
        this.marchList.clearRecentMarchHighlight();
        this.intelRemarchTroopsLine = null;
      }
      syncMarchTargetSessionFromForm(this.militaryPanel);
      this.syncMinimapFocusFromMarchTarget();
      this.syncIntelListFromMarchFormCoords();
    }
    this.syncMilitaryPanel();
    if (field === "march-unit") this.renderHud();
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
        this.openMilitaryPanel();
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

  private static readonly MARCH_SPEEDUP_ITEM_CFG_ID = 2100;

  private hasMarchSpeedupItem(): boolean {
    return (this.session?.bag ?? []).some(
      (stack) => stack.item_cfg_id === MainCityScene.MARCH_SPEEDUP_ITEM_CFG_ID && stack.quantity > 0,
    );
  }

  private async recallMarch(march: MarchSummary): Promise<void> {
    const id = march.march_id ?? 0;
    if (!id) return;
    try {
      await this.gateway.recallMarch(id);
      this.status = `行军 #${id} 已召回，部队返程中`;
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("march", error);
    }
    this.renderHud();
  }

  private async speedupMarch(march: MarchSummary): Promise<void> {
    const id = march.march_id ?? 0;
    if (!id) return;
    try {
      const result = (await this.gateway.speedupMarch(id, MainCityScene.MARCH_SPEEDUP_ITEM_CFG_ID)) as {
        reduced_sec?: number;
      };
      const minutes = Math.max(1, Math.round((result.reduced_sec ?? 0) / 60));
      this.status = `行军 #${id} 急行军，缩短 ${minutes} 分钟`;
      if (this.session) {
        this.session.bag = this.session.bag
          .map((stack) =>
            stack.item_cfg_id === MainCityScene.MARCH_SPEEDUP_ITEM_CFG_ID
              ? { ...stack, quantity: stack.quantity - 1 }
              : stack,
          )
          .filter((stack) => stack.quantity > 0);
      }
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("march", error);
    }
    this.renderHud();
  }

  private openWorldMap(): void {
    if (!this.session) return;
    this.worldMap.open(this.session.cityX ?? 60, this.session.cityY ?? 60);
    this.renderHud();
  }

  private prefillMarchTargetFromWorld(x: number, y: number): void {
    this.openMilitaryPanel();
    const xInput = this.field("to-x") as HTMLInputElement | null;
    const yInput = this.field("to-y") as HTMLInputElement | null;
    if (xInput) {
      xInput.value = String(x);
      xInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (yInput) {
      yInput.value = String(y);
      yInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setMarchTargetFieldHighlight(this.militaryPanel, true);
    this.status = `出征目标已从大地图设为 (${x}, ${y})`;
    this.syncMilitaryPanel();
    this.renderHud();
  }

  private openMilitaryFromIntelRemarch(march: MarchSummary): void {
    const prefill = buildMarchIntelRemarchPrefill(march);
    if (!prefill) {
      this.status = "该行缺少有效目的格点，无法再出征";
      this.renderHud();
      return;
    }
    this.openMilitaryPanel();
    resetCenterPanelViewportScroll(this.militaryPanel);
    this.suppressMarchTargetHighlightClear = true;
    applyMarchIntelRemarchPrefillWithFeedback(
      this.militaryPanel,
      prefill,
      this.marchFormFeedbackContext(),
    );
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
      troopsEl.textContent = `城内兵力：${this.session?.garrisonStatus === "ready" ? formatTroopStacks(this.session.cityTroops) : "待同步（请刷新）"}`;
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
      readyGarrison(this.session),
      marchSnap.unitCfgId,
    );
    if (troopReserve && this.session?.garrisonStatus !== "ready") troopReserve.line = "城内可用兵力待同步（请刷新）";
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
      unitCfgId: marchSnap.unitCfgId,
      heroIdRaw: marchSnap.heroIdRaw,
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      cityX: this.session?.cityX,
      cityY: this.session?.cityY,
      cityTroops: readyGarrison(this.session),
    });
    syncMarchSubmitButton(
      this.militaryPanel,
      this.marchSubmitState,
      marchFormAllowsSubmit(marchValidated, troopReserve),
    );
    const preparedRecruit = this.gateway.preparedRecruit === true;
    const canRecruit = preparedRecruit
      ? this.preparedRecruitIntent() !== null
      : syncTroopRecruitFormPreview(this.militaryPanel, this.session?.wallet)?.canAfford ?? false;
    if (preparedRecruit) {
      const preview = this.militaryPanel.querySelector('[data-role="troop-recruit-preview"]');
      if (preview) preview.textContent = "费用和耗时由服务器核定";
      const retry = this.militaryPanel.querySelector<HTMLButtonElement>('[data-action="retry-prepared-recruit"]');
      if (retry) {
        retry.hidden = false;
        retry.disabled = this.recruitTroopSubmitState === "submitting";
      }
    }
    syncRecruitTroopSubmitButton(
      this.militaryPanel,
      this.recruitTroopSubmitState,
      canRecruit,
    );
    const recruitSnapshot = this.queuePanels?.getRecruitQueueSnapshot() ?? [];
    const highlightId =
      this.recruitQueueHighlightId ??
      readRecruitHighlightQueueSession() ??
      this.queuePanels?.getHighlightedRecruitQueueId() ??
      null;
    if (preparedRecruit) {
      const list = this.militaryPanel.querySelector('[data-role="military-recruit-queue-list"]');
      if (list) renderCurrentRecruitQueue(list, this.session?.currentRecruitQueue ?? null);
      this.militaryPanel.querySelector('[data-role="recruit-view-queue-wrap"]')?.classList.remove("hidden");
    } else {
      syncMilitaryRecruitQueueList(this.militaryPanel, recruitSnapshot, Date.now(), highlightId);
      syncMilitaryRecruitViewQueueLink(this.militaryPanel, recruitSnapshot, highlightId);
    }
    syncMarchFormInlineFeedback(this.militaryPanel, this.marchFormFeedbackContext());
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
      cityTroops: readyGarrison(this.session),
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
    this.openMilitaryPanel();
    resetCenterPanelViewportScroll(this.militaryPanel);
    applyRecruitQueueJumpToMilitaryPanel(this.militaryPanel, target);
    this.queuePanels.highlightRecruitQueue(target.queue_id);
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
    const synced = syncMinimapViewportToIntelRow(
      {
        march,
        bounds,
        currentView: this.minimapView,
        layoutFrame: this.layoutFrame,
      },
      { timers: this.minimapViewportIntelSyncTimers },
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

  private layoutFromPointerEvent(ev: Pick<MouseEvent, "clientX" | "clientY">): { x: number; y: number } {
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
        if (typeof tx === "number" && typeof ty === "number" && Number.isFinite(tx) && Number.isFinite(ty)) {
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

    const hits = [...citySlotsForMode(this.citySceneMode)]
      .sort((a, b) => b.z - a.z)
      .filter((slot) => this.pointInRect(layout, slot.hit));
    const top = hits[0];
    if (!top) return;
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
    if (showHall) {
      void this.refreshCityOfficePanel();
      void this.refreshCityCivic();
    }
    if (slotKey === "academy") void this.refreshTechnics();
    if (slotKey === "recruit_hall") void this.refreshCityOffices();
    if (slotKey === "hall") {
      void this.refreshRank();
      void this.refreshSpecialCities();
      void this.refreshMeta();
    }
    if (slotKey === "beacon") void this.refreshIntel();
    if (slotKey === "diplomacy") void this.refreshDiplomacy();
    if (slotKey === "wall") void this.refreshWallDefenses();
    if (slotKey === "market") void this.refreshMarket();
    if (slotKey === "warehouse") void this.refreshStorehouse();
    if (slotKey === "drill_ground") {
      void this.refreshTactics();
      void this.refreshCampaignStages();
      void this.refreshArenaOpponents();
    }
    if (slotKey === "smithy" || slotKey === "stable") void this.refreshEquipment();
    if (slotKey === "inn") void this.refreshHistorical();
  }

  private getCityOfficeContext() {
    if (!this.cityOfficeContext?.current()) {
      const actor = captureActor(this.gateway, () => this.session);
      const generation = this.marchSnapshotGeneration;
      const panel = this.cityOfficePanel;
      const context = { current: (): boolean => this.cityOfficeContext === context &&
        actor() && panel === this.cityOfficePanel && generation === this.marchSnapshotGeneration,
        version: 0, busy: false, uncertain: false };
      this.cityOfficeContext = context;
    }
    return this.cityOfficeContext;
  }

  private async refreshCityOfficePanel(): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    const context = this.getCityOfficeContext();
    if (context.busy) return;
    const version = ++context.version;
    const current = () => context.current() && context.version === version;
    this.cityOfficePanel.setPhase("loading");
    this.cityOfficePanel.setFormError(null);
    try {
      const bundle = await loadCityOfficeBundle(this.gateway, session.serverId, session.cityId, this.minimapMarches);
      if (!current()) return;
      context.uncertain = false;
      this.cityOfficePanel.setMarchingHeroIds(bundle.marchingHeroIds);
      this.cityOfficePanel.setHeroes(bundle.heroes);
      this.cityOfficePanel.setChiefView(bundle.chief);
    } catch (e) {
      if (!current()) return;
      context.uncertain = true;
      this.cityOfficePanel.setFormError(`${formatCityChiefGatewayError(e)}；状态待核实，请重新打开官府刷新`);
    } finally {
      if (current()) this.cityOfficePanel.setPhase(context.uncertain ? "uncertain" : "idle");
    }
  }

  private async refreshCityCivic(): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    try {
      const res = (await this.gateway.getCityCivic(session.cityId)) as {
        civic?: CityCivicView;
      };
      if (this.session !== session) return;
      this.cityOfficePanel.setCivicView(res.civic ?? null);
    } catch (error) {
      if (this.session !== session) return;
      this.cityOfficePanel.setFormError(formatPanelGatewayErrorFromUnknown("build", error));
    }
  }

  private async refreshWallDefenses(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listWallDefenses(session.cityId)) as {
        defenses?: WallDefenseRow[]; wall_area?: number; area_used?: number;
      };
      if (this.session !== session) return;
      this.buildingPanel.setWallDefenses(res.defenses ?? [], res.wall_area ?? 0, res.area_used ?? 0);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async wallAction(action: string, defenseType: number, unitId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      if (action === "build-defense") {
        const res = (await this.gateway.buildWallDefense(session.cityId, defenseType)) as {
          defenses?: WallDefenseRow[]; wall_area?: number; area_used?: number; wallet?: ResourceWallet;
        };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        this.buildingPanel.setWallDefenses(res.defenses ?? [], res.wall_area ?? 0, res.area_used ?? 0);
        this.status = "城防已建造";
      } else if (action === "heal-wounded") {
        const res = (await this.gateway.healWounded(session.cityId, unitId, 9999)) as { healed?: number };
        await this.refreshState();
        this.status = `伤兵已治疗 ${res.healed ?? 0} 人`;
      }
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshTactics(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listTacticPresets(session.cityId)) as {
        presets?: { unit_cfg_id?: number; target_type?: number; hold?: boolean }[];
      };
      if (this.session !== session) return;
      this.buildingPanel.setTactics(res.presets ?? []);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async saveTactic(unitCfgId: number, targetType: number, hold: boolean): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.setTacticPreset(session.cityId, unitCfgId, targetType, hold)) as {
        presets?: { unit_cfg_id?: number; target_type?: number; hold?: boolean }[];
      };
      if (this.session !== session) return;
      this.buildingPanel.setTactics(res.presets ?? []);
      this.status = "校场战术已保存";
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async runDrill(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.runDrill(
        session.cityId,
        [{ unit_cfg_id: 1, count: 100 }],
        [{ unit_cfg_id: 3, count: 100 }],
      )) as { detail?: { result?: string; start_distance?: number; rounds?: unknown[]; final_defenses?: Record<string, number> } };
      const detail = res.detail;
      const rounds = detail?.rounds?.length ?? 0;
      const walls = detail?.final_defenses && Object.keys(detail.final_defenses).length
        ? Object.entries(detail.final_defenses).map(([code, n]) => `${code} ${n}`).join("、")
        : "无";
      this.buildingPanel.setDrillResult(
        `沙盘结果：${detail?.result ?? "—"} · 开场距离 ${detail?.start_distance ?? 0} · ${rounds} 回合 · 城防 ${walls}`,
      );
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshDiplomacy(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const [rel, gar] = (await Promise.all([
        this.gateway.listGuildRelations(1),
        this.gateway.listGuildGarrison(session.cityId),
      ])) as [{ relations?: Record<string, unknown>[] }, { troops?: Record<string, unknown>[] }];
      if (this.session !== session) return;
      this.buildingPanel.setDiplomacy((rel.relations ?? []) as never, (gar.troops ?? []) as never);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshMeta(): Promise<void> {
    const session = this.session;
    try {
      const [ach, world] = (await Promise.all([this.gateway.listAchievements(), this.gateway.getWorldProgress()])) as [
        { achievements?: Record<string, unknown>[] },
        { phase?: number; name?: string; next?: string; owned_cities?: number | string; campaign_clears?: number | string },
      ];
      if (this.session !== session) return;
      this.buildingPanel.setAchievements((ach.achievements ?? []) as never, world);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async claimAchievement(achievementId: number): Promise<void> {
    if (!achievementId) return;
    try {
      const res = (await this.gateway.claimAchievement(achievementId)) as {
        achievement?: { name?: string };
        gold?: number | string;
        prestige?: number | string;
      };
      this.status = `成就「${res.achievement?.name ?? achievementId}」已领取：金 ${res.gold ?? 0} 声望 ${res.prestige ?? 0}`;
      await this.refreshMeta();
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private mountUnitArtStrip(): void {
    const strip = this.militaryPanel.querySelector<HTMLElement>('[data-role="unit-art-strip"]');
    if (!strip) return;
    strip.textContent = "";
    for (let id = 1; id <= 18; id++) {
      const pack = this.assets.getImageForAsset(`unit.icon.${id}.v1`);
      if (!pack) continue;
      const img = document.createElement("img");
      img.src = pack.img.src;
      img.width = 24;
      img.height = 24;
      img.alt = "";
      img.title = `兵种 ${id}`;
      strip.appendChild(img);
    }
  }

  private async refreshArenaOpponents(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listArenaOpponents(session.cityId)) as { opponents?: Record<string, unknown>[] };
      if (this.session !== session) return;
      this.buildingPanel.setArenaOpponents((res.opponents ?? []) as never);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async arenaAction(_action: string, opponentId: number, unit: number, count: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !opponentId) return;
    try {
      const res = (await this.gateway.fightArenaOpponent(session.cityId, opponentId, [{ unit_cfg_id: unit, count }])) as {
        result?: string;
        first_win?: boolean;
        reward_gold?: number | string;
        reward_prestige?: number | string;
        attacker_survived?: number;
        attacker_initial?: number;
      };
      const won = res.result === "attacker_win";
      const reward = res.first_win
        ? ` · 首胜：金 ${res.reward_gold ?? 0} 声望 ${res.reward_prestige ?? 0}`
        : won ? " · 今日首胜奖励已领取" : "";
      this.status = `比武${won ? "胜利" : "失败"} · 存活 ${res.attacker_survived ?? 0}/${res.attacker_initial ?? 0}${reward}`;
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshCampaignStages(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listCampaignStages(session.cityId)) as { stages?: Record<string, unknown>[] };
      if (this.session !== session) return;
      this.buildingPanel.setCampaignStages((res.stages ?? []) as never);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async campaignAction(_action: string, stageId: number, unit: number, count: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !stageId) return;
    try {
      const res = (await this.gateway.fightCampaignStage(session.cityId, stageId, [{ unit_cfg_id: unit, count }])) as {
        result?: string;
        stars?: number;
        first_clear?: boolean;
        reward_gold?: number | string;
        reward_prestige?: number | string;
        attacker_survived?: number;
        attacker_initial?: number;
      };
      const won = res.result === "attacker_win";
      const rewards = res.first_clear
        ? ` · 首通奖励：金 ${res.reward_gold ?? 0} 声望 ${res.reward_prestige ?? 0}`
        : "";
      this.status = `战役${won ? "胜利" : "失败"} · ${res.stars ?? 0} 星 · 存活 ${res.attacker_survived ?? 0}/${res.attacker_initial ?? 0}${rewards}`;
      await this.refreshCampaignStages();
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshSpecialCities(): Promise<void> {
    const session = this.session;
    try {
      const res = (await this.gateway.listSpecialCities()) as {
        cities?: Record<string, unknown>[];
        unlocked_units?: number[];
      };
      if (this.session !== session) return;
      this.buildingPanel.setSpecialCities((res.cities ?? []) as never, res.unlocked_units ?? []);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async specialCityAction(action: string, unit: number, count: number): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      if (action === "refresh-special") {
        await this.refreshSpecialCities();
        this.status = "名城列表已刷新";
      } else if (action === "claim-special-tax") {
        const res = (await this.gateway.claimSpecialCityTax()) as {
          cities?: number;
          food?: number | string;
          wood?: number | string;
          stone?: number | string;
          iron?: number | string;
          gold?: number | string;
        };
        this.status = `名城税赋 ${res.cities ?? 0} 城：粮 ${res.food ?? 0} 木 ${res.wood ?? 0} 石 ${res.stone ?? 0} 铁 ${res.iron ?? 0} 金 ${res.gold ?? 0}`;
      } else if (action === "recruit-special") {
        const res = (await this.gateway.recruitSpecialTroops(session.cityId, unit, count)) as {
          city_troop_count?: number;
        };
        this.status = `精锐招募完成，现有 ${res.city_troop_count ?? 0}`;
      }
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async diplomacyAction(action: string, guildId: number, targetGuildId: number, cityId: number, unit: number, count: number, fromCityId = 0): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      if (action === "guild-friendly") {
        await this.gateway.setGuildRelation(guildId, targetGuildId, 1);
      } else if (action === "guild-hostile") {
        await this.gateway.setGuildRelation(guildId, targetGuildId, 3);
      } else if (action === "station-garrison") {
        await this.gateway.stationGuildTroops(cityId, guildId, unit, count, fromCityId || cityId);
      } else if (action === "withdraw-garrison") {
        await this.gateway.withdrawGuildGarrison(cityId, guildId, fromCityId || cityId, unit, count);
      }
      await this.refreshDiplomacy();
      this.status = "外交操作完成";
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshIntel(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      const [warn, reports] = (await Promise.all([
        this.gateway.listBeaconWarnings(),
        this.gateway.listScoutReports(20),
      ])) as [
        { warnings?: Record<string, unknown>[] },
        { reports?: Record<string, unknown>[] },
      ];
      if (this.session !== session) return;
      this.buildingPanel.setIntel((warn.warnings ?? []) as never, (reports.reports ?? []) as never);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshRank(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      const res = (await this.gateway.getPlayerRank()) as { rank?: Record<string, unknown> };
      if (this.session !== session) return;
      this.buildingPanel.setRank(res.rank ?? null);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async rankAction(action: "promote" | "found" | "transfer" | "truce", name: string, x: number, y: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      if (action === "truce") {
        const res = (await this.gateway.useTruceToken(session.cityId)) as { protection_until_ms?: number };
        this.status = `免战至 ${new Date(res.protection_until_ms ?? 0).toLocaleString()}`;
      } else if (action === "promote") {
        const res = (await this.gateway.promoteRank(session.cityId)) as { rank?: Record<string, unknown>; gold?: number };
        this.buildingPanel.setRank(res.rank ?? null);
        this.status = `爵位已晋升，余金 ${res.gold ?? 0}`;
      } else if (action === "transfer") {
        const unit = Number(name);
        const res = (await this.gateway.transferCityTroops(session.cityId, x, unit, y)) as {
          from_count?: number; to_count?: number;
        };
        this.status = `调兵完成：来源 ${res.from_count ?? 0}，目标 ${res.to_count ?? 0}`;
        await this.refreshState();
      } else {
        await this.gateway.createCity(session.serverId, name, x, y);
        this.status = `已在 (${x},${y}) 筑城`;
        await this.refreshState();
      }
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async castTrick(trickType: number, targetMarchId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.castTrick(session.cityId, trickType, targetMarchId)) as {
        success?: boolean; chance?: number; roll?: number; new_deadline_ms?: number; feint_until_ms?: number;
      };
      const eta = res.new_deadline_ms ? new Date(res.new_deadline_ms).toLocaleTimeString() : "";
      const feint = res.feint_until_ms ? new Date(res.feint_until_ms).toLocaleTimeString() : "";
      this.buildingPanel.setTrickResult(
        `计谋${res.success ? "成功" : "失败"}（判定 ${res.roll ?? 0}/${res.chance ?? 0}）` +
        (eta ? ` · 新 ETA ${eta}` : "") + (feint ? ` · 伪装至 ${feint}` : ""),
      );
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshHistorical(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listHistoricalHeroes(session.cityId)) as {
        heroes?: { npc_cfg_id?: number; display_name?: string; level?: number; x?: number; y?: number;
          state?: number; discovered?: boolean }[];
      };
      if (this.session !== session) return;
      this.buildingPanel.setHistorical(res.heroes ?? []);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async historicalAction(action: string, npcCfgId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      if (action === "search-historical") {
        const res = (await this.gateway.searchHistoricalHero(session.cityId, npcCfgId)) as { gold?: number };
        this.status = `传闻已打听到位，余金 ${res.gold ?? 0}`;
      } else if (action === "persuade-historical") {
        const res = (await this.gateway.persuadeHistoricalHero(session.cityId, npcCfgId)) as { hero_id?: number; gold?: number };
        this.status = `名将已归顺（将领#${res.hero_id ?? 0}），余金 ${res.gold ?? 0}`;
      }
      await this.refreshState();
      await this.refreshHistorical();
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async equipmentHeroId(): Promise<number> {
    const session = this.session;
    if (!session) return 0;
    const res = (await this.gateway.listPlayerHeroes(session.serverId)) as {
      heroes?: { hero_id?: number; is_monarch?: boolean }[];
    };
    const heroes = res.heroes ?? [];
    return heroes.find((h) => h.is_monarch)?.hero_id ?? heroes[0]?.hero_id ?? 0;
  }

  private async refreshEquipment(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const heroId = await this.equipmentHeroId();
      if (!heroId) {
        this.status = "暂无可装备的将领";
        this.renderHud();
        return;
      }
      const res = (await this.gateway.getHeroEquipment(session.cityId, heroId)) as {
        equipped?: Record<string, unknown>[]; inventory?: Record<string, unknown>[];
        blacksmith_level?: number; stable_level?: number;
      };
      if (this.session !== session) return;
      this.buildingPanel.setEquipment(heroId, (res.equipped ?? []) as never, (res.inventory ?? []) as never,
        res.blacksmith_level ?? 0, res.stable_level ?? 0);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async equipmentAction(action: string, slotType: number, tier: number, equipmentId: number, gemCfgId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const heroId = await this.equipmentHeroId();
      if (action === "forge-equipment") {
        await this.gateway.forgeEquipment(session.cityId, slotType, tier);
      } else if (action === "enhance-equipment") {
        await this.gateway.enhanceEquipment(session.cityId, equipmentId);
      } else if (action === "socket-gem") {
        await this.gateway.socketGem(session.cityId, equipmentId, gemCfgId);
      } else if (action === "equip-item") {
        await this.gateway.equipItem(session.cityId, heroId, equipmentId);
      } else if (action === "unequip-item") {
        await this.gateway.unequipItem(session.cityId, heroId, slotType);
      } else if (action === "train-mount") {
        await this.gateway.trainMount(session.cityId, equipmentId);
      }
      await this.refreshState();
      await this.refreshEquipment();
      this.status = "装备操作完成";
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshMarket(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.getMarket(session.cityId)) as Record<string, unknown>;
      if (this.session !== session) return;
      this.buildingPanel.setMarket(res);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshStorehouse(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.getStorehouse(session.cityId)) as { storehouse?: Record<string, unknown> };
      if (this.session !== session) return;
      this.buildingPanel.setStorehouse(res.storehouse ?? null);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async marketAction(action: string, resourceType: number, amount: number, priceMilli: number, hours: number, offerId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      if (action === "buy-merchant") {
        const res = (await this.gateway.buyFromMerchant(session.cityId, resourceType, amount)) as {
          gold?: number; gold_paid?: number; wallet?: ResourceWallet;
        };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        this.status = `买入 ${amount} 资源，支付 ${res.gold_paid ?? 0} 金`;
      } else if (action === "sell-merchant") {
        const res = (await this.gateway.sellToMerchant(session.cityId, resourceType, amount)) as {
          gold?: number; gold_gained?: number; wallet?: ResourceWallet;
        };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        this.status = `卖出 ${amount} 资源，获得 ${res.gold_gained ?? 0} 金`;
      } else if (action === "create-offer") {
        const res = (await this.gateway.createMarketOffer(session.cityId, resourceType, amount, priceMilli, hours)) as {
          wallet?: ResourceWallet;
        };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        this.status = `已发布 ${amount} 资源挂单`;
      } else if (action === "cancel-offer") {
        const res = (await this.gateway.cancelMarketOffer(session.cityId, offerId)) as { wallet?: ResourceWallet };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        this.status = "挂单已取消，资源已返还";
      } else if (action === "buy-offer") {
        const res = (await this.gateway.buyMarketOffer(session.cityId, offerId)) as {
          wallet?: ResourceWallet; deliver_at_ms?: number;
        };
        if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
        const eta = res.deliver_at_ms ? new Date(res.deliver_at_ms).toLocaleTimeString() : "稍后";
        this.status = `商队已出发，预计 ${eta} 到达`;
      }
      await this.refreshState();
      await this.refreshMarket();
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshCityOffices(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const [officesRes, heroesRes] = (await Promise.all([
        this.gateway.listCityOffices(session.cityId),
        this.gateway.listPlayerHeroes(session.serverId),
      ])) as [
        { offices?: CityOfficeRow[] },
        { heroes?: { hero_id?: number; display_name?: string; name?: string; level?: number; status?: number }[] },
      ];
      if (this.session !== session) return;
      this.buildingPanel.setCityOffices(
        officesRes.offices ?? [],
        (heroesRes.heroes ?? []).map((h) => ({
          hero_id: h.hero_id, name: h.display_name ?? h.name, level: h.level, status: h.status,
        })),
      );
    } catch (error) {
      console.log("office error", String(error));
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async cityOfficeAction(action: string, office: number, heroId: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      let res: { offices?: CityOfficeRow[]; wallet?: ResourceWallet } = {};
      if (action === "appoint") {
        res = (await this.gateway.setCityOffice(session.cityId, office, heroId)) as typeof res;
      } else if (action === "clear") {
        res = (await this.gateway.clearCityOffice(session.cityId, office)) as typeof res;
      } else if (action === "pay") {
        res = (await this.gateway.payCityOfficeSalary(session.cityId)) as typeof res;
      } else if (action === "reward") {
        await this.gateway.rewardCityOfficeHero(session.cityId, heroId);
      }
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
      if (res.offices) this.buildingPanel.updateCityOffices(res.offices);
      this.status = "招贤馆任命已更新";
      this.renderHud();
      await this.refreshCityOffices();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async refreshTechnics(): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.listTechnics(session.cityId)) as {
        technics?: TechnicRow[];
        job?: { tid?: number; target?: number; finish_at_ms?: number } | null;
      };
      if (this.session !== session) return;
      this.buildingPanel.setTechnics(res.technics ?? [], res.job ?? null);
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async startTechnicResearch(tid: number): Promise<void> {
    const session = this.session;
    if (!session?.cityId) return;
    try {
      const res = (await this.gateway.startTechnicResearch(session.cityId, tid)) as {
        wallet?: ResourceWallet;
        finish_at_ms?: number;
      };
      if (this.session !== session) return;
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
      this.status = `书院开始研究科技 #${tid}`;
      this.renderHud();
      await this.refreshTechnics();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.renderHud();
    }
  }

  private async applyCityDecree(decree: number, value: number, name: string): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    try {
      const res = (await this.gateway.applyCityDecree(session.cityId, decree, value, name)) as {
        civic?: CityCivicView;
        wallet?: ResourceWallet;
      };
      if (this.session !== session) return;
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
      if (typeof res.civic?.gold === "number") this.session.wallet.gold = res.civic.gold;
      if (decree === 5 && res.civic?.name) this.session.cityName = res.civic.name;
      this.cityOfficePanel.setCivicView(res.civic ?? null);
      this.status = "官府政令已执行";
      this.renderHud();
    } catch (error) {
      this.cityOfficePanel.setFormError(formatPanelGatewayErrorFromUnknown("build", error));
    }
  }

  private async appointCityChief(heroId: number): Promise<void> {
    if (heroId > 0) await this.submitCityChief(heroId);
  }

  private async clearCityChief(): Promise<void> {
    await this.submitCityChief(null);
  }

  private async submitCityChief(heroId: number | null): Promise<void> {
    const session = this.session;
    if (!session?.cityId || !this.cityOfficePanel) return;
    const context = this.getCityOfficeContext();
    if (context.busy || context.uncertain) return;
    context.busy = true;
    const version = ++context.version;
    const current = () => context.current() && context.version === version;
    this.cityOfficePanel.setPhase(heroId === null ? "clearing" : "appointing");
    this.cityOfficePanel.setFormError(null);
    const { chief, error } = heroId === null
      ? await runClearCityChief(this.gateway, session.serverId, session.cityId)
      : await runSetCityChief(this.gateway, session.serverId, session.cityId, heroId);
    if (!current()) return;
    if (chief) this.cityOfficePanel.setChiefView(chief);
    if (error) {
      // An error can follow a committed/partial mutation. Never replay it or infer vacancy.
      context.uncertain = true;
      try {
        const recovered = await this.gateway.getCityChief(session.serverId, session.cityId);
        if (!current()) return;
        this.cityOfficePanel.setChiefView(parseCityChiefView(recovered));
        context.uncertain = false;
      } catch {
        if (!current()) return;
      }
      this.cityOfficePanel.setFormError(error + (context.uncertain
        ? "；结果待核实，请重新打开官府刷新，勿重复提交"
        : "；已重新读取当前城主状态"));
    } else this.status = heroId === null ? "城主已卸任" : "城主已任命";
    context.busy = false;
    this.cityOfficePanel.setPhase(context.uncertain ? "uncertain" : "idle");
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
      if (this.gateway.preparedRecruit === true) void this.cityStatePoll.pollOnce();
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
    this.openMilitaryPanel();
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

  private async readMarchesForArrival(cityId: number | undefined): Promise<MarchSummary[]> {
    const generation = this.marchSnapshotGeneration;
    const res = await readMarchListSnapshot(this.gateway, cityId,
      () => this.session?.cityId === cityId && this.marchSnapshotGeneration === generation);
    return res.marches;
  }

  private async refreshMinimapMarches(): Promise<void> {
    const cityId = this.session?.cityId;
    if (!cityId) return;
    const current = beginMarchSnapshotRead(this.gateway, () => this.session?.cityId);
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    try {
      const res = await readMarchListSnapshot(this.gateway, cityId,
        () => actor() && generation === this.marchSnapshotGeneration && current());
      if (!actor() || generation !== this.marchSnapshotGeneration || !current(true)) return;
      const marches = res.marches ?? [];
      this.marchList?.syncMinimapMarchFocusFromSnapshot(marches);
      this.applyMarchesSnapshot(marches);
    } catch {
      /* 小地图只读：失败时保留上次数据 */
    }
  }

  private resetMarchHeroTracking(): void {
    this.marchLocalBusyHeroIds = new Set();
    this.marchLocalHeroOrders = new Map();
    this.marchFormHeroes = [];
    this.marchHeroListLoading = false;
    this.marchHeroActor = null;
    this.marchSubmitState = "idle";
  }

  private ensureMarchHeroActor(): void {
    if (this.marchHeroActor && !this.marchHeroActor()) this.resetMarchHeroTracking();
    this.marchHeroActor ??= captureActor(this.gateway, () => this.session);
    this.marchLocalHeroOrders ??= new Map();
  }

  private reconcileReturnedMarchHeroes(marches: MarchSummary[]): void {
    this.ensureMarchHeroActor();
    let changed = false;
    for (const [heroId, marchId] of this.marchLocalHeroOrders) {
      const matching = marches.filter(m => m.march_id === marchId);
      if (!matching.length || matching.some(m => m.phase !== MARCH_PHASE_RETURNED)) continue;
      this.marchLocalHeroOrders.delete(heroId);
      this.marchLocalBusyHeroIds.delete(heroId);
      this.marchFormHeroes = this.marchFormHeroes.map(h => h.hero_id === heroId && h.status === HERO_STATUS_MARCH
        ? { ...h, status: 0 } : h); // Remove our synthetic busy hint, never invent authoritative idle.
      changed = true;
    }
    if (changed) syncMarchHeroSelect(this.militaryPanel, this.marchFormHeroes, this.marchLocalBusyHeroIds);
  }

  private applyMarchesSnapshot(marches: MarchSummary[]): void {
    this.reconcileReturnedMarchHeroes(marches);
    this.minimapMarches = marches;
    const lastId = this.lastMarch?.march_id;
    const last = lastId != null ? marches.find(m => m.march_id === lastId) : undefined;
    if (last) this.lastMarch = last;
    if (this.activeDomesticSlotKey === CITY_CHIEF_HALL_SLOT_KEY) {
      this.cityOfficePanel?.setMarchingHeroIds(heroIdsOnActiveMarch(marches));
    }
    this.world?.refreshMarchDestCounts();
    if (this.militaryPanel && this.marchList) this.syncMilitaryPanel();
    if (this.hud) {
      this.syncMinimapCollapsedMarchStatus();
      this.renderHud();
    }
  }

  private async syncSessionCityCoords(current: () => boolean = () => true): Promise<void> {
    if (!this.session) return;
    try {
      const list = (await this.gateway.listPlayerCities()) as {
        cities?: { city_id?: number; x?: number; y?: number }[];
      };
      if (!current()) return;
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

  private applyCityStateFromFetch(state: CityStateSnapshot): void {
    if (!this.session) return;
    if (!this.cityStateFetch.isCurrent(state)) return;
    if (this.gateway.preparedRecruit === true) {
      this.session.currentRecruitQueue = parseCurrentRecruitQueue(state.recruit_queue);
    }
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
    const afterWallet = mergeCityResourceWallet(this.session.wallet, state.wallet);
    this.patchSession(
      {
        ...garrisonPatch(this.session, state.garrison),
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

  private applyCityStatePoll(state: CityStateSnapshot): void {
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
      const label = formatDomesticQueueCompleteSlotMarginLabel(
        buildingBySlot(buildings, key),
        nowMs,
      );
      scheduleDomesticQueueCompleteSlotMargin(layer, key, label);
    }
  }

  private renderHud(): void {
    const sceneBtn = this.toolbar?.querySelector<HTMLElement>('[data-role="city-scene-btn"]');
    if (sceneBtn) sceneBtn.textContent = this.citySceneMode === "inner" ? "外城" : "内城";
    if (!this.sceneActive) return;
    const s = this.session;
    const now = Date.now();
    if (this.walletGainBrief && now > this.walletGainUntilMs) {
      this.walletGainBrief = null;
    }
    const p = s?.player;
    const troopHint = s?.garrisonStatus === "ready" ? formatTroopStacks(s.cityTroops) : "待同步";
    const groups: string[] = [
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1}`,
    ];
    if (this.walletGainBrief) groups.push(this.walletGainBrief);
    groups.push(formatKeyBuildingHudLine(s?.buildings, SLOT_LABEL, ["hall", "farm"], now));
    if (troopHint !== "无") groups.push(`兵 ${troopHint}`);
    if (this.status) groups.push(this.status);

    const resourceStripExpanded = readHudResourceStripExpanded(this.hud);
    this.hud.replaceChildren();
    appendHudResourceStrip(this.hud, s?.wallet, this.assets, s?.productionRates);
    restoreHudResourceStripExpanded(this.hud, resourceStripExpanded);
    this.appendHudCenterTodoBadge();
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
    this.renderHud();
    void this.hudTodoBadgePoll.pollOnce();
  }

  private onHudClick(ev: Event): void {
    const todoBtn = (ev.target as HTMLElement).closest('[data-action="open-hud-center-todo"]');
    if (todoBtn) {
      this.openHudCenterTodoDeepLink();
      return;
    }
    const el = (ev.target as HTMLElement).closest('[data-action="open-march-reports"]');
    if (!el) return;
    const reportHint = this.marchArrivalHudReminder?.reportId;
    this.marchArrivalHudReminder = null;
    const hint = reportHint;
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
    const generation = this.marchSnapshotGeneration;
    const current = () => this.sceneActive && generation === this.marchSnapshotGeneration;
    this.social.setRankDeepLinkHandlers({
      getViewerHeroIds: async () => {
        if (!current()) return [];
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
        if (!current()) return;
        this.openRankHeroDeepLink(heroId);
      },
      onOpenWorldAtGrid: (gridX, gridY) => {
        if (!current()) return;
        this.openWorldFromRankDeepLink(gridX, gridY);
      },
      onOpenWorldViewer: () => {
        if (!current()) return;
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

  private applyChatUnreadCounts(): void {
    const summary = this.chatUnreadTracker.getSummary(this.social.getGuildId());
    const social = hudTodoSocialBadgesFromChatSummary(summary);
    this.social.syncChatUnreadBadges(summary);
    this.updateChatToolbarBadge(social.chat);
    this.updateGuildToolbarBadge(social.guild);
  }

  private applyHudTodoBadgeCounts(counts: HudTodoBadgeCounts): void {
    if (!this.heroMail?.isMailOpen()) {
      this.updateMailToolbarBadge(counts.mailUnread);
    }
    if (!this.dailyQuest?.isOpen()) {
      this.updateDailyToolbarBadge(counts.dailyTodo);
    } else {
      this.dailyQuest.syncBattleReportUnreadBanner();
    }
    if (!this.queuePanels?.isOpen()) {
      this.updateQueueToolbarBadge(counts.queueBuilding);
    }
    if (!this.battleReports?.isOpen()) {
      this.updateReportsToolbarBadge(counts.battleReportUnread);
    }
    const intelInProgress = this.minimapMarches.filter(marchShowsDestOnMinimap).length;
    if (!this.marchList?.isOpen()) {
      this.updateMarchesToolbarBadge(intelInProgress);
    }
    if (this.militaryPanel?.classList.contains("hidden")) {
      const marchSnap = readMarchFormSnapshot(this.militaryPanel, {
        cityX: this.session?.cityX,
        cityY: this.session?.cityY,
        wallet: this.session?.wallet,
      });
      const troopReserve = buildMarchFormTroopReserveLine(
        marchSnap.marchCountRaw,
        readyGarrison(this.session),
        marchSnap.unitCfgId,
      );
      const marchValidated = validateMarchForm({
        toXRaw: marchSnap.toXRaw,
        toYRaw: marchSnap.toYRaw,
        marchCountRaw: marchSnap.marchCountRaw,
        unitCfgId: marchSnap.unitCfgId,
        heroIdRaw: marchSnap.heroIdRaw,
        ownedHeroes: this.marchFormHeroes,
        localBusyHeroIds: this.marchLocalBusyHeroIds,
        cityX: this.session?.cityX,
        cityY: this.session?.cityY,
        cityTroops: readyGarrison(this.session),
      });
      const marchSubmittable =
        this.marchSubmitState === "submitting" ? 0 : marchFormAllowsSubmit(marchValidated, troopReserve) ? 1 : 0;
      this.updateMilitaryToolbarBadge(marchSubmittable);
    }
    this.renderHud();
  }

  private async refreshState(current: () => boolean = () => true): Promise<void> {
    if (!this.session || !current()) return;
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const owned = () => this.session === session && actor() &&
      generation === this.marchSnapshotGeneration && current();
    this.status = "刷新中…";
    this.renderHud();
    try {
      const state = await this.cityStateFetch.fetch();
      if (!owned()) return;
      if (state) {
        this.applyCityStateFromFetch(state);
      }
      await this.syncSessionCityCoords(owned);
      if (!owned()) return;
      await this.refreshMinimapMarches();
      if (!owned()) return;
      this.status = "已刷新";
    } catch (e) {
      if (!owned()) return;
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
    if (this.buildSubmitOwner?.()) return;
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const current = () => this.buildSubmitOwner === current && this.session === session &&
      actor() && generation === this.marchSnapshotGeneration;
    this.buildSubmitOwner = current;
    this.buildSubmitState = "idle";
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
      if (!current()) return;
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
      const walletAfter = this.session.wallet;
      const pulseKeys = walletBuildDeductPulseKeys(walletBefore, walletAfter, preview?.cost);
      if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
      if (res.building) {
        const idx = this.session.buildings.findIndex((b) => b.slot_key === slotKey);
        if (idx >= 0) this.session.buildings[idx] = res.building;
        else this.session.buildings.push(res.building);
      }
      await this.refreshState(current);
      if (!current()) return;
      this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "SUCCESS" });
      this.status = formatBuildSubmitSuccess(slotKey, targetLevel, SLOT_LABEL);
      this.buildingPanel.sync();
    } catch (e) {
      if (!current()) return;
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.buildSubmitState = buildSubmitStateMachine(this.buildSubmitState, { type: "FAIL" });
      this.buildingPanel.setFormError(msg);
      this.status = msg;
      this.buildingPanel.sync();
    } finally {
      if (this.buildSubmitOwner === current) this.buildSubmitOwner = null;
    }
    this.renderHud();
  }

  private async demolishBuilding(slotKey: string): Promise<void> {
    if (!this.session || this.buildSubmitOwner?.()) return;
    const building = buildingBySlot(this.session.buildings, slotKey);
    if (!building) return;
    const label = SLOT_LABEL[slotKey] ?? slotKey;
    const currentLevel = building.level ?? 1;
    const action = currentLevel <= 1 ? "拆除" : `降级到 Lv${currentLevel - 1}`;
    if (!window.confirm(`确定对 ${label}（Lv${currentLevel}）执行${action}？将返还该级 25% 资源。`)) return;
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    try {
      const res = (await this.gateway.demolishBuilding(session.cityId, slotKey)) as {
        wallet?: ResourceWallet;
        building?: CityBuilding;
        removed?: boolean;
        refund?: ResourceWallet;
      };
      if (!actor()) return;
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
      if (res.removed) {
        this.session.buildings = this.session.buildings.filter((b) => b.slot_key !== slotKey);
      } else if (res.building) {
        const idx = this.session.buildings.findIndex((b) => b.slot_key === slotKey);
        if (idx >= 0) this.session.buildings[idx] = res.building;
      }
      await this.refreshState();
      this.buildingPanel.sync();
      this.status = `${label}${res.removed ? "已拆除" : `已降级到 Lv${res.building?.level ?? 0}`}`;
      this.renderHud();
    } catch (error) {
      this.status = formatPanelGatewayErrorFromUnknown("build", error);
      this.buildingPanel.setFormError(this.status);
      this.buildingPanel.sync();
      this.renderHud();
    }
  }

  private preparedRecruitIntent() {
    const city = this.session?.cityId ?? 0;
    const { unitCfgId, count } = readTroopRecruitForm(this.militaryPanel);
    if (!Number.isSafeInteger(city) || city <= 0 || ![1,2,3,4,5,6,7,8,9,10,11,12].includes(unitCfgId) ||
        !Number.isInteger(count) || count <= 0 || count > 2147483647) return null;
    return { city_id: String(city), unit_cfg_id: unitCfgId, count };
  }

  private async recruitPrepared(retry: boolean): Promise<void> {
    if (this.gateway.preparedRecruit !== true || !this.gateway.submitPreparedRecruit ||
        !this.session || this.recruitSubmitOwner?.()) return;
    const intent = retry ? null : this.preparedRecruitIntent();
    if (!retry && !intent) return;
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const current = () => this.recruitSubmitOwner === current && this.session === session &&
      actor() && generation === this.marchSnapshotGeneration;
    const feedback = this.militaryPanel.querySelector('[data-role="prepared-recruit-status"]');
    if (feedback) feedback.textContent = "";
    this.recruitSubmitOwner = current;
    this.recruitTroopSubmitState = "submitting";
    this.syncMilitaryPanel();
    this.cityStateFetch.clear();
    let message: string;
    try {
      const result = await this.gateway.submitPreparedRecruit(intent ?? undefined);
      if (!current()) return;
      const statuses = {
        accepted: "募兵已受理",
        rejected: "本次募兵未通过",
        unknown: "募兵结果待确认，请重试上次募兵",
        busy: "另一个页面正在处理募兵，请稍后重试",
        quarantined: "募兵记录需要核验",
        "retry-required": "上次募兵结果待确认，请先重试",
        "nothing-to-retry": "没有待确认的募兵",
      };
      message = statuses[result];
      if (result === "accepted") {
        this.cityStateFetch.clear();
        const state = await this.cityStateFetch.fetch().catch(() => null);
        if (!current()) return;
        if (state) this.applyCityStateFromFetch(state);
      }
    } catch (error) {
      if (!current()) return;
      message = error instanceof Error ? error.message : "暂时无法确认募兵，请重试上次募兵";
    } finally {
      if (this.recruitSubmitOwner === current) this.recruitSubmitOwner = null;
    }
    this.recruitTroopSubmitState = "idle";
    this.status = message;
    if (feedback) feedback.textContent = message;
    this.syncMilitaryPanel();
    this.renderHud();
  }

  private async recruit(): Promise<void> {
    if (this.gateway.preparedRecruit === true) return this.recruitPrepared(false);
    if (!this.session || this.recruitSubmitOwner?.()) return;
    const preview = syncTroopRecruitFormPreview(this.militaryPanel, this.session.wallet);
    if (!preview?.canAfford) {
      setTroopRecruitFormError(this.militaryPanel, preview?.insufficientHint ?? "资源不足");
      this.status = preview?.insufficientHint ?? "资源不足";
      this.renderHud();
      return;
    }
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const current = () => this.recruitSubmitOwner === current && this.session === session &&
      actor() && generation === this.marchSnapshotGeneration;
    this.recruitSubmitOwner = current;
    this.recruitTroopSubmitState = "idle";
    const unitCfgId = preview.troopCfgId;
    const count = preview.qty;
    const walletBefore = this.session.wallet;
    setTroopRecruitFormError(this.militaryPanel, null);
    this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
      type: "SUBMIT",
    });
    this.syncMilitaryPanel();
    this.renderHud();
    this.cityStateFetch.clear();
    let pulseQueueId: number | null = null;
    try {
      const res = (await this.gateway.recruitTroop(this.session.cityId, unitCfgId, count)) as {
        wallet?: ResourceWallet;
        troop?: CityTroopStack;
        queue_id?: number;
        finish_at_ms?: number;
      };
      if (!current()) return;
      this.cityStateFetch.clear();
      if (res.wallet) session.wallet = mergeCityResourceWallet(session.wallet, res.wallet);
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
      if (!current()) return;
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.recruitTroopSubmitState = recruitTroopSubmitStateMachine(this.recruitTroopSubmitState, {
        type: "FAIL",
      });
      setTroopRecruitFormError(this.militaryPanel, msg);
      this.status = msg;
    } finally {
      if (this.recruitSubmitOwner === current) this.recruitSubmitOwner = null;
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

  /** Every explicit entry refreshes the roster; never poll from render/sync. */
  private openMilitaryPanel(): void {
    openCenterPanel(this.militaryPanel);
    if (this.gateway.preparedRecruit === true) void this.cityStatePoll.pollOnce();
    void this.refreshMarchFormHeroes();
  }

  private async refreshMarchFormHeroes(): Promise<void> {
    this.ensureMarchHeroActor();
    if (!this.session || this.marchHeroListLoading) return;
    const sid = this.session.serverId ?? this.gateway.getBoundServerId() ?? 0;
    if (sid <= 0) return;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const current = () => actor() && generation === this.marchSnapshotGeneration;
    this.marchHeroListLoading = true;
    try {
      const res = (await this.gateway.listPlayerHeroes(sid)) as {
        heroes?: MarchHeroRow[];
      };
      if (!current()) return;
      this.marchFormHeroes = mapListPlayerHeroesForMarch(res.heroes);
      const fromStatus = collectMarchBusyHeroIdsFromStatus(this.marchFormHeroes);
      for (const id of fromStatus) this.marchLocalBusyHeroIds.add(id);
      for (const h of this.marchFormHeroes) {
        const id = h.hero_id ?? 0;
        if (id > 0 && (h.status ?? 0) === 1) {
          this.marchLocalBusyHeroIds.delete(id);
          this.marchLocalHeroOrders.delete(id);
        }
      }
      syncMarchHeroSelect(this.militaryPanel, this.marchFormHeroes, this.marchLocalBusyHeroIds);
    } catch {
      // 保留上次列表；出征仍可由网关报错兜底
    } finally {
      if (!current()) return;
      this.marchHeroListLoading = false;
      this.syncMilitaryPanel();
    }
  }

  private async startMarch(): Promise<void> {
    if (!this.session) return;
    this.ensureMarchHeroActor();
    const unitCfgId = readMarchUnitCfgId(this.militaryPanel);
    const validated = validateMarchForm({
      unitCfgId,
      toXRaw: (this.field("to-x") as HTMLInputElement)?.value ?? "",
      toYRaw: (this.field("to-y") as HTMLInputElement)?.value ?? "",
      marchCountRaw: (this.field("march-count") as HTMLInputElement)?.value ?? "",
      heroIdRaw: readMarchHeroIdRaw(this.militaryPanel),
      ownedHeroes: this.marchFormHeroes,
      localBusyHeroIds: this.marchLocalBusyHeroIds,
      cityX: this.session.cityX,
      cityY: this.session.cityY,
      cityTroops: readyGarrison(this.session),
    });
    if (!validated.ok) {
      setMarchFormErrorDisplay(this.militaryPanel, validated.message);
      this.renderHud();
      return;
    }
    const { toX, toY, marchCount, heroId } = validated;
    const purposeRaw = Number((this.field("march-purpose") as HTMLSelectElement)?.value ?? PURPOSE_ATTACK);
    const purpose = [PURPOSE_ATTACK, 2, 3, 4].includes(purposeRaw) ? purposeRaw : PURPOSE_ATTACK;
    const session = this.session;
    const actor = captureActor(this.gateway, () => this.session);
    const generation = this.marchSnapshotGeneration;
    const current = () => actor() && generation === this.marchSnapshotGeneration;
    this.cityStateFetch.clear();
    const presentMarchResult = captureCenterPanelIntent(this.militaryPanel);
    setMarchFormErrorDisplay(this.militaryPanel, null);
    const troops = [{ unit_cfg_id: unitCfgId, count: marchCount }];
    this.marchSubmitState = marchSubmitStateMachine(this.marchSubmitState, { type: "SUBMIT" });
    this.syncMilitaryPanel();
    this.renderHud();
    try {
      const res = (await this.gateway.startMarch(
        this.session.cityId,
        toX,
        toY,
        purpose,
        heroId,
        troops.map((t) => ({ unit_cfg_id: t.unit_cfg_id ?? 1, count: t.count ?? 0 })),
      )) as { march?: MarchSummary; city_troops?: CityTroopStack[] };
      if (this.session !== session || !current()) return;
      this.cityStateFetch.clear();
      this.marchLocalBusyHeroIds.add(heroId);
      const marchId = res.march?.march_id;
      if (marchId != null && Number.isSafeInteger(marchId) && marchId > 0) this.marchLocalHeroOrders.set(heroId, marchId);
      this.marchFormHeroes = this.marchFormHeroes.map((h) =>
        h.hero_id === heroId ? { ...h, status: HERO_STATUS_MARCH } : h,
      );
      this.lastMarch = res.march ?? null;
      if (res.city_troops?.length) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, res.city_troops);
      } else {
        this.session.garrisonStatus = "stale"; // Missing debit data is not authoritative zero.
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
        openPanel: presentMarchResult(),
        march: this.lastMarch,
        toX,
        toY,
      });
      void this.refreshMinimapMarches();
      await this.refreshState();
    } catch (e) {
      if (this.session !== session || !current()) return;
      this.cityStateFetch.clear();
      this.session.garrisonStatus = "stale";
      const msg = formatPanelGatewayErrorFromUnknown("march", e);
      setMarchFormErrorDisplay(this.militaryPanel, msg);
      this.status = msg;
    } finally {
      if (!current()) return;
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
    const sorted = [...citySlotsForMode(this.citySceneMode)].sort((a, b) => a.z - b.z);
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
    const tier = buildingTier(building?.level ?? 0);
    const pack = building
      ? this.assets.getImageForAsset(`${assetId}.lv${tier}`) ?? this.assets.getImageForAsset(assetId)
      : undefined;
    const { display, ground_anchor: ga } = slot;
    if (pack) {
      const anchor = pack.meta.anchor;
      const ax = pack.meta.anchor_unit === "normalized" ? anchor.x * display.w : anchor.x;
      const ay = pack.meta.anchor_unit === "normalized" ? anchor.y * display.h : anchor.y;
      const topX = display.x + ga.x - ax;
      const topY = display.y + ga.y - ay;
      c2d.drawImage(pack.img, topX, topY, display.w, display.h);
    } else {
      // R2-S1 unbuilt slots are hotspot plaques, not opaque placeholder boxes.
      const w = Math.min(display.w, 150);
      const x = display.x + (display.w - w) / 2;
      const y = display.y + display.h / 2 - 14;
      c2d.fillStyle = "rgba(26, 20, 16, 0.72)";
      c2d.fillRect(x, y, w, 28);
      c2d.strokeStyle = "rgba(210, 184, 138, 0.5)";
      c2d.strokeRect(x, y, w, 28);
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "13px system-ui";
      c2d.textAlign = "center";
      c2d.fillText(slot.label, x + w / 2, y + 19);
      c2d.textAlign = "start";
    }
    const now = Date.now();
    const caption = formatSlotBuildingCaption(
      slot.slot_key,
      slot.label,
      building,
      now,
    );
    if (pack && KEY_BUILDING_SLOTS.has(slot.slot_key)) {
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

  private updateMailToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="mail-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "邮件";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0
        ? `${label} · ${unreadCount} 项待处理（未读/未领）`
        : "收件箱",
      this.assets,
    );
  }

  private updateDailyToolbarBadge(todoCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="daily-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "日常";
    setToolbarBadge(
      btn,
      todoCount,
      todoCount > 0 ? `${label} · ${todoCount} 项可领取` : "日常任务",
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
