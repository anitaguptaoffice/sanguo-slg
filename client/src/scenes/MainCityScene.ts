import type { AssetLoader } from "@/engine/AssetLoader";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { PANEL_ASSET_MILITARY, skinMilitaryPanel, skinNineSlicePanel } from "@/engine/artPanelSkin";
import { appendHudResourceStrip } from "@/engine/artResourceHud";
import { applyLayoutTransform, canvasToLayout, type LayoutViewport } from "@/engine/layoutViewport";
import {
  LAYOUT_FRAME,
  MAIN_CITY_SLOTS,
  STAGE_HEIGHT,
  STAGE_TOP_Y,
  TOOLBAR_TOP_Y,
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
import { QueuePanels } from "@/ui/QueuePanels";
import type { DailyQuestNavAction } from "@/net/dailyQuestObjective";
import { DAILY_RECRUIT_QUEST_CFG_ID } from "@/net/dailyQuestState";
import { recruitEntryFromResponse } from "@/net/queueState";
import {
  formatMarchHint,
  formatTimeMs,
  formatTroopStacks,
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
import { MARCH_ARRIVAL_STATUS_TOAST } from "@/net/marchArrival";
import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
import { CityStateFetch } from "@/net/cityStateFetch";
import { CityStatePoll } from "@/net/cityStatePoll";
import { HudTodoBadgePoll } from "@/net/hudTodoBadgePoll";
import type { HudTodoBadgeCounts } from "@/net/hudTodoBadge";
import { isToolbarBadgeDeepLinkClick, setToolbarBadge, toolbarButtonLabel } from "@/ui/toolbarBadge";
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
  readMinimapCollapsedFromSession,
  writeMinimapCollapsedToSession,
  type MinimapView,
} from "@/ui/worldMinimap";
import {
  formatKeyBuildingHudLine,
  formatSlotBuildingCaption,
  formatWalletGainBrief,
  hasActiveBuildingUpgrade,
  KEY_BUILDING_SLOTS,
} from "@/net/hudFormat";

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
  private social!: SocialPanels;
  private content!: ContentPanels;
  private heroMail!: HeroMailPanels;
  private battleReports!: BattleReportPanel;
  private marchList!: MarchListPanel;
  private dailyQuest!: DailyQuestPanels;
  private world!: WorldPanels;
  private queuePanels!: QueuePanels;
  private assets!: AssetLoader;
  private getViewport!: () => LayoutViewport;
  private canvas!: HTMLCanvasElement;
  private hitDebug = "";
  private hudRefreshAccum = 0;
  private cityStateFetch!: CityStateFetch;
  private cityStatePoll!: CityStatePoll;
  private hudTodoBadgePoll!: HudTodoBadgePoll;
  private marchArrivalPoll!: MarchArrivalPoll;
  private readonly battleReportUnread = new BattleReportUnreadSession();
  private readonly marchEndReportHint = new MarchEndBattleReportHint();
  private marchReportToastActive = false;
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
  private readonly onCanvasPointerBound = (ev: PointerEvent) => this.onCanvasPointer(ev);
  private readonly onCanvasWheelBound = (ev: WheelEvent) => this.onCanvasWheel(ev);
  private readonly onHudClickBound = (ev: Event) => this.onHudClick(ev);

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.assets = ctx.assets;
    this.getViewport = ctx.getViewport;
    this.canvas = ctx.canvas;
    this.session = (data as MainCitySession) ?? null;
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
      battleReportUnread: this.battleReportUnread,
      isPanelVisible: () => this.isAnyPanelVisible(),
      isMailSuppressed: () => this.heroMail?.isMailOpen() ?? false,
      isDailySuppressed: () => this.dailyQuest?.isOpen() ?? false,
      isReportsSuppressed: () => this.battleReports?.isOpen() ?? false,
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
      onCompletions: () => {
        this.marchReportToastActive = true;
        this.renderHud();
        void this.hudTodoBadgePoll.pollOnce();
        void this.seedMarchEndBattleReportHint();
      },
    });
    this.renderHud();
    this.toolbar = document.createElement("div");
    this.toolbar.className = "main-city-toolbar layout-toolbar";
    this.toolbar.innerHTML = `
      <button type="button" data-action="upgrade-farm">升级农田</button>
      <button type="button" data-action="refresh">刷新状态</button>
      <button type="button" data-action="toggle-military">军事</button>
      <button type="button" data-action="toggle-reports" data-role="reports-toolbar-btn"><span class="toolbar-btn-label">战报</span></button>
      <button type="button" data-action="toggle-marches">行军</button>
      <button type="button" data-action="toggle-chat">聊天</button>
      <button type="button" data-action="toggle-guild">军团</button>
      <button type="button" data-action="toggle-rank">排行</button>
      <button type="button" data-action="toggle-quest">任务</button>
      <button type="button" data-action="toggle-daily" data-role="daily-toolbar-btn"><span class="toolbar-btn-label">日常</span></button>
      <button type="button" data-action="toggle-bag">背包</button>
      <button type="button" data-action="toggle-shop">商城</button>
      <button type="button" data-action="toggle-hero">将领</button>
      <button type="button" data-action="toggle-mail" data-role="mail-toolbar-btn"><span class="toolbar-btn-label">邮件</span></button>
      <button type="button" data-action="toggle-world">世界</button>
      <button type="button" data-action="toggle-queue">队列</button>
    `;
    this.militaryPanel = document.createElement("div");
    this.militaryPanel.className = "military-panel hidden";
    this.militaryPanel.innerHTML = `
      <h3>军事</h3>
      <p class="military-troops" data-role="troops"></p>
      <label>募兵兵种
        <select data-field="unit">
          <option value="1">步兵</option>
          <option value="2">骑兵</option>
          <option value="3">弓兵</option>
          <option value="4">器械</option>
        </select>
      </label>
      <label>数量 <input type="number" data-field="recruit-count" min="1" value="20" /></label>
      <button type="button" class="art-btn-primary art-btn-primary-full" data-action="recruit">募兵</button>
      <hr />
      <p class="march-target-hint" data-role="march-target-hint">出征目标可从小地图空白单击或「世界」城池填入；以下坐标会记住到本次会话。</p>
      <div class="march-target-fields" data-role="march-target-fields">
        <label>目标 X <input type="number" data-field="to-x" value="${DEFAULT_MARCH_TARGET.x}" /></label>
        <label>目标 Y <input type="number" data-field="to-y" value="${DEFAULT_MARCH_TARGET.y}" /></label>
      </div>
      <button type="button" data-action="clear-march-target">清除出征目标记忆</button>
      <label>出征步兵 <input type="number" data-field="march-count" min="1" value="50" /></label>
      <button type="button" class="art-btn-primary art-btn-primary-full" data-action="march">出征攻击</button>
      <p class="military-march" data-role="march"></p>
    `;
    const parent = ctx.layoutFrame;
    parent.appendChild(this.toolbar);
    parent.appendChild(this.militaryPanel);
    this.social = new SocialPanels(
      parent,
      this.gateway,
      () => this.session,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
    );
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
      (count) => {
        if (!this.heroMail?.isMailOpen()) this.updateMailToolbarBadge(count);
      },
      this.cityStateFetch,
      () => this.dailyQuest.refreshChainList(DAILY_RECRUIT_QUEST_CFG_ID),
      (snap) => this.hudTodoBadgePoll.applyMailUnreadSnapshot(snap.count, snap.firstId),
    );
    this.heroMail.attach();
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
        onMarchesUpdated: (marches) => {
          this.minimapMarches = marches;
        },
        onSelectionChange: (march) => {
          if (march) {
            this.status = `小地图联动：行军 #${march.march_id ?? "?"}`;
            this.renderHud();
          }
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
        this.status = msg;
        this.renderHud();
      },
    );
    this.world.attach();
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
    );
    this.queuePanels.attach();
    skinPrimaryButtons(this.toolbar, this.assets, "button");
    skinPrimaryButtons(this.militaryPanel, this.assets);
    skinNineSlicePanel(this.militaryPanel, this.assets, 420, 320, PANEL_ASSET_MILITARY);
    skinMilitaryPanel(this.marchList.getRoot(), this.assets, 520, 320);
    skinMilitaryPanel(this.queuePanels.getMilitarySectionRoot(), this.assets, 480, 160);
    for (const panel of [
      this.queuePanels.getRoot(),
      this.heroMail.getMailRoot(),
      this.content.getBagRoot(),
      this.dailyQuest.getRoot(),
    ]) {
      skinNineSlicePanel(panel, this.assets, 520, 320);
    }
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerBound);
    this.canvas.addEventListener("wheel", this.onCanvasWheelBound, { passive: false });
    this.canvas.addEventListener("pointermove", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointerup", this.onCanvasPointerBound);
    this.canvas.addEventListener("pointercancel", this.onCanvasPointerBound);
    this.hud.addEventListener("click", this.onHudClickBound);
    restoreMarchTargetToForm(this.militaryPanel);
    this.syncMilitaryPanel();
    void this.hudTodoBadgePoll.pollOnce();
    void this.refreshMinimapMarches();
  }

  update(dt: number): void {
    if (!this.session) return;
    this.cityStatePoll?.tick(dt);
    this.hudTodoBadgePoll?.tick(dt);
    this.marchArrivalPoll?.tick(dt);
    this.minimapMarchRefreshAccum += dt;
    if (this.minimapMarchRefreshAccum >= MINIMAP_MARCH_REFRESH_S) {
      this.minimapMarchRefreshAccum = 0;
      void this.refreshMinimapMarches();
    }
    if (this.queuePanels?.isOpen()) {
      this.queuePanels.tick(dt);
    }
    if (hasActiveBuildingUpgrade(this.session.buildings)) {
      this.hudRefreshAccum += dt;
      if (this.hudRefreshAccum >= 1) {
        this.hudRefreshAccum = 0;
        this.renderHud();
      }
    } else {
      this.hudRefreshAccum = 0;
    }
    if (this.walletGainBrief && Date.now() > this.walletGainUntilMs) {
      this.walletGainBrief = null;
      this.renderHud();
    }
  }

  leave(): void {
    this.cityStateFetch?.clear();
    this.hudTodoBadgePoll?.reset();
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
    this.toolbar?.remove();
    this.militaryPanel?.remove();
  }

  private openBattleReportsFromDailyBanner(): void {
    this.marchReportToastActive = false;
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
      const snap = this.hudTodoBadgePoll.getDeepLinkSnapshot();
      if (action === "toggle-mail" && snap.mailUnread > 0) {
        this.heroMail.openFromTodoBadge(snap.firstUnreadMailId);
        return;
      }
      if (action === "toggle-daily" && snap.dailyTodo > 0) {
        this.dailyQuest.openFromTodoBadge(snap.firstDailyTodoCfgId);
        this.updateDailyToolbarBadge(0);
        return;
      }
      if (action === "toggle-reports" && snap.battleReportUnread > 0) {
        this.marchReportToastActive = false;
        void this.battleReports
          .openPanelWithDeepLink(snap.firstUnreadBattleReportId)
          .then(() => this.renderHud());
        return;
      }
    }
    if (action === "upgrade-farm") void this.upgradeFarm();
    if (action === "refresh") void this.refreshState();
    if (action === "toggle-military") {
      this.militaryPanel.classList.toggle("hidden");
      this.syncMilitaryPanel();
    }
    if (action === "toggle-reports") {
      this.marchReportToastActive = false;
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
    if (action === "toggle-queue") this.queuePanels.toggle();
  }

  private onMilitaryClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "recruit") void this.recruit();
    if (action === "march") void this.startMarch();
    if (action === "clear-march-target") {
      clearMarchTargetFromForm(this.militaryPanel);
      this.status = "已清除出征目标记忆，表单恢复默认坐标";
      this.renderHud();
      this.syncMilitaryPanel();
    }
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
  }

  private minimapBoundsExtra(): MinimapWorldPoint[] {
    return this.minimapBattleReportReplay ? [this.minimapBattleReportReplay] : [];
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
      } else {
        this.status = this.minimapCollapsed ? "小地图已折叠" : "小地图已展开";
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
    if (top.slot_key === "farm") void this.upgradeFarm();
    else {
      this.status = `选中 ${SLOT_LABEL[top.slot_key] ?? top.slot_key}`;
      this.renderHud();
    }
  }

  private pointInRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
    return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
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
  }

  private isAnyPanelVisible(): boolean {
    if (!this.militaryPanel.classList.contains("hidden")) return true;
    return this.layoutFrame.querySelector(".content-panel:not(.hidden)") !== null;
  }

  private applyCityStatePoll(state: { wallet?: ResourceWallet; buildings?: CityBuilding[] }): void {
    if (!this.session) return;
    this.patchSession(
      {
        wallet: state.wallet ?? this.session.wallet,
        buildings: state.buildings ?? this.session.buildings,
      },
      { flashWalletGain: false },
    );
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
    appendHudResourceStrip(this.hud, s?.wallet, this.assets);
    for (const text of groups) {
      const span = document.createElement("span");
      span.className =
        text === this.walletGainBrief ? "hud-group hud-wallet-gain" : "hud-group";
      span.textContent = text;
      this.hud.appendChild(span);
    }
    if (this.marchReportToastActive) {
      const toast = document.createElement("span");
      toast.className = "hud-group hud-march-report-toast";
      toast.textContent = MARCH_ARRIVAL_STATUS_TOAST;
      toast.setAttribute("data-action", "open-march-reports");
      toast.setAttribute("role", "button");
      toast.setAttribute("title", "打开战报列表");
      this.hud.appendChild(toast);
    }
  }

  private onHudClick(ev: Event): void {
    const el = (ev.target as HTMLElement).closest('[data-action="open-march-reports"]');
    if (!el) return;
    this.marchReportToastActive = false;
    const hint = this.marchEndReportHint.consume();
    void this.battleReports.openPanelWithDeepLink(hint).then(() => this.renderHud());
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

  private applyHudTodoBadgeCounts(counts: HudTodoBadgeCounts): void {
    if (!this.heroMail?.isMailOpen()) {
      this.updateMailToolbarBadge(counts.mailUnread);
    }
    if (!this.dailyQuest?.isOpen()) {
      this.updateDailyToolbarBadge(counts.dailyTodo);
    } else {
      this.dailyQuest.syncBattleReportUnreadBanner();
    }
    if (!this.battleReports?.isOpen()) {
      this.updateReportsToolbarBadge(counts.battleReportUnread);
    }
  }

  private async refreshState(): Promise<void> {
    if (!this.session) return;
    this.status = "刷新中…";
    this.renderHud();
    try {
      const state = (await this.cityStateFetch.fetch()) as {
        wallet?: ResourceWallet;
        buildings?: CityBuilding[];
      } | null;
      if (state) {
        this.patchSession(
          {
            wallet: state.wallet ?? this.session.wallet,
            buildings: state.buildings ?? [],
          },
          { flashWalletGain: false },
        );
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

  private async upgradeFarm(): Promise<void> {
    if (!this.session) return;
    const farm = this.session.buildings.find((b) => b.slot_key === "farm");
    const cfgId = farm?.building_cfg_id ?? 2;
    this.status = "升级请求中…";
    this.renderHud();
    try {
      const res = (await this.gateway.startBuildingUpgrade(this.session.cityId, "farm", cfgId)) as {
        wallet?: ResourceWallet;
        building?: CityBuilding;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      if (res.building) {
        const idx = this.session.buildings.findIndex((b) => b.slot_key === "farm");
        if (idx >= 0) this.session.buildings[idx] = res.building;
        else this.session.buildings.push(res.building);
      }
      await this.refreshState();
      this.status = "农田已排队升级";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
  }

  private async recruit(): Promise<void> {
    if (!this.session) return;
    const unitCfgId = Number((this.field("unit") as HTMLSelectElement)?.value ?? 1);
    const count = Number((this.field("recruit-count") as HTMLInputElement)?.value ?? 1);
    this.status = `募兵 ${unitLabel(unitCfgId)}×${count}…`;
    this.renderHud();
    try {
      const res = (await this.gateway.recruitTroop(this.session.cityId, unitCfgId, count)) as {
        wallet?: ResourceWallet;
        troop?: CityTroopStack;
        queue_id?: number;
        finish_at_ms?: number;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      if (res.troop) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, [res.troop]);
      }
      const queued = recruitEntryFromResponse(res, unitCfgId, count);
      this.queuePanels.addRecruitEntry(queued);
      const finish = res.finish_at_ms ? formatTimeMs(res.finish_at_ms) : "已完成";
      this.status = res.queue_id
        ? `募兵排队 #${res.queue_id}，预计 ${finish}（见「队列」面板）`
        : `募兵完成，${unitLabel(unitCfgId)} 当前 ${res.troop?.count ?? "?"}`;
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private async startMarch(): Promise<void> {
    if (!this.session) return;
    const toX = Number((this.field("to-x") as HTMLInputElement)?.value ?? DEFAULT_MARCH_TARGET.x);
    const toY = Number((this.field("to-y") as HTMLInputElement)?.value ?? DEFAULT_MARCH_TARGET.y);
    const marchCount = Number((this.field("march-count") as HTMLInputElement)?.value ?? 1);
    if (marchCount <= 0) {
      this.status = "出征数量须大于 0";
      this.renderHud();
      return;
    }
    const troops = [{ unit_cfg_id: 1, count: marchCount }];
    this.status = `向 (${toX},${toY}) 出征…`;
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
      this.status = formatMarchHint(this.lastMarch ?? undefined) || "行军已出发";
      setMarchTargetFieldHighlight(this.militaryPanel, false);
      this.marchArrivalPoll.trackMarch(this.lastMarch?.march_id, this.lastMarch ?? undefined);
      this.marchList.notifyMarchStarted();
      void this.refreshMinimapMarches();
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  draw(c2d: CanvasRenderingContext2D): void {
    const vp = this.getViewport();
    c2d.save();
    applyLayoutTransform(c2d, vp);

    c2d.fillStyle = "rgba(26, 20, 16, 0.85)";
    c2d.fillRect(0, 0, LAYOUT_FRAME.w, STAGE_TOP_Y);
    c2d.fillStyle = "rgba(26, 20, 16, 0.92)";
    c2d.fillRect(0, TOOLBAR_TOP_Y, LAYOUT_FRAME.w, LAYOUT_FRAME.h - TOOLBAR_TOP_Y);

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
      view: this.minimapView,
      collapsed: this.minimapCollapsed,
      battleReportReplay: this.minimapBattleReportReplay,
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
      if (caption.upgradeLine) {
        c2d.fillStyle = "#f0c674";
        c2d.font = "12px system-ui";
        c2d.fillText(caption.upgradeLine, display.x + display.w - 88, display.y + 20);
      }
    }
  }

  private updateMailToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="mail-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "邮件";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · ${unreadCount} 封未读` : "收件箱",
    );
  }

  private updateDailyToolbarBadge(todoCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="daily-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "日常";
    setToolbarBadge(
      btn,
      todoCount,
      todoCount > 0 ? `${label} · ${todoCount} 项可接/可领` : "日常任务",
    );
  }

  private updateReportsToolbarBadge(unreadCount: number): void {
    const btn = this.toolbar?.querySelector<HTMLElement>('[data-role="reports-toolbar-btn"]');
    const label = toolbarButtonLabel(btn) || "战报";
    setToolbarBadge(
      btn,
      unreadCount,
      unreadCount > 0 ? `${label} · ${unreadCount} 条新战报` : "战报列表",
    );
  }
}
