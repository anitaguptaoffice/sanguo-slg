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
  skinHeroPanel,
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
import { appendHudResourceStrip } from "@/engine/artResourceHud";
import { applyLayoutTransform, canvasToLayout, type LayoutViewport } from "@/engine/layoutViewport";
import {
  LAYOUT_FRAME,
  MAIN_CITY_SLOTS,
  STAGE_HEIGHT,
  STAGE_TOP_Y,
  type MainCitySlotDef,
} from "@/engine/mainCitySlots";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, CityTroopStack, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { SocialPanels } from "@/ui/SocialPanels";
import { ContentPanels } from "@/ui/ContentPanels";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { BattleReportPanel } from "@/ui/BattleReportPanel";
import { MarchListPanel } from "@/ui/MarchListPanel";
import { DailyQuestPanels } from "@/ui/DailyQuestPanels";
import { WorldPanels } from "@/ui/WorldPanels";
import { appendManhattanToStatus } from "@/ui/marchWorldListLink";
import { QueuePanels } from "@/ui/QueuePanels";
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
  readMarchFormSnapshot,
  setMarchFormSummaryDisplay,
} from "@/net/marchFormSummary";
import { setTroopRecruitFormError, syncTroopRecruitFormPreview } from "@/ui/troopRecruitForm";
import { setMarchFormErrorDisplay, validateMarchForm } from "@/net/marchFormValidation";
import {
  applyMarchIntelRemarchPrefill,
  buildMarchIntelRemarchPrefill,
} from "@/net/marchIntelRemarch";
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
import { ChatUnreadPoll } from "@/net/chatUnreadPoll";
import { ChatUnreadTracker } from "@/net/chatUnread";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";
import { HudTodoBadgePoll } from "@/net/hudTodoBadgePoll";
import type { HudTodoBadgeCounts } from "@/net/hudTodoBadge";
import {
  resolveHudTodoOpenTarget,
  type HudTodoToolbarAction,
} from "@/net/hudTodoOpenTarget";
import { buildHudCenterTodoCounts } from "@/net/hudTodoBadges";
import { isToolbarBadgeDeepLinkClick, setToolbarBadge, toolbarButtonLabel } from "@/ui/toolbarBadge";
import { syncToolbarAriaExpanded } from "@/ui/toolbarAriaExpanded";
import { drawWorldMinimap } from "@/ui/drawWorldMinimap";
import {
  DEFAULT_MARCH_TARGET,
  applyMarchTargetAndRemember,
  clearMarchTargetFromForm,
  marchTargetStatusMessage,
  restoreMarchTargetToForm,
  setMarchTargetFieldHighlight,
  writeMarchTargetSession,
} from "@/net/marchTargetMemory";
import {
  DEFAULT_MINIMAP_VIEW,
  MINIMAP_LAYOUT_RECT,
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
import { MainCitySlotUpgradeOverlay } from "@/ui/MainCitySlotUpgradeOverlay";
import { MainCityBuildingPanel } from "@/ui/MainCityBuildingPanel";
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
  private marchSubmitState: MarchSubmitState = "idle";
  private buildSubmitState: BuildSubmitState = "idle";
  private recruitTroopSubmitState: RecruitTroopSubmitState = "idle";
  private intelRemarchTroopsLine: string | null = null;
  private suppressMarchTargetHighlightClear = false;
  private social!: SocialPanels;
  private content!: ContentPanels;
  private heroMail!: HeroMailPanels;
  private battleReports!: BattleReportPanel;
  private marchList!: MarchListPanel;
  private dailyQuest!: DailyQuestPanels;
  private world!: WorldPanels;
  private queuePanels!: QueuePanels;
  private slotUpgradeOverlay!: MainCitySlotUpgradeOverlay;
  private buildingPanel!: MainCityBuildingPanel;
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
  private lastCenterTodoScrollKey: string | null = null;
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
      <button type="button" data-action="upgrade-farm">升级农田</button>
      <button type="button" data-action="refresh">刷新状态</button>
      <button type="button" data-action="toggle-military" title="军事"><span class="toolbar-btn-label">军事</span></button>
      <button type="button" data-action="toggle-reports" data-role="reports-toolbar-btn"><span class="toolbar-btn-label">战报</span></button>
      <button type="button" data-action="toggle-marches">行军</button>
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
      <p class="military-troops" data-role="troops"></p>
      <div class="panel-scroll-body" data-role="military-scroll">
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
        <ul class="queue-list military-recruit-queue hidden" data-role="military-recruit-queue-list"></ul>
        <hr />
        <p class="march-target-hint" data-role="march-target-hint">出征目标可从小地图空白单击或「世界」城池填入；以下坐标会记住到本次会话。</p>
        <div class="march-target-fields" data-role="march-target-fields">
          <label>目标 X <input type="number" data-field="to-x" value="${DEFAULT_MARCH_TARGET.x}" /></label>
          <label>目标 Y <input type="number" data-field="to-y" value="${DEFAULT_MARCH_TARGET.y}" /></label>
        </div>
        <p class="march-intel-last-troops hidden" data-role="march-intel-last-troops"></p>
        <button type="button" data-action="clear-march-target">清除出征目标记忆</button>
        <label>出征步兵 <input type="number" data-field="march-count" min="1" value="50" /></label>
        <p class="march-form-summary" data-role="march-form-summary" aria-live="polite"></p>
        <p class="march-form-summary-warn hidden" data-role="march-form-summary-warn" role="status"></p>
        <p class="march-form-error hidden" data-role="march-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="march">出征攻击</button>
        <p class="military-march" data-role="march"></p>
      </div>
    `;
    const parent = ctx.layoutFrame;
    this.slotUpgradeOverlay = new MainCitySlotUpgradeOverlay(parent);
    this.slotUpgradeOverlay.attach();
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
      (reportId) => {
        this.marchReportToastActive = false;
        void this.battleReports
          .openPanelWithDeepLink(reportId ?? undefined)
          .then(() => this.renderHud());
      },
      (itemCfgIds) => {
        this.content.openBagHighlightItems(itemCfgIds);
        this.status = itemCfgIds.length
          ? `背包已高亮养成道具 ${itemCfgIds.join("、")}，请「使用道具」`
          : "背包暂无养成消耗品（将魂碎晶等）";
        this.renderHud();
      },
      (keys) => {
        if (keys.length) scheduleHudResourcePulse(this.hud, keys);
      },
      this.assets,
    );
    this.heroMail.attach();
    this.heroMail.mountMailFilterSkins(this.assets);
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
          this.world?.refreshMarchDestCounts();
        },
        onMarchArrivalReminders: (reminders) => this.applyMarchArrivalHudReminders(reminders),
        onRemarchFromRow: (march) => this.openMilitaryFromIntelRemarch(march),
        onSelectionChange: (march) => {
          if (march) {
            const tx = march.to_x;
            const ty = march.to_y;
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
              this.world.setMarchDestHighlight({ x: tx, y: ty });
              this.focusMinimapOnMarchDestination(march);
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
          if (grid) {
            this.focusMinimapOnWorldGrid(grid.x, grid.y);
          } else {
            this.clearMinimapWorldGridFocus();
          }
        },
        getMarchesSnapshot: () => {
          const fromPanel = this.marchList.getMarches();
          return fromPanel.length ? fromPanel : this.minimapMarches;
        },
        onMarchCountClick: (grid) => {
          const opened = this.marchList.selectMarchByDest(grid.x, grid.y);
          if (opened) {
            this.status = `军情：已选中指向 (${grid.x},${grid.y}) 的首条行军`;
          } else {
            this.status = `格点 (${grid.x},${grid.y}) 暂无进行中行军`;
          }
          this.renderHud();
        },
        onViewMarchesAtGrid: (grid) => {
          this.marchList.openIntelViewForGrid(grid.x, grid.y);
          this.status = `军情：已筛选目的格 (${grid.x},${grid.y})`;
          this.renderHud();
        },
        getBattleReportsSnapshot: () => this.battleReports.getReportsSnapshot(),
        onViewBattleReportsAtGrid: (grid, hintReportId) => {
          void this.battleReports.openListFilteredByGrid(grid.x, grid.y, hintReportId);
          this.status = `战报：已筛选战场格点 (${grid.x},${grid.y})`;
          this.renderHud();
        },
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
      (slotKey) => this.slotUpgradeOverlay?.setMutualHighlightSlot(slotKey),
    );
    this.queuePanels.attach();
    this.buildingPanel = new MainCityBuildingPanel(
      parent,
      SLOT_LABEL,
      () => this.session,
      (slotKey, buildingCfgId) => void this.startBuildingUpgrade(slotKey, buildingCfgId),
      () => this.buildSubmitState,
      (root) => skinDefaultPanel(root, this.assets, 380, 300),
    );
    this.buildingPanel.attach();
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
    skinHeroPanel(this.heroMail.getHeroRoot(), this.assets, 520, 320);
    skinBagPanel(this.content.getBagRoot(), this.assets, 520, 320);
    skinShopPanel(this.content.getShopRoot(), this.assets, 520, 320);
    skinQueuePanel(this.queuePanels.getRoot(), this.assets, 520, 320);
    skinMailPanel(this.heroMail.getMailRoot(), this.assets, 520, 320);
    skinDailyPanel(this.dailyQuest.getRoot(), this.assets, 520, 320);
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
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.militaryPanel.addEventListener("change", (ev) => this.onMilitaryRecruitFieldChange(ev));
    this.militaryPanel.addEventListener("input", (ev) => {
      this.onMilitaryRecruitFieldChange(ev);
      this.onMilitaryFormInput(ev);
      const field = (ev.target as HTMLElement).getAttribute("data-field");
      if (field === "unit" || field === "recruit-count") {
        this.syncMilitaryPanel();
      }
    });
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerBound);
    this.canvas.addEventListener("wheel", this.onCanvasWheelBound, { passive: false });
    this.canvas.addEventListener("pointermove", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointerup", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointercancel", this.onCanvasPointerBound);
    this.hud.addEventListener("click", this.onHudClickBound);
    restoreMarchTargetToForm(this.militaryPanel);
    this.syncMilitaryPanel();
    this.queuePanels?.setBuildCompleteTodoSlots(this.buildCompleteTodos.pendingSlotKeys());
    void this.hudTodoBadgePoll.pollOnce();
    void this.chatUnreadPoll.pollOnce();
    void this.refreshMinimapMarches();
    this.syncSlotUpgradeOverlay();
  }

  update(dt: number): void {
    if (!this.session) return;
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
      if (!this.militaryPanel.classList.contains("hidden")) {
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
    switch (action.kind) {
      case "train_troops":
        this.queuePanels.open();
        this.militaryPanel.classList.remove("hidden");
        this.syncMilitaryPanel();
        this.status = "已打开「队列」与「军事」募兵（练兵日常 QUEST-003）";
        break;
      case "build_level":
        this.queuePanels.open();
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
    if (action === "toggle-military") {
      this.militaryPanel.classList.toggle("hidden");
      if (!this.militaryPanel.classList.contains("hidden")) {
        resetCenterPanelViewportScroll(this.militaryPanel);
      }
      this.syncMilitaryPanel();
    }
    if (action === "toggle-reports") {
      this.marchArrivalHudReminder = null;
      this.battleReports.toggle();
    }
    if (action === "toggle-marches") this.marchList.toggle();
    if (action === "toggle-chat") this.social.toggleChat();
    if (action === "toggle-guild") this.social.toggleGuild();
    if (action === "toggle-rank") this.social.toggleRank();
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
    if (action === "toggle-world") this.world.toggle();
    if (action === "toggle-queue") {
      this.queuePanels.toggle();
      if (this.queuePanels.isOpen()) this.updateQueueToolbarBadge(0);
      else this.hudTodoBadgePoll.recomputeToolbarCounts();
    }
  }

  private onMilitaryClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "recruit") void this.recruit();
    if (action === "march") void this.startMarch();
    if (action === "clear-march-target") {
      clearMarchTargetFromForm(this.militaryPanel);
      this.intelRemarchTroopsLine = null;
      this.marchList.clearRecentMarchHighlight();
      this.status = "已清除出征目标记忆，表单恢复默认坐标";
      this.renderHud();
      this.syncMilitaryPanel();
    }
  }

  private onMilitaryFormInput(ev: Event): void {
    const field = (ev.target as HTMLElement).getAttribute("data-field");
    if (field !== "to-x" && field !== "to-y" && field !== "march-count") return;
    if (field === "to-x" || field === "to-y") {
      if (!this.suppressMarchTargetHighlightClear) {
        this.marchList.clearRecentMarchHighlight();
        this.intelRemarchTroopsLine = null;
      }
    }
    this.syncMilitaryPanel();
  }

  private openMilitaryFromIntelRemarch(march: MarchSummary): void {
    const prefill = buildMarchIntelRemarchPrefill(march);
    if (!prefill) {
      this.status = "该行缺少有效目的格点，无法再出征";
      this.renderHud();
      return;
    }
    this.militaryPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.militaryPanel);
    this.suppressMarchTargetHighlightClear = true;
    applyMarchIntelRemarchPrefill(this.militaryPanel, prefill);
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
    syncMarchSubmitButton(this.militaryPanel, this.marchSubmitState);
    const recruitPreview = syncTroopRecruitFormPreview(this.militaryPanel, this.session?.wallet);
    syncRecruitTroopSubmitButton(
      this.militaryPanel,
      this.recruitTroopSubmitState,
      recruitPreview?.canAfford ?? false,
    );
    syncMilitaryRecruitQueueList(
      this.militaryPanel,
      this.queuePanels?.getRecruitQueueSnapshot() ?? [],
    );
    const summary = formatMarchFormSummary(
      readMarchFormSnapshot(this.militaryPanel, {
        cityX: this.session?.cityX,
        cityY: this.session?.cityY,
        wallet: this.session?.wallet,
      }),
      this.marchClockMs,
    );
    setMarchFormSummaryDisplay(this.militaryPanel, summary);
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

  private focusMinimapOnMarchDestination(march: MarchSummary): void {
    const tx = march.to_x;
    const ty = march.to_y;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = computeMinimapViewFramingPoints(bounds, [{ wx: tx, wy: ty }]);
  }

  private focusMinimapOnWorldGrid(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.minimapFocusGrid = { wx: x, wy: y };
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = computeMinimapViewFramingPoints(bounds, [{ wx: x, wy: y }]);
  }

  private clearMinimapWorldGridFocus(): void {
    this.minimapFocusGrid = null;
  }

  private focusMinimapOnBattleReport(summary: BattleReportSummary): void {
    const coord = extractBattleReportReplayCoord(summary);
    if (!coord) {
      this.status = "战报缺少有效战场坐标";
      this.renderHud();
      return;
    }
    this.minimapBattleReportReplay = coord;
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = computeMinimapViewFramingPoints(bounds, [coord]);
    this.status = this.minimapCollapsed
      ? formatBattleReportReplayStatusCollapsed(coord)
      : formatBattleReportReplayStatusExpanded(coord);
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
    if (!layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed)) return;
    ev.preventDefault();
    const bounds = this.currentMinimapWorldBounds();
    this.minimapView = applyMinimapWheelZoom(
      this.minimapView,
      bounds,
      layout.x,
      layout.y,
      ev.deltaY,
    );
  }

  private onCanvasPointer(ev: PointerEvent): void {
    const layout = this.layoutFromPointerEvent(ev);

    if (ev.type === "pointermove" && this.minimapPanPointerId === ev.pointerId && this.minimapPanLastLayout) {
      const dx = layout.x - this.minimapPanLastLayout.x;
      const dy = layout.y - this.minimapPanLastLayout.y;
      const bounds = this.currentMinimapWorldBounds();
      this.minimapView = applyMinimapPan(this.minimapView, bounds, dx, dy);
      this.minimapPanLastLayout = layout;
      return;
    }

    if (ev.type === "pointerup" || ev.type === "pointercancel") {
      if (this.minimapPanPointerId === ev.pointerId) {
        const start = this.minimapPanStartLayout;
        if (
          start &&
          layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed)
        ) {
          const dx = layout.x - start.x;
          const dy = layout.y - start.y;
          if (dx * dx + dy * dy <= MINIMAP_TAP_MOVE_THRESHOLD * MINIMAP_TAP_MOVE_THRESHOLD) {
            this.applyMinimapMarchTargetPick(layout.x, layout.y);
          }
        }
        this.minimapPanPointerId = null;
        this.minimapPanLastLayout = null;
        this.minimapPanStartLayout = null;
      }
      return;
    }

    if (ev.type !== "pointerdown") return;

    if (layoutPointInMinimapToggle(layout.x, layout.y, this.minimapCollapsed)) {
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

    if (layoutPointInMinimapMap(layout.x, layout.y, this.minimapCollapsed)) {
      const marchId = findMarchIdForMinimapDestClick(
        layout.x,
        layout.y,
        this.minimapMarches,
        this.session?.cityX,
        this.session?.cityY,
        this.minimapView,
      );
      if (marchId != null) {
        this.marchList.selectMarchById(marchId, { openPanel: true });
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
    const building = buildingBySlot(this.session?.buildings, top.slot_key);
    const now = Date.now();
    if ((building?.upgrade_finish_at_ms ?? 0) > now) {
      this.queuePanels.openAndHighlightBuildSlot(top.slot_key);
      const label = SLOT_LABEL[top.slot_key] ?? top.slot_key;
      this.status = `队列：${label} 升级进行中`;
      this.renderHud();
      return;
    }
    this.resetBuildSubmitState();
    this.queuePanels.clearBuildSlotHighlight();
    this.buildingPanel.selectSlot(top.slot_key);
    this.status = `建造：${SLOT_LABEL[top.slot_key] ?? top.slot_key}`;
    this.renderHud();
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
      MINIMAP_LAYOUT_RECT,
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
    this.world?.selectGridAt(world.wx, world.wy);
    this.militaryPanel.classList.remove("hidden");
    this.status = marchTargetStatusMessage("minimap", world.wx, world.wy);
    this.renderHud();
    this.syncMilitaryPanel();
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
    if (!this.militaryPanel.classList.contains("hidden")) return true;
    if (this.layoutFrame.querySelector(".social-panel:not(.hidden)") !== null) return true;
    return this.layoutFrame.querySelector(".content-panel:not(.hidden)") !== null;
  }

  private syncSlotUpgradeOverlay(): void {
    this.slotUpgradeOverlay?.sync(this.session?.buildings, Date.now());
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
    const beforeWallet = this.session.wallet;
    const afterWallet = state.wallet ?? this.session.wallet;
    const pulseKeys = walletResourcePulseKeys(beforeWallet, afterWallet);
    this.patchSession(
      {
        wallet: afterWallet,
        buildings: state.buildings ?? this.session.buildings,
        productionRates: state.production_rates ?? this.session.productionRates,
      },
      { flashWalletGain: false },
    );
    if (pulseKeys.length) scheduleHudResourcePulse(this.hud, pulseKeys);
    if (justCompleted.length) {
      this.queuePanels?.notifyBuildJustCompleted(justCompleted);
    }
    this.syncSlotUpgradeOverlay();
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

    this.hud.replaceChildren();
    appendHudResourceStrip(this.hud, s?.wallet, this.assets, s?.productionRates);
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
    this.social.syncChatUnreadBadges(summary);
    this.updateChatToolbarBadge(summary.total);
    this.updateGuildToolbarBadge(summary.guild);
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

  private async startMarch(): Promise<void> {
    if (!this.session) return;
    const validated = validateMarchForm({
      toXRaw: (this.field("to-x") as HTMLInputElement)?.value ?? "",
      toYRaw: (this.field("to-y") as HTMLInputElement)?.value ?? "",
      marchCountRaw: (this.field("march-count") as HTMLInputElement)?.value ?? "",
      cityX: this.session.cityX,
      cityY: this.session.cityY,
      cityTroops: this.session.cityTroops,
    });
    if (!validated.ok) {
      setMarchFormErrorDisplay(this.militaryPanel, validated.message);
      this.renderHud();
      return;
    }
    const { toX, toY, marchCount } = validated;
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
        troops.map((t) => ({ unit_cfg_id: t.unit_cfg_id ?? 1, count: t.count ?? 0 })),
      )) as { march?: MarchSummary; city_troops?: CityTroopStack[] };
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
      this.marchList.notifyMarchStarted(this.lastMarch?.march_id);
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

    drawWorldMinimap(c2d, {
      ownCityX: this.session?.cityX,
      ownCityY: this.session?.cityY,
      marches: this.minimapMarches,
      selectedMarchId: this.marchList?.getSelectedMarchId(),
      focusGrid: this.minimapFocusGrid,
      view: this.minimapView,
      collapsed: this.minimapCollapsed,
      battleReportReplay: this.minimapBattleReportReplay,
      nowMs: this.marchClockMs,
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

  private updateMailToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="mail-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "邮件";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · ${unreadCount} 项待处理（未读/未领）` : "收件箱",
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
}
