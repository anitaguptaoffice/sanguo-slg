import type { CityBuilding, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { formatDailyQuestQueueInlineHint } from "@/net/dailyQuestQueueMatch";
import type { RecruitQueueEntry } from "@/net/queueState";
import type { CityStateFetch } from "@/net/cityStateFetch";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  bagFromListPlayerBagResponse,
  mergeRewardBundle,
  mergeWallet,
  type BagStack,
} from "@/net/bagState";
import {
  DAILY_QUEST_CHAIN_ID,
  dailyQuestsFromListResponse,
  formatDailyQuestDetail,
  pickDefaultDailyQuest,
  type DailyQuestRow,
} from "@/net/dailyQuestState";
import { centerTodoScrollTargetId, pickFirstClaimableDailyQuestCfgId } from "@/net/hudCenterTodo";
import { pickFirstDailyTodoQuestCfgId } from "@/net/hudTodoBadge";
import { syncFilterChipAria } from "@/engine/artFilterChipRuntime";
import { TODO_SCROLL_TARGET_ATTR, scrollCenterTodoTarget } from "@/ui/centerTodoScroll";
import {
  formatDailyQuestNextStepHint,
  resolveDailyQuestNavAction,
  type DailyQuestNavAction,
} from "@/net/dailyQuestObjective";
import {
  DAILY_BATTLE_REPORT_BANNER_TEXT,
  shouldShowDailyBattleReportBanner,
} from "@/net/dailyQuestBattleReportBanner";
import { dailyQuestCrossLinkTags } from "@/net/mailBattleCrossLink";
import {
  countDailyQuestsByState,
  dailyQuestListEmptyMessage,
  dailyQuestRowsForList,
  pickFirstClaimableDailyQuestCfgIdForFilter,
  readDailyQuestListFilterSession,
  type DailyQuestListFilter,
  writeDailyQuestListFilterSession,
} from "@/net/dailyQuestListFilter";
import {
  DAILY_QUEST_CLAIMABLE_ROW_CLASS,
  pulseDailyQuestClaimProgress,
  scheduleQuestClaimRowPulse,
  scrollQuestClaimableIntoView,
} from "@/net/dailyQuestClaimFeedback";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import type { AssetLoader } from "@/engine/AssetLoader";
import { mountFilterUiSkins } from "@/engine/artUiFilterSkin";
import {
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  dailyQuestClaimableBadgeCount,
  shouldShowDailyQuestClaimableFilterBadge,
} from "@/net/dailyQuestFilterUi";
import {
  applyDailyQuestRowAfterClaim,
  dailyBatchClaimSummary,
  orderBatchClaimDailyQuestIds,
  validateBatchClaimDailySelection,
} from "@/net/dailyQuestBatchClaim";
import { scrollDailyQuestCfgRowIntoView } from "@/net/dailyQueueAnchor";
import {
  appendDailyQuestRowSecondary,
  formatDailyQuestRowPrimary,
} from "@/net/dailyQuestProgressFormat";
import {
  appendQuestChainQueueHudResidualDeepSubline,
  appendQuestChainQueueHudResidualDeeperSubline,
  appendQuestChainQueueHudResidualDeepestDeeperSubline,
  appendQuestChainQueueHudResidualDeepestSubline,
  appendQuestChainQueueHudResidualSubline,
} from "@/net/questChainQueueHudResidual";
import {
  formatDailyClaimableSweepLine,
  scheduleDailyClaimProgressSweepPulse,
} from "@/net/dailyClaimableSweep";
import {
  dailyQuestRowsForChain,
  filterDailyQuestRowsToCatalogChains,
  pickDailyChainTabs,
  pickFirstInProgressDailyQuestCfgId,
  readDailyChainTabSession,
  resolveActiveDailyChainTab,
  writeDailyChainTabSession,
} from "@/net/dailyQuestChainTab";

type RewardBundle = {
  items?: { item_cfg_id?: number; quantity?: number }[];
  resources?: ResourceWallet;
};

export class DailyQuestPanels {
  private panel!: HTMLElement;
  /** 当前 chain tab 下的列表行。 */
  private rows: DailyQuestRow[] = [];
  /** ListPlayerQuests 全链快照（catalog 链裁剪后）。 */
  private catalogQuestRows: DailyQuestRow[] = [];
  private activeChainId = DAILY_QUEST_CHAIN_ID;
  private selectedCfgId = 0;
  private listFilter: DailyQuestListFilter = "all";
  private listLoading = false;
  private listError: string | null = null;
  private claimBatchInflight = false;
  /** CLIENT-134：角标深链打开前「可领取」chip 数字与 HUD 快照对齐。 */
  private dailyClaimableCountOverride: number | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private readonly cityStateFetch?: CityStateFetch,
    private readonly onNavigate?: (action: DailyQuestNavAction) => void,
    private readonly getBattleReportUnread?: () => number,
    private readonly onOpenBattleReports?: () => void,
    private readonly onOpenMailPanel?: () => void,
    private readonly getQueueBuildings?: () => CityBuilding[] | undefined,
    private readonly queueSlotLabels?: Record<string, string>,
    private readonly getQueueRecruits?: () => RecruitQueueEntry[] | undefined,
    private readonly assets?: AssetLoader,
    private readonly onDailyChainRowsSnapshot?: (rows: DailyQuestRow[]) => void,
  ) {}

  attach(): void {
    this.listFilter = readDailyQuestListFilterSession() ?? "all";
    this.activeChainId = readDailyChainTabSession();
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
  }

  detach(): void {
    this.panel?.remove();
  }

  isOpen(): boolean {
    return this.panel != null && !this.panel.classList.contains("hidden");
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  /** 队列↔日常互链：只读当前列表快照（不额外 RPC）。 */
  getRowsSnapshot(): DailyQuestRow[] {
    return this.rows.slice();
  }

  /** 当前选中日常行（含 catalog 全链快照，供队列锚点解析）。 */
  getSelectedQuestRow(): DailyQuestRow | null {
    const id = this.selectedCfgId;
    if (id <= 0) return null;
    return (
      this.catalogQuestRows.find((r) => r.quest_cfg_id === id) ??
      this.rows.find((r) => r.quest_cfg_id === id) ??
      null
    );
  }

  /** 队列面板深链：打开日常并滚动到指定 quest 行。 */
  openAndFocusQuest(questCfgId: number): void {
    this.panel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.panel);
    void this.refreshList(questCfgId).then(() => {
      scrollDailyQuestCfgRowIntoView(this.panel, questCfgId);
    });
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (!this.panel.classList.contains("hidden")) {
      resetCenterPanelViewportScroll(this.panel);
      this.renderBattleReportBanner();
      void this.refreshList(undefined, "default").then(() => {
        scrollQuestClaimableIntoView(this.panel, this.rows, this.listFilter);
      });
    }
  }

  /** CLIENT-044：与 HudTodoBadgePoll 战报未读计数同步。 */
  syncBattleReportUnreadBanner(): void {
    this.renderBattleReportBanner();
  }

  /** 待办角标深链：打开筛选并高亮首条目标（filter/cfg 来自 `resolveHudTodoOpenTarget`）。 */
  openFromTodoBadge(
    preferredCfgId = 0,
    opts?: { listFilter?: DailyQuestListFilter; claimableCount?: number },
  ): void {
    this.panel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.panel);
    if (opts?.listFilter) {
      this.listFilter = opts.listFilter;
      writeDailyQuestListFilterSession(this.listFilter);
    }
    this.dailyClaimableCountOverride =
      opts?.claimableCount != null ? Math.max(0, opts.claimableCount) : null;
    void this.refreshList(preferredCfgId, "todo-badge").then(() => {
      this.dailyClaimableCountOverride = null;
      const id = this.selectedCfgId;
      if (id > 0) {
        const row = this.panel.querySelector(`li[data-quest-cfg-id="${id}"]`);
        row?.scrollIntoView?.({ block: "nearest" });
      }
    });
  }

  /** CLIENT-077：顶栏待办聚合深链 — 首条可领奖日常（state=3）。 */
  openFromCenterTodoClaimable(preferredCfgId = 0, opts?: { skipScroll?: boolean }): boolean {
    const wasOpen = this.isOpen();
    this.panel.classList.remove("hidden");
    void this.refreshList(preferredCfgId, "center-claimable").then(() => {
      const id = this.selectedCfgId;
      if (id <= 0 || opts?.skipScroll) return;
      scrollCenterTodoTarget(this.panel, centerTodoScrollTargetId("daily", id));
    });
    return wasOpen;
  }

  /** 招募闭环：后台刷新 chain 400，可选聚焦日课·访贤行。 */
  refreshChainList(focusCfgId?: number): Promise<void> {
    return this.refreshList(focusCfgId);
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.dataset.centerPanel = "daily";
    el.innerHTML = `
      <h3>日常</h3>
      <p class="daily-claimable-sweep hidden" data-role="daily-claimable-sweep" aria-live="polite" hidden></p>
      <p class="daily-battle-report-banner hidden" data-role="daily-report-banner" data-action="daily-open-reports" role="button" tabindex="0" hidden></p>
      <p data-role="daily-hint">日常多链；接取后由服务端自动累积进度，无需手填上报。</p>
      <div class="daily-chain-tabs" data-role="daily-chain-tabs" role="tablist" aria-label="日常链类型"></div>
      <div class="content-panel-actions">
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-daily">刷新列表</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="accept-daily">接取</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="claim-daily">领奖</button>
        <button type="button" class="art-btn-primary art-btn-primary-full hidden" data-action="claim-daily-batch" hidden>批量领取可领</button>
      </div>
      <p class="daily-form-error hidden" data-role="daily-form-error" role="alert"></p>
      <div class="panel-scroll-body" data-role="daily-scroll">
        <div class="daily-quest-filters panel-filter-chip-bar" data-role="daily-filters" role="group" aria-label="日常筛选">
          <button type="button" class="daily-quest-filter-btn" data-ui-filter-chip data-action="daily-filter" data-filter="all" aria-pressed="true">全部</button>
          <button type="button" class="daily-quest-filter-btn" data-ui-filter-chip data-action="daily-filter" data-filter="in_progress" aria-pressed="false">进行中</button>
          <button type="button" class="daily-quest-filter-btn daily-quest-filter-claimable" data-ui-filter-chip data-action="daily-filter" data-filter="claimable" aria-pressed="false">
            可领取
            <span class="daily-quest-filter-badge-count hidden" data-role="daily-claimable-count-badge" data-ui-filter-badge="count" data-filter-badge-count="0" hidden aria-hidden="true"></span>
          </button>
          <button type="button" class="daily-quest-filter-btn" data-ui-filter-chip data-action="daily-filter" data-filter="completed" aria-pressed="false">已完成</button>
          <button type="button" class="daily-quest-filter-btn daily-quest-locate-first hidden" data-action="daily-locate-first" hidden>定位首条</button>
        </div>
        <div class="daily-quest-state-summary" data-role="daily-state-summary" hidden></div>
        <ul class="daily-quest-list" data-role="daily-list"></ul>
        <p class="daily-quest-next" data-role="daily-next" hidden></p>
        <button type="button" data-action="daily-go-next" hidden>前往下一步</button>
        <pre class="daily-quest-detail" data-role="daily-detail"></pre>
      </div>
    `;
    return el;
  }

  private visibleRows(): DailyQuestRow[] {
    return dailyQuestRowsForList(this.rows, this.listFilter);
  }

  private updateFilterButtons(): void {
    const chips = Array.from(
      this.panel.querySelectorAll<HTMLButtonElement>('[data-action="daily-filter"]'),
    );
    syncFilterChipAria(chips, (btn) => {
      const f = btn.getAttribute("data-filter") as DailyQuestListFilter;
      return f === this.listFilter;
    });
    const claimableCount =
      this.dailyClaimableCountOverride ?? dailyQuestClaimableBadgeCount(this.rows);
    const countBadge = this.panel.querySelector<HTMLElement>('[data-role="daily-claimable-count-badge"]');
    if (countBadge) {
      const show = shouldShowDailyQuestClaimableFilterBadge(this.rows);
      countBadge.hidden = !show;
      countBadge.classList.toggle("hidden", !show);
      countBadge.dataset.filterBadgeCount = String(claimableCount);
    }
    const locateBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="daily-locate-first"]');
    const showLocate =
      this.listFilter === "claimable" && pickFirstClaimableDailyQuestCfgIdForFilter(this.rows) > 0;
    if (locateBtn) {
      locateBtn.hidden = !showLocate;
      locateBtn.classList.toggle("hidden", !showLocate);
    }
    const batchBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="claim-daily-batch"]');
    const claimableIds = orderBatchClaimDailyQuestIds(this.rows);
    const showBatch = claimableIds.length > 0;
    if (batchBtn) {
      batchBtn.hidden = !showBatch;
      batchBtn.classList.toggle("hidden", !showBatch);
      batchBtn.disabled = this.claimBatchInflight || !showBatch;
    }
  }

  private hudDailyChainRows(): DailyQuestRow[] {
    return dailyQuestRowsForChain(this.catalogQuestRows, DAILY_QUEST_CHAIN_ID);
  }

  private publishDailyChainSnapshot(): void {
    this.onDailyChainRowsSnapshot?.(this.hudDailyChainRows());
  }

  private applyChainTabRows(
    catalogRows: DailyQuestRow[],
    preferredChainId = this.activeChainId,
    scrollToFirstInProgress = false,
  ): void {
    this.catalogQuestRows = catalogRows;
    this.activeChainId = resolveActiveDailyChainTab(catalogRows, preferredChainId);
    writeDailyChainTabSession(this.activeChainId);
    this.rows = dailyQuestRowsForChain(catalogRows, this.activeChainId);
    if (scrollToFirstInProgress) {
      const firstId = pickFirstInProgressDailyQuestCfgId(this.rows);
      if (firstId > 0) this.selectedCfgId = firstId;
    }
  }

  private renderDailyChainTabs(): void {
    const host = this.panel.querySelector('[data-role="daily-chain-tabs"]');
    if (!host) return;
    const tabs = pickDailyChainTabs(this.catalogQuestRows);
    host.innerHTML = "";
    host.classList.toggle("hidden", tabs.length <= 1);
    if (tabs.length <= 1) return;
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "daily-chain-tab";
      btn.setAttribute("data-daily-chain-id", String(tab.chainId));
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.chainId === this.activeChainId ? "true" : "false");
      if (tab.chainId === this.activeChainId) btn.classList.add("active");
      btn.textContent = `${tab.label} (${tab.chainId})`;
      host.appendChild(btn);
    }
  }

  private switchDailyChainTab(chainId: number, scrollToFirstInProgress: boolean): void {
    if (chainId === this.activeChainId && !scrollToFirstInProgress) return;
    this.activeChainId = chainId;
    writeDailyChainTabSession(chainId);
    this.rows = dailyQuestRowsForChain(this.catalogQuestRows, chainId);
    if (scrollToFirstInProgress) {
      const firstId = pickFirstInProgressDailyQuestCfgId(this.rows);
      if (firstId > 0) this.selectedCfgId = firstId;
    }
    this.renderList();
    if (scrollToFirstInProgress && this.selectedCfgId > 0) {
      const row = this.panel.querySelector(`li[data-quest-cfg-id="${this.selectedCfgId}"]`);
      row?.scrollIntoView?.({ block: "nearest" });
    }
  }

  private setDailyFormError(message: string | null): void {
    const el = this.panel.querySelector('[data-role="daily-form-error"]') as HTMLElement | null;
    if (!el) return;
    if (message?.trim()) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  private locateFirstClaimableRow(): void {
    const id = pickFirstClaimableDailyQuestCfgIdForFilter(this.rows);
    if (id <= 0) {
      this.onStatus("当前无可领取日常");
      return;
    }
    this.selectedCfgId = id;
    this.renderList();
    scrollQuestClaimableIntoView(this.panel, this.rows, this.listFilter);
    this.onStatus(`已定位可领取日常 #${id}`);
  }

  private renderDailyClaimableSweep(): void {
    const el = this.panel.querySelector('[data-role="daily-claimable-sweep"]') as HTMLElement | null;
    if (!el) return;
    const line = formatDailyClaimableSweepLine(this.hudDailyChainRows());
    if (!line) {
      el.hidden = true;
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.classList.remove("hidden");
    el.textContent = line;
  }

  private pulseDailyClaimableSweep(): void {
    const el = this.panel.querySelector('[data-role="daily-claimable-sweep"]') as HTMLElement | null;
    scheduleDailyClaimProgressSweepPulse(el);
  }

  private renderStateSummary(): void {
    const summaryEl = this.panel.querySelector('[data-role="daily-state-summary"]') as HTMLElement | null;
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    const scoped = dailyQuestRowsForList(this.rows, this.listFilter);
    if (!scoped.length) {
      summaryEl.hidden = true;
      return;
    }
    const counts = countDailyQuestsByState(scoped);
    const chips: { label: string; count: number; className: string }[] = [
      { label: "可接", count: counts.acceptable, className: "daily-state-acceptable" },
      { label: "进行中", count: counts.inProgress, className: "daily-state-in-progress" },
      { label: "可领取", count: counts.claimable, className: "daily-state-claimable" },
      { label: "已完成", count: counts.completed, className: "daily-state-completed" },
    ];
    summaryEl.hidden = false;
    for (const chip of chips) {
      const span = document.createElement("span");
      span.className = `daily-quest-state-chip ${chip.className}`;
      span.setAttribute("aria-readonly", "true");
      span.textContent = `${chip.label} ${chip.count}`;
      summaryEl.appendChild(span);
    }
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="daily-list"]');
    const pre = this.panel.querySelector('[data-role="daily-detail"]');
    if (!ul) return;
    this.renderDailyChainTabs();
    this.updateFilterButtons();
    this.renderDailyClaimableSweep();
    this.renderStateSummary();
    ul.innerHTML = "";
    if (this.listLoading && !this.rows.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, {
        assets: this.assets,
      });
      return;
    }
    if (this.listError && !this.rows.length) {
      renderPanelStateListRow(ul, "error", this.listError, {
        legacyClass: "daily-quest-list-empty",
        assets: this.assets,
      });
      return;
    }
    const displayRows = this.visibleRows();
    if (!displayRows.length) {
      const msg = this.rows.length
        ? dailyQuestListEmptyMessage(this.listFilter)
        : dailyQuestListEmptyMessage("all");
      renderPanelStateListRow(ul, "empty", msg, {
        legacyClass: "daily-quest-list-empty",
        assets: this.assets,
      });
    } else {
      const now = Date.now();
      const slotLabels = this.queueSlotLabels ?? {};
      const buildings = this.getQueueBuildings?.();
      const recruits = this.getQueueRecruits?.();
      for (const q of displayRows) {
        const li = document.createElement("li");
        li.setAttribute("data-ui-filter-row", "");
        const id = q.quest_cfg_id ?? 0;
        const state = q.state ?? 0;
        if (state === 4) li.classList.add("daily-quest-row-completed");
        if (state === DAILY_QUEST_STATE_CLAIMABLE) {
          li.classList.add(DAILY_QUEST_CLAIMABLE_ROW_CLASS);
          const dot = document.createElement("span");
          dot.className = "daily-quest-row-claim-dot";
          dot.setAttribute("data-ui-filter-badge", "dot");
          dot.setAttribute("aria-hidden", "true");
          li.appendChild(dot);
        }
        let line = formatDailyQuestRowPrimary(q);
        const queueHint = formatDailyQuestQueueInlineHint(
          q,
          buildings,
          recruits,
          slotLabels,
          now,
        );
        if (queueHint) line = `${line} · ${queueHint}`;
        const main = document.createElement("span");
        main.className = "daily-quest-row-main";
        main.textContent = line;
        li.appendChild(main);
        appendDailyQuestRowSecondary(li, q);
        if (state === DAILY_QUEST_STATE_CLAIMABLE) {
          appendQuestChainQueueHudResidualSubline(
            li,
            q,
            buildings,
            recruits,
            slotLabels,
            this.rows,
            now,
          );
          appendQuestChainQueueHudResidualDeepSubline(
            li,
            q,
            buildings,
            recruits,
            slotLabels,
            this.rows,
            now,
          );
          appendQuestChainQueueHudResidualDeeperSubline(
            li,
            q,
            buildings,
            recruits,
            slotLabels,
            this.rows,
            now,
          );
          appendQuestChainQueueHudResidualDeepestSubline(
            li,
            q,
            buildings,
            recruits,
            slotLabels,
            this.rows,
            now,
          );
          appendQuestChainQueueHudResidualDeepestDeeperSubline(
            li,
            q,
            buildings,
            recruits,
            slotLabels,
            this.rows,
            now,
          );
        }
        for (const tag of dailyQuestCrossLinkTags(q)) {
          const tagBtn = document.createElement("button");
          tagBtn.type = "button";
          tagBtn.className = "daily-cross-link-tag";
          tagBtn.setAttribute("data-action", tag.action);
          tagBtn.textContent = tag.label;
          tagBtn.title = tag.action === "daily-cross-battle-report" ? "打开战报面板" : "打开邮件面板";
          li.appendChild(tagBtn);
        }
        if (id) {
          li.setAttribute("data-quest-cfg-id", String(id));
          li.setAttribute(TODO_SCROLL_TARGET_ATTR, centerTodoScrollTargetId("daily", id));
          if (id === this.selectedCfgId) li.classList.add("selected");
        }
        ul.appendChild(li);
      }
    }
    const selected = this.rows.find((r) => r.quest_cfg_id === this.selectedCfgId) ?? null;
    if (pre) pre.textContent = formatDailyQuestDetail(selected);
    this.renderNextStep(selected);
    this.renderBattleReportBanner();
    this.syncDailyFilterUiSkins();
  }

  private syncDailyFilterUiSkins(): void {
    if (!this.assets) return;
    mountFilterUiSkins(this.panel, this.assets);
  }

  private renderBattleReportBanner(): void {
    const el = this.panel.querySelector('[data-role="daily-report-banner"]') as HTMLElement | null;
    if (!el) return;
    const unread = this.getBattleReportUnread?.() ?? 0;
    const show = shouldShowDailyBattleReportBanner(unread);
    el.hidden = !show;
    el.classList.toggle("hidden", !show);
    el.textContent = show ? DAILY_BATTLE_REPORT_BANNER_TEXT : "";
  }

  private renderNextStep(selected: DailyQuestRow | null): void {
    const hintEl = this.panel.querySelector('[data-role="daily-next"]') as HTMLElement | null;
    const btn = this.panel.querySelector('[data-action="daily-go-next"]') as HTMLButtonElement | null;
    const nav = selected ? resolveDailyQuestNavAction(selected) : null;
    const show = !!nav && !!this.onNavigate;
    if (hintEl) {
      hintEl.hidden = !show;
      hintEl.textContent = nav ? formatDailyQuestNextStepHint(nav) : "";
    }
    if (btn) {
      btn.hidden = !show;
      btn.disabled = !show;
    }
  }

  private goNextStep(): void {
    const selected = this.rows.find((r) => r.quest_cfg_id === this.selectedCfgId) ?? null;
    const nav = selected ? resolveDailyQuestNavAction(selected) : null;
    if (!nav || !this.onNavigate) {
      this.onStatus("当前日常无需导航或无可前往步骤");
      return;
    }
    this.onNavigate(nav);
  }

  private async refreshList(
    focusCfgId?: number,
    pickMode: "default" | "todo-badge" | "center-claimable" = "default",
  ): Promise<void> {
    const sid = this.serverId();
    this.listLoading = true;
    this.listError = null;
    this.renderList();
    this.onStatus("拉取日常…");
    try {
      const res = await this.gateway.listPlayerQuests(sid, {
        chainId: 0,
        includeCompleted: true,
      });
      const catalogRows = filterDailyQuestRowsToCatalogChains(
        dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] }),
      );
      let preferredChainId = this.activeChainId;
      if (focusCfgId != null && focusCfgId > 0) {
        const focused = catalogRows.find((r) => r.quest_cfg_id === focusCfgId);
        if (focused?.chain_id) preferredChainId = focused.chain_id;
      }
      this.applyChainTabRows(catalogRows, preferredChainId, false);
      let pick: DailyQuestRow | null = null;
      if (focusCfgId != null && focusCfgId > 0) {
        pick = this.rows.find((r) => r.quest_cfg_id === focusCfgId) ?? null;
      }
      if (!pick && pickMode === "todo-badge") {
        const todoId = pickFirstDailyTodoQuestCfgId(this.rows);
        if (todoId > 0) pick = this.rows.find((r) => r.quest_cfg_id === todoId) ?? null;
      }
      if (!pick && pickMode === "center-claimable") {
        const claimId = pickFirstClaimableDailyQuestCfgId(this.rows);
        if (claimId > 0) pick = this.rows.find((r) => r.quest_cfg_id === claimId) ?? null;
      }
      if (!pick) pick = pickDefaultDailyQuest(this.rows);
      if (pick?.quest_cfg_id) this.selectedCfgId = pick.quest_cfg_id;
      this.renderList();
      this.publishDailyChainSnapshot();
      this.onStatus(`日常 ${this.rows.length} 条`);
    } catch (e) {
      const msg = (e as Error).message || "日常列表加载失败，请点「刷新列表」重试";
      this.listError = msg;
      this.rows = [];
      this.renderList();
      this.onStatus(msg);
    } finally {
      this.listLoading = false;
      this.renderList();
    }
  }

  private async syncBagAndWallet(granted?: RewardBundle): Promise<void> {
    const session = this.getSession();
    if (!session) return;
    let bag: BagStack[] = session.bag;
    let wallet = session.wallet;
    if (granted) {
      bag = mergeRewardBundle(bag, granted);
      wallet = mergeWallet(wallet, granted.resources);
    }
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      bag = bagFromListPlayerBagResponse(bagRes.items);
    } catch {
      /* 保留合并结果 */
    }
    try {
      const state = this.cityStateFetch
        ? await this.cityStateFetch.fetch()
        : ((await this.gateway.getCityState(session.cityId)) as { wallet?: ResourceWallet });
      if (state?.wallet) wallet = state.wallet;
    } catch {
      /* 保留合并结果 */
    }
    this.onSessionPatch({ bag, wallet });
  }

  private async acceptDaily(): Promise<void> {
    const id = this.selectedCfgId;
    if (!id) {
      this.onStatus("请先选中一条日常");
      return;
    }
    const sid = this.serverId();
    this.onStatus(`接取日常 #${id}…`);
    try {
      await this.gateway.acceptQuest(sid, id);
      await this.syncBagAndWallet();
      await this.refreshList();
      this.onStatus(`已接取日常 #${id}`);
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async claimDaily(): Promise<void> {
    const id = this.selectedCfgId;
    if (!id) {
      this.onStatus("请先选中一条日常");
      return;
    }
    const sid = this.serverId();
    this.setDailyFormError(null);
    this.onStatus(`领取日常 #${id}…`);
    try {
      const res = (await this.gateway.claimQuestReward(sid, id)) as {
        granted_rewards?: RewardBundle;
        quest?: DailyQuestRow;
      };
      this.rows = applyDailyQuestRowAfterClaim(this.rows, id, res.quest);
      this.catalogQuestRows = applyDailyQuestRowAfterClaim(this.catalogQuestRows, id, res.quest);
      this.publishDailyChainSnapshot();
      this.renderList();
      const rowAfter = this.panel.querySelector<HTMLElement>(`li[data-quest-cfg-id="${id}"]`);
      scheduleQuestClaimRowPulse(rowAfter);
      pulseDailyQuestClaimProgress(this.panel, id);
      await this.syncBagAndWallet(res.granted_rewards);
      await this.refreshList();
      this.publishDailyChainSnapshot();
      this.pulseDailyClaimableSweep();
      this.onStatus("日常奖励已领取");
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("bag", e);
      this.setDailyFormError(msg);
      this.onStatus(msg);
    }
  }

  private async claimDailyBatch(): Promise<void> {
    if (this.claimBatchInflight) return;
    const validated = validateBatchClaimDailySelection(this.rows);
    if (!validated.ok) {
      this.setDailyFormError(validated.message);
      this.onStatus(validated.message);
      return;
    }
    const ordered = orderBatchClaimDailyQuestIds(this.rows);
    const sid = this.serverId();
    this.setDailyFormError(null);
    this.claimBatchInflight = true;
    this.renderList();
    this.onStatus(`批量领取 ${ordered.length} 条日常（逐条）…`);
    const attempts: ({ ok: true } | { ok: false; message: string })[] = [];
    const pulseCfgIds: number[] = [];
    try {
      for (const questCfgId of ordered) {
        const rowBefore = this.panel.querySelector<HTMLElement>(
          `li[data-quest-cfg-id="${questCfgId}"]`,
        );
        try {
          const res = (await this.gateway.claimQuestReward(sid, questCfgId)) as {
            granted_rewards?: RewardBundle;
            quest?: DailyQuestRow;
          };
          attempts.push({ ok: true });
          pulseCfgIds.push(questCfgId);
          this.rows = applyDailyQuestRowAfterClaim(this.rows, questCfgId, res.quest);
          this.catalogQuestRows = applyDailyQuestRowAfterClaim(
            this.catalogQuestRows,
            questCfgId,
            res.quest,
          );
          this.publishDailyChainSnapshot();
          this.renderList();
          scheduleQuestClaimRowPulse(rowBefore);
          pulseDailyQuestClaimProgress(this.panel, questCfgId);
        } catch (e) {
          const msg = formatPanelGatewayErrorFromUnknown("bag", e);
          attempts.push({ ok: false, message: msg });
        }
      }
      await this.syncBagAndWallet();
      await this.refreshList();
      this.publishDailyChainSnapshot();
      const summary = dailyBatchClaimSummary(attempts);
      if (summary.lastError) {
        this.setDailyFormError(summary.lastError);
      }
      this.onStatus(summary.summaryText);
      if (pulseCfgIds.length) this.pulseDailyClaimableSweep();
    } finally {
      this.claimBatchInflight = false;
      this.renderList();
      for (const cfgId of pulseCfgIds) {
        const row = this.panel.querySelector<HTMLElement>(`li[data-quest-cfg-id="${cfgId}"]`);
        scheduleQuestClaimRowPulse(row);
        pulseDailyQuestClaimProgress(this.panel, cfgId);
      }
    }
  }

  private onClick(ev: Event): void {
    const crossBtn = (ev.target as HTMLElement).closest(
      "button[data-action='daily-cross-battle-report'], button[data-action='daily-cross-mail']",
    );
    if (crossBtn) {
      const a = crossBtn.getAttribute("data-action");
      if (a === "daily-cross-battle-report") {
        if (!this.onOpenBattleReports) {
          this.onStatus("战报面板未配置");
          return;
        }
        this.onOpenBattleReports();
        return;
      }
      if (a === "daily-cross-mail") {
        if (!this.onOpenMailPanel) {
          this.onStatus("邮件面板未配置");
          return;
        }
        this.onOpenMailPanel();
        return;
      }
    }
    const li = (ev.target as HTMLElement).closest("li[data-quest-cfg-id]");
    if (li) {
      this.selectedCfgId = Number(li.getAttribute("data-quest-cfg-id")) || 0;
      this.renderList();
      return;
    }
    const chainTabBtn = (ev.target as HTMLElement).closest("[data-daily-chain-id]");
    if (chainTabBtn) {
      const chainId = Number(chainTabBtn.getAttribute("data-daily-chain-id")) || 0;
      if (chainId > 0) this.switchDailyChainTab(chainId, true);
      return;
    }
    const filterBtn = (ev.target as HTMLElement).closest('[data-action="daily-filter"]');
    if (filterBtn) {
      const f = filterBtn.getAttribute("data-filter") as DailyQuestListFilter | null;
      if (f && f !== this.listFilter) {
        this.listFilter = f;
        writeDailyQuestListFilterSession(f);
        this.renderList();
      }
      return;
    }
    const locateBtn = (ev.target as HTMLElement).closest('[data-action="daily-locate-first"]');
    if (locateBtn) {
      this.locateFirstClaimableRow();
      return;
    }
    const actionEl = (ev.target as HTMLElement).closest("[data-action]");
    const btn = actionEl?.closest("button") ?? null;
    if (!actionEl || (!btn && actionEl.getAttribute("data-action") !== "daily-open-reports")) return;
    const a = actionEl.getAttribute("data-action");
    if (a === "daily-open-reports") {
      if (!this.onOpenBattleReports) {
        this.onStatus("战报面板未配置");
        return;
      }
      this.onOpenBattleReports();
      return;
    }
    if (!btn) return;
    if (a === "refresh-daily") void this.refreshList();
    if (a === "accept-daily") void this.acceptDaily();
    if (a === "claim-daily") void this.claimDaily();
    if (a === "claim-daily-batch") void this.claimDailyBatch();
    if (a === "daily-go-next") this.goNextStep();
  }
}
