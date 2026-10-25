import type { BattleReportUnreadSession } from "@/net/battleReportUnread";
import type { GatewayPort } from "@/net/GatewayClient";
import { selectDeepLinkBattleReportId } from "@/net/battleReportDeepLink";
import {
  battleReportRoundJumpNumbers,
  battleReportRoundRowDomId,
  shouldUseBattleReportRoundJumpSelect,
} from "@/net/battleReportDetailNav";
import {
  adjacentBattleReportId,
  battleReportIdsInListOrder,
  BATTLE_REPORT_DETAIL_REGION_ARIA_LABEL,
  isBattleReportAdjNavKeyboardEnabled,
  applyBattleReportAdjNavFocusRing,
  setBattleReportAdjNavButtonEnabled,
  syncBattleReportListRovingFocus,
} from "@/net/battleReportListNav";
import {
  applyBattleReportListDensityRowClasses,
  formatBattleReportListDensityCoordLine,
  formatBattleReportListDensityTimestampLine,
  formatBattleReportListDensityTitleLine,
  handleBattleReportListPanelKeyDown,
  REPORT_LIST_DENSITY_COORD_CLASS,
  REPORT_LIST_DENSITY_OUTCOME_BAND_CLASS,
  REPORT_LIST_DENSITY_TIMESTAMP_CLASS,
  syncBattleReportListKeyboardFocusRing,
} from "@/net/battleReportListDensityKeyboard";
import {
  computeOutcomeStreak,
  formatBattleReportOutcomeStreakLabel,
} from "@/net/battleReportOutcomeStreak";
import { buildBattleReportTroopScan } from "@/net/battleReportDetailSummary";
import {
  formatBattleReportSideSummary,
  resolveBattleReportHeroDeepLink,
  resolveBattleReportRankDeepLink,
  type BattleReportSideLinkContext,
} from "@/net/battleReportSideLink";
import {
  BATTLE_REPORT_ROUNDS_EXPAND_LABEL,
  buildBattleRoundTableRows,
  shouldCollapseBattleRounds,
  visibleBattleRoundTableRows,
} from "@/net/battleReportRounds";
import {
  battleReportOutcomeChipClass,
  battleReportOutcomeChipLabel,
  countBattleReportsByOutcome,
  filterBattleReportsByTimeWindow,
  formatBattleReportDetail,
  formatBattleReportFoeWithoutCoord,
  BATTLE_REPORT_OUTCOME_BAND_CLASS,
  BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS,
  formatBattleReportCoordinateTag,
  formatBattleReportListStreakLine,
  formatBattleReportOutcomeHeadline,
  formatBattleReportRoundSummaryStrip,
  formatReportCoord,
  formatTimeMs,
  type BattleReportDetailView,
  type BattleReportOutcomeFilter,
  type BattleReportSummary,
  type BattleReportTimeWindowFilter,
} from "@/net/militaryFormat";
import {
  BATTLE_REPORT_LOAD_MORE_LABEL,
  battleReportAllLoadedLabel,
  hasMoreBattleReports,
  readBattleReportOutcomeFilterSession,
  readBattleReportTimeWindowFilterSession,
  writeBattleReportOutcomeFilterSession,
  writeBattleReportTimeWindowFilterSession,
} from "@/net/battleReportListState";
import { consumePendingOutcomeFilterBridge } from "@/net/reportOutcomeFilterBridge";
import {
  filterBattleReportsForPanelList,
  resolveBattleReportListOutcomeBadgeKind,
  syncBattleReportOutcomeFilterChips,
} from "@/net/battleReportOutcomeFilterChip";
import { syncBattleReportTimeFilterChips } from "@/net/battleReportTimeFilterChip";
import type { AssetLoader } from "@/engine/AssetLoader";
import { mountFilterBadges, mountFilterRows } from "@/engine/artUiFilterSkin";
import {
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  BATTLE_REPORT_FILTER_EMPTY_TEXT,
  battleReportFilterEmptyClass,
  battleReportListEmptyClass,
  battleReportListEmptyMessage,
  battleReportListErrorClass,
  battleReportListErrorListHint,
} from "@/net/panelDensity";
import {
  resolveBattleReportDailyLinks,
  resolveBattleReportMailLink,
} from "@/net/mailBattleCrossLink";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import { handleListRovingKeyDown } from "@/ui/listRovingTabindex";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  BATTLE_REPORT_COORD_REPLAY_ACTION,
  BATTLE_REPORT_VIEW_INTEL_ACTION,
} from "@/net/battleReportIntelReplayJump";
import {
  BATTLE_REPORT_LIST_INTEL_JUMP_ACTION,
  BATTLE_REPORT_LIST_INTEL_JUMP_TAG_CLASS,
} from "@/net/battleReportListIntelJump";
import { BATTLE_REPORT_LIST_STREAK_LINE_CLASS } from "@/engine/wave37WorldIntelBattleReportMailBagNarrowManifest";
import {
  OPEN_INTEL_FOR_REPORT_ACTION,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
} from "@/net/battleReportRoundSummaryIntelLink";
import {
  formatBattleReportLocationFields,
  parseBattleReportLocation,
} from "@/net/battleReportMinimapFocus";
import { pulseBattleReportListKeyboardAdjacentNavResidualRings } from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeepestDeeper";
import {
  applyBattleReportCoordsReadonlySelect,
  BATTLE_REPORT_COORD_COPY_BAR_CLASS,
  BATTLE_REPORT_COORD_COPY_TEXT_ROLE,
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_CLASS,
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS,
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_SUBLINE_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  formatBattleReportCoordsCopyText,
  formatBattleReportSideTemplateResidualLine,
  shouldShowBattleReportCoordCopyBar,
} from "@/net/battleReportDetailTemplateResidual";
import {
  battleReportReplayGridLinkLabel,
  battleReportWorldTileGrid,
} from "@/ui/worldTileInfoFromBattleReport";

const PAGE_LIMIT = 20;

export type BattleReportPanelOptions = {
  unreadSession?: BattleReportUnreadSession;
  onUnreadChange?: (count: number) => void;
  /** 详情「在小地图定位」：由场景驱动复盘高亮、展开小地图与 pan/zoom（CLIENT-142）。 */
  onViewOnMap?: (summary: BattleReportSummary) => void;
  /** CLIENT-191：「坐标复盘」→ 世界/小地图脉冲 + session 互链。 */
  onCoordReplay?: (summary: BattleReportSummary) => void;
  /** CLIENT-191：「查看军情」→ 同坐标最近行军（只读 ListMarches 快照）。 */
  onViewIntelNearReport?: (summary: BattleReportSummary) => void;
  canOfferIntelJump?: (summary: BattleReportSummary) => boolean;
  /** 关闭面板、切换战报或取消复盘时清除小地图临时标记。 */
  onClearMapReplay?: () => void;
  /** 详情「相关邮件」：只读高亮邮件行，不自动领取。 */
  onOpenRelatedMail?: (mailId: number) => void;
  /** chain 400 快照（与队列/战报角标同源，不额外 RPC）。 */
  getDailyChainRows?: () => DailyQuestRow[];
  /** 详情「相关日常」：打开日常面板并滚到 cfg 行，不自动领奖。 */
  onOpenRelatedDaily?: (questCfgId: number) => void;
  /** 复盘互链：当前玩家与将领列表快照（不额外 RPC）。 */
  getBattleReportLinkContext?: () => BattleReportSideLinkContext;
  onOpenBattleReportHero?: (heroId: number) => void;
  onOpenBattleReportRank?: (playerId: number) => void;
  onBattleReportReadonlyHint?: (message: string) => void;
  /** 列表行「复盘格点」：打开世界格点信息卡（CLIENT-109 / CLIENT-108）。 */
  onOpenReplayWorldTile?: (summary: BattleReportSummary) => void;
  /** CLIENT-223：列表坐标标签 → 军情选中或小地图格点。 */
  onListIntelJump?: (summary: BattleReportSummary) => void;
  /** CLIENT-125：列表行九宫与胜负 badge（chip 由 MainCity `remountPanelFilterChips` 挂载）。 */
  filterListSkinAssets?: AssetLoader;
};

export class BattleReportPanel {
  private panel!: HTMLElement;
  /** 已从服务端加载的完整列表（未按 outcome 筛选）。 */
  private reports: BattleReportSummary[] = [];
  private total = 0;
  private outcomeFilter: BattleReportOutcomeFilter = "all";
  private timeWindowFilter: BattleReportTimeWindowFilter = "all";
  /** 世界格点信息卡深链：按战场坐标客户端筛选（CLIENT-108）。 */
  private locationFilter: { x: number; y: number } | null = null;
  private selectedReportId = 0;
  private detailText = "";
  private detailRounds: BattleReportDetailView["rounds"] = [];
  private detailView: BattleReportDetailView | undefined;
  private detailSummary: BattleReportSummary | undefined;
  private detailResult = "";
  private roundsTableExpanded = false;
  private highlightedRound = 0;
  private listError = "";
  private detailError = "";
  private listLoading = false;
  private detailLoading = false;
  /** 上一封/下一封切换后把焦点拉回详情顶栏导航（CLIENT-094）。 */
  private focusDetailNavAfterRender = false;
  /** CLIENT-254/270：列表重绘后补相邻键盘导航残余环 + 深环。 */
  private adjacentNavResidualRingReportId: number | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private onStatus: (msg: string) => void,
    private readonly panelOpts?: BattleReportPanelOptions,
  ) {}

  getRoot(): HTMLElement {
    return this.panel;
  }

  attach(): void {
    const savedFilter = readBattleReportOutcomeFilterSession();
    if (savedFilter) this.outcomeFilter = savedFilter;
    const savedTimeWindow = readBattleReportTimeWindowFilterSession();
    if (savedTimeWindow) this.timeWindowFilter = savedTimeWindow;
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.panel.addEventListener("change", (ev) => this.onChange(ev));
    this.panel.addEventListener("keydown", this.onKeyDownBound);
  }

  detach(): void {
    this.clearMapReplay();
    this.panel?.removeEventListener("keydown", this.onKeyDownBound);
  }

  private readonly onKeyDownBound = (ev: KeyboardEvent): void => {
    this.onKeyDown(ev);
  };

  private clearMapReplay(): void {
    this.panelOpts?.onClearMapReplay?.();
  }

  isOpen(): boolean {
    return this.panel != null && !this.panel.classList.contains("hidden");
  }

  toggle(): void {
    const wasHidden = this.panel.classList.contains("hidden");
    this.panel.classList.toggle("hidden");
    if (wasHidden && this.isOpen()) {
      resetCenterPanelViewportScroll(this.panel);
      void this.openAndSyncUnread();
    } else if (!wasHidden && !this.isOpen()) this.clearMapReplay();
  }

  /** 行军结束提示等入口：打开列表并清零未读基线。 */
  openPanel(): void {
    this.panel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.panel);
    void this.openAndSyncUnread();
  }

  /** 行军结束深链：刷新列表后选中 hint 或最近战报并加载详情。 */
  async openPanelWithDeepLink(hintReportId?: number | null): Promise<void> {
    this.panel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.panel);
    this.applyOutcomeFilterBridgeFromMail();
    await this.refreshList();
    this.panelOpts?.unreadSession?.markPanelOpened(this.reports);
    this.panelOpts?.onUnreadChange?.(0);
    const reportId = selectDeepLinkBattleReportId(this.reports, hintReportId);
    if (reportId > 0) await this.openReport(reportId);
  }

  getLocationFilter(): { x: number; y: number } | null {
    return this.locationFilter;
  }

  clearLocationFilter(): void {
    if (!this.locationFilter) return;
    this.locationFilter = null;
    this.updateLocationFilterUi();
    this.renderList();
  }

  /**
   * 世界信息卡「打开战报筛选」：保留 CLIENT-065 时间窗/outcome 会话筛选，并叠加格点坐标过滤。
   */
  async openListFilteredByGrid(
    x: number,
    y: number,
    hintReportId?: number,
  ): Promise<void> {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.locationFilter = { x, y };
    this.panel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.panel);
    await this.refreshList();
    this.panelOpts?.unreadSession?.markPanelOpened(this.reports);
    this.panelOpts?.onUnreadChange?.(0);
    this.updateLocationFilterUi();
    this.renderList();
    const reportId = selectDeepLinkBattleReportId(this.reports, hintReportId ?? null);
    if (reportId > 0) await this.openReport(reportId);
  }

  getReportsSnapshot(): BattleReportSummary[] {
    return this.reports;
  }

  private async openAndSyncUnread(): Promise<void> {
    await this.refreshList();
    this.panelOpts?.unreadSession?.markPanelOpened(this.reports);
    this.panelOpts?.onUnreadChange?.(0);
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden battle-report-panel";
    el.dataset.centerPanel = "battle-report";
    el.tabIndex = -1;
    el.innerHTML = `
      <h3>战报</h3>
      <p data-role="report-hint">military.v1 战报列表；筛选仅在客户端生效，点击条目加载详情。</p>
      <div class="battle-report-filters panel-filter-chip-bar" role="group" aria-label="战报结果筛选">
        <span>筛选：</span>
        <div class="battle-report-outcome-chip-group" role="group" aria-label="胜负筛选">
        <button type="button" data-ui-filter-chip data-action="filter-outcome" data-filter="all" class="active" aria-pressed="true">全部</button>
        <button type="button" data-ui-filter-chip data-action="filter-outcome" data-filter="win" aria-pressed="false">胜</button>
        <button type="button" data-ui-filter-chip data-action="filter-outcome" data-filter="loss" aria-pressed="false">负</button>
        <button type="button" data-ui-filter-chip data-action="filter-outcome" data-filter="draw" aria-pressed="false">平</button>
        </div>
        <div class="battle-report-time-chip-group" role="group" aria-label="战报时间范围">
          <span>时间：</span>
          <button type="button" data-ui-filter-chip data-action="filter-time-window" data-filter="all" aria-pressed="true">全部</button>
          <button type="button" data-ui-filter-chip data-action="filter-time-window" data-filter="today" aria-pressed="false">今日</button>
          <button type="button" data-ui-filter-chip data-action="filter-time-window" data-filter="last7d" aria-pressed="false">近7日</button>
        </div>
        <span class="battle-report-location-filter hidden" data-role="report-location-filter" aria-live="polite"></span>
        <button type="button" class="hidden" data-action="clear-location-filter">清除格点筛选</button>
      </div>
      <div class="battle-report-outcome-summary" data-role="report-outcome-summary" aria-label="当前时间范围胜负统计" hidden></div>
      <button type="button" data-action="refresh-reports">刷新列表</button>
      <button type="button" data-action="load-more-reports" data-role="load-more" hidden>${BATTLE_REPORT_LOAD_MORE_LABEL}</button>
      <button type="button" data-action="retry-list" data-role="retry-list" hidden>重试加载列表</button>
      <p class="report-panel-status" data-role="report-list-status"></p>
      <div class="panel-scroll-body" data-role="battle-report-scroll">
        <ul class="battle-report-list" data-role="report-list"></ul>
        <p class="report-panel-status" data-role="report-detail-status"></p>
        <button type="button" data-action="retry-detail" data-role="retry-detail" hidden>重试加载详情</button>
        <div class="report-detail" data-role="report-detail"></div>
      </div>
    `;
    return el;
  }

  private timeWindowFilteredReports(nowMs = Date.now()): BattleReportSummary[] {
    return filterBattleReportsByTimeWindow(this.reports, this.timeWindowFilter, nowMs);
  }

  private visibleReports(nowMs = Date.now()): BattleReportSummary[] {
    return filterBattleReportsForPanelList(this.reports, {
      outcomeFilter: this.outcomeFilter,
      timeWindowFilter: this.timeWindowFilter,
      nowMs,
      location: this.locationFilter,
    });
  }

  private updateLocationFilterUi(): void {
    const label = this.panel.querySelector('[data-role="report-location-filter"]');
    const clearBtn = this.panel.querySelector<HTMLButtonElement>(
      '[data-action="clear-location-filter"]',
    );
    const loc = this.locationFilter;
    if (!label || !clearBtn) return;
    if (loc == null) {
      label.textContent = "";
      label.classList.add("hidden");
      clearBtn.classList.add("hidden");
      return;
    }
    label.textContent = `格点：(${loc.x},${loc.y})`;
    label.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
  }

  private updateFilterButtons(): void {
    syncBattleReportOutcomeFilterChips(this.panel, this.outcomeFilter);
    syncBattleReportTimeFilterChips(this.panel, this.timeWindowFilter);
  }

  private mountListRowFilterSkins(): void {
    const assets = this.panelOpts?.filterListSkinAssets;
    if (!assets) return;
    mountFilterRows(this.panel, assets);
    mountFilterBadges(this.panel, assets);
  }

  private renderOutcomeSummary(): void {
    const summaryEl = this.panel.querySelector('[data-role="report-outcome-summary"]');
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    if (this.listLoading || this.listError || !this.reports.length) {
      (summaryEl as HTMLElement).hidden = true;
      return;
    }
    const counts = countBattleReportsByOutcome(this.timeWindowFilteredReports());
    const chips: { label: string; count: number; className: string }[] = [
      { label: "胜", count: counts.win, className: "outcome-attacker-win" },
      { label: "负", count: counts.loss, className: "outcome-defender-win" },
      { label: "平", count: counts.draw, className: "outcome-draw" },
    ];
    (summaryEl as HTMLElement).hidden = false;
    for (const chip of chips) {
      const span = document.createElement("span");
      span.className = `battle-outcome-chip battle-report-summary-chip ${chip.className}`;
      span.setAttribute("aria-readonly", "true");
      span.textContent = `${chip.label} ${chip.count}`;
      summaryEl.appendChild(span);
    }

    const streak = computeOutcomeStreak(this.visibleReports());
    const streakLabel = formatBattleReportOutcomeStreakLabel(streak);
    if (streakLabel) {
      const span = document.createElement("span");
      const streakClass =
        streak.kind === "win" ? "outcome-attacker-win" : "outcome-defender-win";
      span.className = `battle-outcome-chip battle-report-streak-chip ${streakClass}`;
      span.setAttribute("aria-readonly", "true");
      span.textContent = streakLabel;
      summaryEl.appendChild(span);
    }
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="report-list"]');
    const statusEl = this.panel.querySelector('[data-role="report-list-status"]');
    const loadMore = this.panel.querySelector('[data-role="load-more"]');
    const retryList = this.panel.querySelector('[data-role="retry-list"]');
    if (!ul) return;

    this.updateFilterButtons();
    this.updateLocationFilterUi();
    this.mountListRowFilterSkins();
    this.renderOutcomeSummary();

    if (statusEl) {
      if (this.listLoading) {
        statusEl.textContent = "加载中…";
      } else if (this.listError) {
        statusEl.textContent = `${this.listError}（可点「重试加载列表」）`;
      } else if (this.reports.length) {
        const shown = this.visibleReports().length;
        statusEl.textContent = `已加载 ${this.reports.length}/${this.total} 条 · 当前筛选显示 ${shown} 条`;
      } else {
        statusEl.textContent = "";
      }
    }

    if (retryList) {
      (retryList as HTMLElement).hidden = !this.listError || this.listLoading;
    }
    if (loadMore) {
      const btn = loadMore as HTMLButtonElement;
      const showPager =
        !this.listLoading && this.reports.length > 0 && this.total > 0;
      btn.hidden = !showPager;
      if (showPager) {
        const canMore = hasMoreBattleReports(this.reports.length, this.total);
        btn.disabled = !canMore;
        btn.textContent = canMore
          ? BATTLE_REPORT_LOAD_MORE_LABEL
          : battleReportAllLoadedLabel(this.total);
      }
    }

    ul.innerHTML = "";
    if (this.listLoading && !this.reports.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, {
        assets: this.filterListSkinAssets,
      });
      this.renderDetail();
      return;
    }

    if (this.listError && !this.reports.length) {
      renderPanelStateListRow(ul, "error", battleReportListErrorListHint(), {
        legacyClass: battleReportListErrorClass(),
        assets: this.filterListSkinAssets,
      });
      this.renderDetail();
      return;
    }

    const filtered = this.visibleReports();
    if (!this.reports.length) {
      renderPanelStateListRow(ul, "empty", battleReportListEmptyMessage(), {
        legacyClass: battleReportListEmptyClass(),
        assets: this.filterListSkinAssets,
      });
      this.renderDetail();
      return;
    }

    if (!filtered.length) {
      renderPanelStateListRow(ul, "empty", BATTLE_REPORT_FILTER_EMPTY_TEXT, {
        legacyClass: battleReportFilterEmptyClass(),
        assets: this.filterListSkinAssets,
      });
      this.renderDetail();
      return;
    }

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const li = document.createElement("li");
      li.setAttribute("data-ui-filter-row", "");
      const outcomeBand = document.createElement("span");
      outcomeBand.className = `${REPORT_LIST_DENSITY_OUTCOME_BAND_CLASS} ${battleReportOutcomeChipClass(r.outcome)}`;
      outcomeBand.setAttribute("aria-hidden", "true");
      li.appendChild(outcomeBand);
      const outcomeCol = document.createElement("div");
      outcomeCol.className = "battle-report-row-outcome";
      const badgeKind = resolveBattleReportListOutcomeBadgeKind(r.outcome);
      if (badgeKind) {
        const dot = document.createElement("span");
        dot.setAttribute("data-ui-filter-badge", "dot");
        dot.className = `battle-report-outcome-badge battle-report-outcome-badge--${badgeKind}`;
        dot.setAttribute("aria-hidden", "true");
        outcomeCol.appendChild(dot);
      }
      const chip = document.createElement("span");
      chip.className = `battle-outcome-chip ${battleReportOutcomeChipClass(r.outcome)}`;
      chip.textContent = battleReportOutcomeChipLabel(r.outcome);
      outcomeCol.appendChild(chip);
      const body = document.createElement("span");
      body.className = "battle-report-row-body";
      const timestamp = document.createElement("span");
      timestamp.className = REPORT_LIST_DENSITY_TIMESTAMP_CLASS;
      timestamp.textContent = formatBattleReportListDensityTimestampLine(r);
      const primary = document.createElement("span");
      primary.className = "battle-report-row-primary";
      primary.textContent = formatBattleReportListDensityTitleLine(r);
      const secondary = document.createElement("span");
      secondary.className = `battle-report-row-secondary ${BATTLE_REPORT_LIST_STREAK_LINE_CLASS}`;
      const streakText = document.createElement("span");
      streakText.className = "battle-report-list-streak-text";
      streakText.textContent = formatBattleReportListStreakLine(r, i, filtered);
      secondary.appendChild(streakText);
      const coordLine = document.createElement("span");
      coordLine.className = REPORT_LIST_DENSITY_COORD_CLASS;
      coordLine.textContent = formatBattleReportListDensityCoordLine(r);
      secondary.appendChild(coordLine);
      if (parseBattleReportLocation(r)) {
        const coordTag = document.createElement("button");
        coordTag.type = "button";
        coordTag.className = BATTLE_REPORT_LIST_INTEL_JUMP_TAG_CLASS;
        coordTag.setAttribute("data-action", BATTLE_REPORT_LIST_INTEL_JUMP_ACTION);
        coordTag.setAttribute(
          "aria-label",
          `${formatBattleReportCoordinateTag(r)}，跳转军情或小地图`,
        );
        coordTag.textContent = formatBattleReportCoordinateTag(r);
        secondary.appendChild(coordTag);
      }
      body.appendChild(timestamp);
      body.appendChild(primary);
      body.appendChild(secondary);
      const grid = battleReportWorldTileGrid(r);
      if (grid) {
        const replayBtn = document.createElement("button");
        replayBtn.type = "button";
        replayBtn.className = "battle-report-replay-grid-btn";
        replayBtn.setAttribute("data-action", "open-replay-world-tile");
        replayBtn.textContent = battleReportReplayGridLinkLabel(grid.x, grid.y);
        body.appendChild(replayBtn);
      }
      li.appendChild(outcomeCol);
      li.appendChild(body);
      const id = r.report_id ?? 0;
      if (id) {
        li.setAttribute("data-report-id", String(id));
        const selected = id === this.selectedReportId;
        li.classList.toggle("selected", selected);
        li.setAttribute("aria-selected", selected ? "true" : "false");
      }
      applyBattleReportListDensityRowClasses(li, r);
      ul.appendChild(li);
    }

    const orderedIds = battleReportIdsInListOrder(filtered);
    syncBattleReportListRovingFocus(
      ul as HTMLElement,
      orderedIds,
      this.selectedReportId,
    );
    syncBattleReportListKeyboardFocusRing(ul as HTMLElement, this.selectedReportId);
    this.flushAdjacentNavResidualRing(ul as HTMLElement);
    this.renderDetail();
  }

  private flushAdjacentNavResidualRing(list: HTMLElement): void {
    const id = this.adjacentNavResidualRingReportId;
    if (id == null || id <= 0 || this.detailLoading) return;
    pulseBattleReportListKeyboardAdjacentNavResidualRings(list, id);
    this.adjacentNavResidualRingReportId = null;
  }

  private queueAdjacentNavResidualRing(reportId: number): void {
    if (reportId > 0) this.adjacentNavResidualRingReportId = reportId;
  }

  private renderDetail(): void {
    const detailEl = this.panel.querySelector('[data-role="report-detail"]');
    const detailStatus = this.panel.querySelector('[data-role="report-detail-status"]');
    const retryDetail = this.panel.querySelector('[data-role="retry-detail"]');
    if (!detailEl) return;

    if (detailStatus) {
      if (this.detailLoading) {
        detailStatus.textContent = "详情加载中…";
      } else if (this.detailError) {
        detailStatus.textContent = `${this.detailError}（可点「重试加载详情」）`;
      } else {
        detailStatus.textContent = "";
      }
    }

    if (retryDetail) {
      (retryDetail as HTMLElement).hidden =
        !this.detailError || this.detailLoading || !this.selectedReportId;
    }

    detailEl.removeAttribute("role");
    detailEl.removeAttribute("aria-label");
    detailEl.removeAttribute("tabindex");
    detailEl.textContent = "";
    if (!this.selectedReportId || this.detailLoading) return;
    if (this.detailError) return;

    detailEl.setAttribute("role", "region");
    detailEl.setAttribute("aria-label", BATTLE_REPORT_DETAIL_REGION_ARIA_LABEL);
    detailEl.tabIndex = 0;

    const summary = this.detailSummary;
    if (summary) {
      const outcomeBand = document.createElement("div");
      outcomeBand.className = `${BATTLE_REPORT_OUTCOME_BAND_CLASS} ${battleReportOutcomeChipClass(summary.outcome)}`;
      outcomeBand.setAttribute("aria-label", "战报胜负结果");
      outcomeBand.textContent = formatBattleReportOutcomeHeadline(summary);
      detailEl.appendChild(outcomeBand);
    }

    if (summary) {
      const residual = formatBattleReportSideTemplateResidualLine({
        summary,
        detail: this.detailView,
      });
      const residualBar = document.createElement("div");
      residualBar.className = BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_CLASS;
      residualBar.setAttribute("aria-label", "攻守模板摘要");
      const residualLine = document.createElement("p");
      residualLine.className = BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS;
      residualLine.textContent = residual.templateLine;
      residualBar.appendChild(residualLine);
      if (residual.casualtySubline) {
        const residualSub = document.createElement("p");
        residualSub.className = BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_SUBLINE_CLASS;
        residualSub.textContent = residual.casualtySubline;
        residualBar.appendChild(residualSub);
      }
      detailEl.appendChild(residualBar);
    }

    const roundSummaryText = formatBattleReportRoundSummaryStrip(this.detailView);
    if (roundSummaryText) {
      const roundStrip = document.createElement("div");
      roundStrip.className = BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS;
      roundStrip.setAttribute("aria-label", "回合兵力损失摘要");
      const roundSummaryLine = document.createElement("span");
      roundSummaryLine.className = "battle-report-round-summary-line";
      roundSummaryLine.textContent = roundSummaryText;
      roundStrip.appendChild(roundSummaryLine);
      const offerRoundIntel =
        this.detailSummary != null &&
        (this.panelOpts?.canOfferIntelJump?.(this.detailSummary) ?? false);
      if (offerRoundIntel) {
        const intelLink = document.createElement("button");
        intelLink.type = "button";
        intelLink.className = REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS;
        intelLink.setAttribute("data-action", OPEN_INTEL_FOR_REPORT_ACTION);
        intelLink.textContent = "查看军情行军";
        roundStrip.appendChild(intelLink);
      }
      detailEl.appendChild(roundStrip);
    }

    const orderedIds = battleReportIdsInListOrder(this.visibleReports());
    const prevId = adjacentBattleReportId(orderedIds, this.selectedReportId, "prev");
    const nextId = adjacentBattleReportId(orderedIds, this.selectedReportId, "next");
    const navBar = document.createElement("div");
    navBar.className = "battle-report-detail-nav";
    navBar.setAttribute("role", "navigation");
    navBar.setAttribute("aria-label", "战报上一封下一封");
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.setAttribute("data-action", "nav-prev-report");
    prevBtn.textContent = "上一封";
    setBattleReportAdjNavButtonEnabled(prevBtn, prevId != null);
    applyBattleReportAdjNavFocusRing(prevBtn);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.setAttribute("data-action", "nav-next-report");
    nextBtn.textContent = "下一封";
    setBattleReportAdjNavButtonEnabled(nextBtn, nextId != null);
    applyBattleReportAdjNavFocusRing(nextBtn);
    navBar.appendChild(prevBtn);
    navBar.appendChild(nextBtn);
    detailEl.appendChild(navBar);

    if (summary) {
      const sideSummary = formatBattleReportSideSummary({
        summary,
        detail: this.detailView,
      });
      const sideBar = document.createElement("div");
      sideBar.className = "battle-report-detail-side-summary";
      sideBar.setAttribute("aria-label", "攻守将领摘要");
      const sideLine = document.createElement("p");
      sideLine.className = "battle-report-detail-side-line";
      sideLine.textContent = sideSummary.headline;
      sideBar.appendChild(sideLine);
      const linkRow = document.createElement("div");
      linkRow.className = "battle-report-detail-side-links";
      const attHeroBtn = document.createElement("button");
      attHeroBtn.type = "button";
      attHeroBtn.className = "battle-report-side-link-btn";
      attHeroBtn.setAttribute("data-action", "open-battle-hero");
      attHeroBtn.dataset.side = "attacker";
      attHeroBtn.textContent = "打开将领（攻）";
      const defHeroBtn = document.createElement("button");
      defHeroBtn.type = "button";
      defHeroBtn.className = "battle-report-side-link-btn";
      defHeroBtn.setAttribute("data-action", "open-battle-hero");
      defHeroBtn.dataset.side = "defender";
      defHeroBtn.textContent = "打开将领（守）";
      const rankBtn = document.createElement("button");
      rankBtn.type = "button";
      rankBtn.className = "battle-report-side-link-btn";
      rankBtn.setAttribute("data-action", "open-battle-rank");
      rankBtn.textContent = "打开排行";
      linkRow.appendChild(attHeroBtn);
      linkRow.appendChild(defHeroBtn);
      linkRow.appendChild(rankBtn);
      sideBar.appendChild(linkRow);
      detailEl.appendChild(sideBar);
    }
    if (summary) {
      const location = parseBattleReportLocation(summary);
      const locationArea = document.createElement("div");
      locationArea.className = "battle-report-detail-location";
      locationArea.setAttribute("aria-label", "战场坐标");
      const xy = document.createElement("span");
      xy.className = "battle-report-detail-location-xy";
      xy.textContent = location
        ? formatBattleReportLocationFields(location)
        : "location_x/location_y 未知";
      locationArea.appendChild(xy);
      if (location && shouldShowBattleReportCoordCopyBar(summary)) {
        const copyBar = document.createElement("button");
        copyBar.type = "button";
        copyBar.className = BATTLE_REPORT_COORD_COPY_BAR_CLASS;
        copyBar.setAttribute("data-action", COPY_REPORT_COORDS_READONLY_ACTION);
        copyBar.setAttribute(
          "aria-label",
          `只读复制坐标 ${formatBattleReportCoordsCopyText(location)}`,
        );
        const copyText = document.createElement("span");
        copyText.setAttribute("data-role", BATTLE_REPORT_COORD_COPY_TEXT_ROLE);
        copyText.textContent = formatBattleReportCoordsCopyText(location);
        copyBar.appendChild(copyText);
        locationArea.appendChild(copyBar);
      }
      if (location) {
        const mapBtn = document.createElement("button");
        mapBtn.type = "button";
        mapBtn.setAttribute("data-action", "view-on-map");
        mapBtn.textContent = "在小地图定位";
        locationArea.appendChild(mapBtn);
        const coordReplayBtn = document.createElement("button");
        coordReplayBtn.type = "button";
        coordReplayBtn.setAttribute("data-action", BATTLE_REPORT_COORD_REPLAY_ACTION);
        coordReplayBtn.textContent = "坐标复盘";
        locationArea.appendChild(coordReplayBtn);
        const intelBtn = document.createElement("button");
        intelBtn.type = "button";
        intelBtn.setAttribute("data-action", BATTLE_REPORT_VIEW_INTEL_ACTION);
        intelBtn.textContent = "查看军情";
        const offerIntel = this.panelOpts?.canOfferIntelJump?.(summary) ?? false;
        intelBtn.toggleAttribute("disabled", !offerIntel);
        intelBtn.classList.toggle("hidden", !offerIntel);
        locationArea.appendChild(intelBtn);
      }
      detailEl.appendChild(locationArea);

      const head = document.createElement("div");
      head.className = "battle-report-detail-head";
      const foe = document.createElement("span");
      foe.className = "battle-report-detail-foe";
      foe.textContent = formatBattleReportFoeWithoutCoord(summary);
      head.appendChild(foe);
      detailEl.appendChild(head);

      const troopScan = buildBattleReportTroopScan(summary, this.detailView);
      const summaryBlock = document.createElement("div");
      summaryBlock.className = "battle-report-detail-summary";
      summaryBlock.setAttribute("aria-label", "交战摘要");
      if (location) {
        const coordLine = document.createElement("p");
        coordLine.className = "battle-report-detail-summary-coord";
        coordLine.textContent = formatBattleReportLocationFields(location);
        summaryBlock.appendChild(coordLine);
      }
      const troopTable = document.createElement("table");
      troopTable.className = "battle-report-troop-scan";
      troopTable.innerHTML = `
        <thead>
          <tr>
            <th scope="col">阵营</th>
            <th scope="col">兵力</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${troopScan.attackerLabel}</td>
            <td>${troopScan.attackerTroops}</td>
          </tr>
          <tr>
            <td>${troopScan.defenderLabel}</td>
            <td>${troopScan.defenderTroops}</td>
          </tr>
        </tbody>
      `;
      summaryBlock.appendChild(troopTable);
      if (troopScan.openingRoundLine) {
        const roundHint = document.createElement("p");
        roundHint.className = "battle-report-detail-opening-round";
        roundHint.textContent = troopScan.openingRoundLine;
        summaryBlock.appendChild(roundHint);
      }
      detailEl.appendChild(summaryBlock);
    }

    const pre = document.createElement("pre");
    pre.textContent = this.detailText;
    detailEl.appendChild(pre);

    const roundRows = buildBattleRoundTableRows(this.detailRounds);
    if (roundRows.length > 0) {
      const jumpNumbers = battleReportRoundJumpNumbers(roundRows.map((r) => r.round));
      const jumpBar = document.createElement("div");
      jumpBar.className = "battle-report-round-jump";
      jumpBar.setAttribute("role", "navigation");
      jumpBar.setAttribute("aria-label", "回合跳转");
      const jumpLabel = document.createElement("span");
      jumpLabel.className = "battle-report-round-jump-label";
      jumpLabel.textContent = "回合：";
      jumpBar.appendChild(jumpLabel);
      if (shouldUseBattleReportRoundJumpSelect(jumpNumbers.length)) {
        const select = document.createElement("select");
        select.setAttribute("data-action", "jump-round-select");
        select.innerHTML = `<option value="">选择回合…</option>${jumpNumbers
          .map((n) => `<option value="${n}">第 ${n} 回合</option>`)
          .join("")}`;
        jumpBar.appendChild(select);
      } else {
        const chips = document.createElement("div");
        chips.className = "battle-report-round-jump-chips";
        for (const n of jumpNumbers) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "battle-report-round-jump-chip";
          chip.setAttribute("data-action", "jump-round");
          chip.setAttribute("data-round", String(n));
          chip.textContent = String(n);
          if (n === this.highlightedRound) chip.classList.add("active");
          chips.appendChild(chip);
        }
        jumpBar.appendChild(chips);
      }
      detailEl.appendChild(jumpBar);

      const wrap = document.createElement("div");
      wrap.className = "report-rounds-table-wrap";

      const table = document.createElement("table");
      table.className = "battle-report-rounds-table";
      table.setAttribute("aria-label", "战斗回合明细");
      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th scope="col">回合</th>
          <th scope="col">攻方行动</th>
          <th scope="col">守方行动</th>
          <th scope="col">攻方剩余</th>
          <th scope="col">守方剩余</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      const visible = visibleBattleRoundTableRows(roundRows, this.roundsTableExpanded);
      for (const row of visible) {
        const tr = document.createElement("tr");
        tr.id = battleReportRoundRowDomId(row.round);
        tr.setAttribute("data-round", String(row.round));
        if (row.round === this.highlightedRound) {
          tr.classList.add("battle-report-round-row-highlight");
        }
        tr.innerHTML = `
          <td>${row.round}</td>
          <td>${row.attackerAction}</td>
          <td>${row.defenderAction}</td>
          <td>${row.attackerRemaining}</td>
          <td>${row.defenderRemaining}</td>
        `;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);

      if (shouldCollapseBattleRounds(roundRows.length) && !this.roundsTableExpanded) {
        const hint = document.createElement("p");
        hint.className = "report-rounds-collapsed-hint";
        hint.textContent = `共 ${roundRows.length} 回合，默认折叠显示。`;
        wrap.appendChild(hint);
        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.setAttribute("data-action", "expand-rounds");
        expandBtn.textContent = BATTLE_REPORT_ROUNDS_EXPAND_LABEL;
        wrap.appendChild(expandBtn);
      }

      detailEl.appendChild(wrap);
    }

    const mailLink = resolveBattleReportMailLink(
      this.detailSummary,
      this.detailText,
      this.detailResult,
    );
    if (mailLink.show && mailLink.mailId && this.panelOpts?.onOpenRelatedMail) {
      const mailBtn = document.createElement("button");
      mailBtn.type = "button";
      mailBtn.className = "battle-report-mail-link-btn";
      mailBtn.setAttribute("data-action", "open-related-mail");
      mailBtn.dataset.mailId = String(mailLink.mailId);
      mailBtn.textContent = "相关邮件";
      detailEl.appendChild(mailBtn);
    }

    const dailyRows = this.panelOpts?.getDailyChainRows?.() ?? [];
    const dailyLinks = resolveBattleReportDailyLinks(summary?.outcome, dailyRows);
    if (dailyLinks.length && this.panelOpts?.onOpenRelatedDaily) {
      for (const link of dailyLinks) {
        const dailyBtn = document.createElement("button");
        dailyBtn.type = "button";
        dailyBtn.className = "battle-report-daily-link-btn";
        dailyBtn.setAttribute("data-action", "open-related-daily");
        dailyBtn.dataset.questCfgId = String(link.questCfgId);
        dailyBtn.textContent = link.label;
        detailEl.appendChild(dailyBtn);
      }
    }
  }

  private jumpToBattleRound(round: number): void {
    const rows = buildBattleRoundTableRows(this.detailRounds);
    if (!rows.some((r) => r.round === round)) return;
    if (shouldCollapseBattleRounds(rows.length) && !this.roundsTableExpanded) {
      this.roundsTableExpanded = true;
    }
    this.highlightedRound = round;
    this.renderDetail();
    this.scrollToBattleRoundRow(round);
  }

  private scrollToBattleRoundRow(round: number): void {
    const id = battleReportRoundRowDomId(round);
    const row = this.panel.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }

  private async refreshList(): Promise<void> {
    this.listError = "";
    this.listLoading = true;
    this.reports = [];
    this.total = 0;
    this.renderList();
    this.onStatus("拉取战报…");
    try {
      const res = (await this.gateway.listBattleReports(PAGE_LIMIT, 0)) as {
        reports?: BattleReportSummary[];
        total?: number;
      };
      this.reports = res.reports ?? [];
      this.total = res.total ?? this.reports.length;
      this.onStatus(`战报 ${this.reports.length}/${this.total} 条`);
    } catch (e) {
      this.reports = [];
      this.total = 0;
      this.listError = `列表加载失败：${(e as Error).message}`;
      this.onStatus(this.listError);
    }
    this.listLoading = false;
    this.renderList();
  }

  private async loadMoreReports(): Promise<void> {
    if (this.listLoading || !hasMoreBattleReports(this.reports.length, this.total)) return;
    this.listError = "";
    this.listLoading = true;
    const offset = this.reports.length;
    this.renderList();
    this.onStatus(`加载更多战报（offset ${offset}）…`);
    try {
      const res = (await this.gateway.listBattleReports(PAGE_LIMIT, offset)) as {
        reports?: BattleReportSummary[];
        total?: number;
      };
      const batch = res.reports ?? [];
      this.reports = [...this.reports, ...batch];
      this.total = res.total ?? this.total;
      this.onStatus(`战报 ${this.reports.length}/${this.total} 条`);
    } catch (e) {
      this.listError = `加载更多失败：${(e as Error).message}`;
      this.onStatus(this.listError);
    }
    this.listLoading = false;
    this.renderList();
  }

  private applyOutcomeFilterBridgeFromMail(): void {
    const bridged = consumePendingOutcomeFilterBridge();
    if (!bridged) return;
    this.outcomeFilter = bridged;
    writeBattleReportOutcomeFilterSession(bridged);
    syncBattleReportOutcomeFilterChips(this.panel, this.outcomeFilter);
  }

  private setOutcomeFilter(filter: BattleReportOutcomeFilter): void {
    if (this.outcomeFilter === filter) return;
    this.outcomeFilter = filter;
    writeBattleReportOutcomeFilterSession(filter);
    this.renderList();
  }

  private setTimeWindowFilter(filter: BattleReportTimeWindowFilter): void {
    if (this.timeWindowFilter === filter) return;
    this.timeWindowFilter = filter;
    writeBattleReportTimeWindowFilterSession(filter);
    this.renderList();
  }

  private async openReport(
    reportId: number,
    opts?: { preserveRoundNav?: boolean },
  ): Promise<void> {
    if (reportId !== this.selectedReportId) this.clearMapReplay();
    const preserveRoundNav = opts?.preserveRoundNav === true;
    const preservedRound = preserveRoundNav ? this.highlightedRound : 0;
    const preservedExpanded = preserveRoundNav ? this.roundsTableExpanded : false;
    this.selectedReportId = reportId;
    this.detailError = "";
    this.detailText = "";
    this.detailRounds = [];
    this.detailView = undefined;
    this.detailSummary = undefined;
    this.detailResult = "";
    this.roundsTableExpanded = false;
    this.highlightedRound = 0;
    this.detailLoading = true;
    this.onStatus(`战报 #${reportId}…`);
    this.renderList();
    try {
      const res = (await this.gateway.getBattleReport(reportId)) as {
        report?: {
          summary?: BattleReportSummary;
          detail?: BattleReportDetailView;
        };
      };
      this.detailSummary = res.report?.summary;
      this.detailResult = res.report?.detail?.result ?? "";
      this.detailView = res.report?.detail;
      this.detailText = formatBattleReportDetail(
        reportId,
        res.report?.summary,
        res.report?.detail,
      );
      this.detailRounds = res.report?.detail?.rounds ?? [];
      if (preserveRoundNav && preservedRound > 0) {
        const rows = buildBattleRoundTableRows(this.detailRounds);
        if (rows.some((r) => r.round === preservedRound)) {
          this.highlightedRound = preservedRound;
          if (
            preservedExpanded ||
            shouldCollapseBattleRounds(rows.length)
          ) {
            this.roundsTableExpanded = true;
          }
        }
      }
      this.onStatus("战报已加载");
    } catch (e) {
      this.detailError = `详情加载失败：${(e as Error).message}`;
      this.detailText = "";
      this.detailRounds = [];
      this.detailView = undefined;
      this.detailSummary = undefined;
      this.detailResult = "";
      this.onStatus(this.detailError);
    }
    this.detailLoading = false;
    this.renderList();
    if (this.focusDetailNavAfterRender) {
      this.focusDetailNavAfterRender = false;
      this.focusDetailNavBar();
    }
  }

  private focusDetailNavBar(): void {
    const detailEl = this.panel.querySelector<HTMLElement>('[data-role="report-detail"]');
    const nav = detailEl?.querySelector<HTMLElement>(".battle-report-detail-nav");
    if (!nav) return;
    const enabled = nav.querySelector<HTMLButtonElement>(
      "button[data-action='nav-next-report']:not(:disabled), button[data-action='nav-prev-report']:not(:disabled)",
    );
    if (enabled) {
      enabled.focus();
      return;
    }
    nav.tabIndex = -1;
    nav.focus();
  }

  private onClick(ev: Event): void {
    const filterBtn = (ev.target as HTMLElement).closest(
      'button[data-action="filter-outcome"]',
    );
    if (filterBtn) {
      const f = filterBtn.getAttribute("data-filter") as BattleReportOutcomeFilter;
      if (f) this.setOutcomeFilter(f);
      return;
    }

    const timeFilterBtn = (ev.target as HTMLElement).closest(
      'button[data-action="filter-time-window"]',
    );
    if (timeFilterBtn) {
      const value = timeFilterBtn.getAttribute("data-filter") as BattleReportTimeWindowFilter;
      if (value === "all" || value === "today" || value === "last7d") {
        this.setTimeWindowFilter(value);
      }
      return;
    }

    const clearLocBtn = (ev.target as HTMLElement).closest(
      'button[data-action="clear-location-filter"]',
    );
    if (clearLocBtn) {
      this.clearLocationFilter();
      return;
    }

    const listIntelJumpBtn = (ev.target as HTMLElement).closest(
      `[data-action="${BATTLE_REPORT_LIST_INTEL_JUMP_ACTION}"]`,
    );
    if (listIntelJumpBtn) {
      ev.stopPropagation();
      const row = listIntelJumpBtn.closest("li[data-report-id]");
      const id = Number(row?.getAttribute("data-report-id"));
      if (id) {
        const summary = this.reports.find((r) => r.report_id === id);
        if (summary) this.panelOpts?.onListIntelJump?.(summary);
      }
      return;
    }

    const replayTileBtn = (ev.target as HTMLElement).closest(
      '[data-action="open-replay-world-tile"]',
    );
    if (replayTileBtn) {
      ev.stopPropagation();
      const row = replayTileBtn.closest("li[data-report-id]");
      const id = Number(row?.getAttribute("data-report-id"));
      if (id) {
        const summary = this.reports.find((r) => r.report_id === id);
        if (summary) this.panelOpts?.onOpenReplayWorldTile?.(summary);
      }
      return;
    }

    const li = (ev.target as HTMLElement).closest("li[data-report-id]");
    if (li) {
      const id = Number(li.getAttribute("data-report-id"));
      if (id) void this.openReport(id);
      return;
    }

    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "refresh-reports") void this.refreshList();
    else if (action === "load-more-reports") void this.loadMoreReports();
    else if (action === "retry-list") void this.refreshList();
    else if (action === "retry-detail" && this.selectedReportId) {
      void this.openReport(this.selectedReportId);
    } else if (action === "expand-rounds") {
      this.roundsTableExpanded = true;
      this.renderDetail();
    } else if (action === COPY_REPORT_COORDS_READONLY_ACTION) {
      const textEl = btn.querySelector<HTMLElement>(
        `[data-role="${BATTLE_REPORT_COORD_COPY_TEXT_ROLE}"]`,
      );
      if (textEl) applyBattleReportCoordsReadonlySelect(textEl);
    } else if (action === "view-on-map" && this.detailSummary) {
      this.panelOpts?.onViewOnMap?.(this.detailSummary);
    } else if (action === BATTLE_REPORT_COORD_REPLAY_ACTION && this.detailSummary) {
      this.panelOpts?.onCoordReplay?.(this.detailSummary);
    } else if (action === BATTLE_REPORT_VIEW_INTEL_ACTION && this.detailSummary) {
      this.panelOpts?.onViewIntelNearReport?.(this.detailSummary);
    } else if (action === OPEN_INTEL_FOR_REPORT_ACTION && this.detailSummary) {
      this.panelOpts?.onViewIntelNearReport?.(this.detailSummary);
    } else if (action === "open-related-mail") {
      const mailId = Number(btn.dataset.mailId) || 0;
      if (mailId > 0) this.panelOpts?.onOpenRelatedMail?.(mailId);
    } else if (action === "open-related-daily") {
      const questCfgId = Number(btn.dataset.questCfgId) || 0;
      if (questCfgId > 0) this.panelOpts?.onOpenRelatedDaily?.(questCfgId);
    } else if (action === "jump-round") {
      const round = Number(btn.getAttribute("data-round"));
      if (round > 0) this.jumpToBattleRound(round);
    } else if (action === "nav-prev-report" || action === "nav-next-report") {
      const direction = action === "nav-prev-report" ? "prev" : "next";
      void this.navigateAdjacentReport(direction);
    } else if (action === "open-battle-hero") {
      const side = btn.dataset.side === "defender" ? "defender" : "attacker";
      this.handleOpenBattleHero(side);
    } else if (action === "open-battle-rank") {
      this.handleOpenBattleRank();
    }
  }

  private battleReportViewSnapshot(): {
    summary?: BattleReportSummary;
    detail?: BattleReportDetailView;
  } {
    return { summary: this.detailSummary, detail: this.detailView };
  }

  private handleOpenBattleHero(side: "attacker" | "defender"): void {
    const ctx = this.panelOpts?.getBattleReportLinkContext?.() ?? {};
    const link = resolveBattleReportHeroDeepLink(
      side,
      this.battleReportViewSnapshot(),
      ctx,
    );
    if (link.action === "open" && link.heroId) {
      this.panelOpts?.onOpenBattleReportHero?.(link.heroId);
      return;
    }
    const msg = link.message ?? "将领详情只读";
    if (this.panelOpts?.onBattleReportReadonlyHint) {
      this.panelOpts.onBattleReportReadonlyHint(msg);
    } else {
      this.onStatus(msg);
    }
  }

  private handleOpenBattleRank(): void {
    const ctx = this.panelOpts?.getBattleReportLinkContext?.() ?? {};
    const link = resolveBattleReportRankDeepLink(this.battleReportViewSnapshot(), ctx);
    if (!link.show || !link.entityId) {
      const msg = "暂无战力榜可映射的玩家";
      if (this.panelOpts?.onBattleReportReadonlyHint) {
        this.panelOpts.onBattleReportReadonlyHint(msg);
      } else {
        this.onStatus(msg);
      }
      return;
    }
    this.panelOpts?.onOpenBattleReportRank?.(link.entityId);
  }

  private async navigateAdjacentReport(
    direction: "prev" | "next",
  ): Promise<void> {
    const orderedIds = battleReportIdsInListOrder(this.visibleReports());
    const target = adjacentBattleReportId(orderedIds, this.selectedReportId, direction);
    if (target == null) return;
    this.focusDetailNavAfterRender = true;
    await this.openReport(target, { preserveRoundNav: true });
  }

  private shouldHandleAdjacentNavKey(ev: KeyboardEvent): boolean {
    if (!this.isOpen() || this.detailLoading || !this.selectedReportId) return false;
    if (!isBattleReportAdjNavKeyboardEnabled(this.panel)) return false;
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return false;
    const target = ev.target as HTMLElement | null;
    if (
      target &&
      (target.closest("input, textarea, select") || target.isContentEditable)
    ) {
      return false;
    }
    if (target?.closest('[data-role="report-detail"]')) return true;
    if (ev.altKey && target?.closest(".battle-report-panel")) return true;
    return false;
  }

  private onKeyDown(ev: KeyboardEvent): void {
    const list = this.panel.querySelector<HTMLElement>('[data-role="report-list"]');
    const orderedIds = battleReportIdsInListOrder(this.visibleReports());
    if (
      list &&
      handleBattleReportListPanelKeyDown(ev, {
        panel: this.panel,
        list,
        orderedIds,
        selectedReportId: this.selectedReportId,
        onSelectReportId: (id) => {
          this.queueAdjacentNavResidualRing(id);
          void this.openReport(id, { preserveRoundNav: true });
        },
      })
    ) {
      return;
    }
    if (
      list &&
      handleListRovingKeyDown(ev, list, {
        itemSelector: "li[data-report-id]",
        onActivate: (row) => {
          const id = Number(row.getAttribute("data-report-id"));
          if (id > 0) {
            this.queueAdjacentNavResidualRing(id);
            void this.openReport(id);
          }
        },
      })
    ) {
      return;
    }
    if (!this.shouldHandleAdjacentNavKey(ev)) return;
    ev.preventDefault();
    void this.navigateAdjacentReport(ev.key === "ArrowLeft" ? "prev" : "next");
  }

  private onChange(ev: Event): void {
    const jumpSelect = (ev.target as HTMLElement).closest(
      'select[data-action="jump-round-select"]',
    ) as HTMLSelectElement | null;
    if (!jumpSelect) return;
    const round = Number(jumpSelect.value);
    if (round > 0) {
      this.jumpToBattleRound(round);
      jumpSelect.value = "";
    }
  }
}
