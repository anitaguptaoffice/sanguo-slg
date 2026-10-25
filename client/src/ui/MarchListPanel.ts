import type { GatewayPort } from "@/net/GatewayClient";
import { detectNewMarchArrivalReminders, type MarchArrivalReminder } from "@/net/marchArrival";
import {
  formatMarchListPrimaryLine,
  formatMarchRowRecentEtaBrief,
  MARCH_ROW_RECENT_ETA_ROLE,
  marchNeedsPoll,
  MARCH_LIST_POLL_MS,
  MARCH_LIST_REMAINING_TICK_MS,
  type MarchSummary,
} from "@/net/militaryFormat";
import {
  detectMarchPhaseChange,
  scheduleIntelPhaseChangeFlash,
} from "@/net/marchIntelPhaseChangeFlash";
import { scheduleIntelPhaseChangeResidualDeepPulse } from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { scheduleIntelPhaseChangeResidualDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestPulse";
import { scheduleIntelPhaseChangeResidualDeepestDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestPulse } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import { scheduleIntelPhaseChangeResidualPulse } from "@/net/marchIntelPhaseChangeResidualPulse";
import {
  scheduleMarchPhaseChangedPulse,
} from "@/net/marchPhaseListRefresh";
import {
  marchListCompactClass,
  marchListEmptyClass,
  marchListEmptyMessage,
  marchListLoadErrorListHint,
} from "@/net/panelDensity";
import {
  applyPanelStateChrome,
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  clearMarchHighlightSession,
  MARCH_ROW_RECENT_CLASS,
  marchRowShouldBeRecent,
  readMarchHighlightSession,
  remainingMarchHighlightMs,
  resolveMarchHighlightOnRowSelect,
  type MarchHighlightState,
  writeMarchHighlightSession,
} from "@/net/marchHighlight";
import {
  clearMinimapMarchFocusSession,
  readMinimapMarchFocusSession,
  syncMinimapMarchFocusSession,
} from "@/net/minimapMarchFocus";
import {
  applyMilitaryListClientFilters,
  militaryListPhaseFilterLabel,
  readMilitaryListFilterSession,
  type MilitaryListFilterV1,
  writeMilitaryListFilterSession,
} from "@/net/militaryListFilter";
import {
  ensureMarchListPhaseFilterChips,
  militaryListPhaseChipReducer,
  parseMilitaryListPhaseChipPhase,
  syncMilitaryListPhaseFilterChips,
} from "@/net/militaryListPhaseChip";
import type { AssetLoader } from "@/engine/AssetLoader";
import { mountFilterUiSkins } from "@/engine/artUiFilterSkin";
import {
  filterMarchesByDestination,
  MARCH_LIST_ROW_DEST_MATCH_CLASS,
  type MarchDestFilterMode,
} from "@/ui/marchWorldListLink";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import {
  handleListRovingKeyDown,
  syncListRovingTabindex,
} from "@/ui/listRovingTabindex";
import { findFirstMarchByDest } from "@/ui/worldMinimap";
import {
  formatMarchIntelSecondaryLine,
  MARCH_INTEL_TO_QUEUE_BANNER_ACTION,
} from "@/net/marchQueueBanner";
import {
  MARCH_INFO_REPLAY_BATTLE_REPORT_ACTION,
  readBattleReportReplaySession,
  resolveBattleReportIdForMarchReplay,
} from "@/net/battleReportIntelReplayJump";
import {
  formatMarchInfoCardPrimary,
  formatMarchInfoCardSecondary,
  MARCH_INFO_CARD_CLASS,
  MARCH_INFO_CARD_OPEN_MILITARY_ACTION,
  MARCH_ROW_SELECTED_CLASS,
} from "@/net/marchInfoCard";
import {
  formatMarchIntelPhaseEtaStrip,
  INTEL_ROW_PHASE_SUBLINE_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_ROLE,
  syncMarchIntelPhaseEtaMutualHighlight,
} from "@/net/marchIntelPhaseEtaStrip";
import {
  formatMarchIntelEtaResidualCoordLine,
  MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS,
  MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE,
} from "@/ui/worldTileIntelEtaResidual";
import {
  applyMarchSubmitIntelHandoff,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE,
  MARCH_SUBMIT_INTEL_HANDOFF_STRIP_CLASS,
} from "@/net/marchSubmitIntelHandoff";
import {
  applyMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestDeepestDeeper,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE,
} from "@/net/marchSubmitIntelRefreshStamp";
export type MarchListPanelOptions = {
  /** ART-UI-FILTER-008：筛选 chip / 列表行九宫 / badge.dot（CLIENT-124）。 */
  assets?: AssetLoader;
  pollIntervalMs?: number;
  nowMs?: () => number;
  onMarchesUpdated?: (marches: MarchSummary[]) => void;
  onSelectionChange?: (march: MarchSummary | null) => void;
  /** CLIENT-061 世界列表当前选中格（「世界选中格」筛选）。 */
  getWorldSelectedGrid?: () => { x: number; y: number } | null;
  onMarchArrivalReminders?: (reminders: MarchArrivalReminder[]) => void;
  /** CLIENT-093：军情行再出征 → 军事面板预填。 */
  onRemarchFromRow?: (march: MarchSummary) => void;
  /** CLIENT-156：军情新出征行 → 军事队列顶栏摘要互跳。 */
  onOpenMilitaryQueueBanner?: (marchId: number) => void;
  /** CLIENT-172：信息卡「查看目的格点」→ 世界面板焦点。 */
  onViewMarchDestTile?: (march: MarchSummary) => void;
  /** CLIENT-178：军情信息卡「打开军事」→ CLIENT-093 预填。 */
  onOpenMilitaryFromInfoCard?: (march: MarchSummary) => void;
  /** CLIENT-191：信息卡「复盘战报」→ 战报详情 report_id（session 只读匹配）。 */
  onReplayBattleReportFromInfoCard?: (march: MarchSummary, reportId: number) => void;
};

export class MarchListPanel {
  private panel!: HTMLElement;
  private marches: MarchSummary[] = [];
  private listError = "";
  private listLoading = false;
  private listPollTimer: ReturnType<typeof setInterval> | null = null;
  private remainingTickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs: number;
  private readonly nowMs: () => number;
  private readonly onMarchesUpdated?: (marches: MarchSummary[]) => void;
  private readonly onSelectionChange?: (march: MarchSummary | null) => void;
  private readonly getWorldSelectedGrid?: () => { x: number; y: number } | null;
  private readonly onMarchArrivalReminders?: (reminders: MarchArrivalReminder[]) => void;
  private readonly onRemarchFromRow?: (march: MarchSummary) => void;
  private readonly onOpenMilitaryQueueBanner?: (marchId: number) => void;
  private readonly onViewMarchDestTile?: (march: MarchSummary) => void;
  private readonly onOpenMilitaryFromInfoCard?: (march: MarchSummary) => void;
  private readonly onReplayBattleReportFromInfoCard?: (
    march: MarchSummary,
    reportId: number,
  ) => void;
  private lastListSnapshot: MarchSummary[] = [];
  private selectedMarchId: number | null = null;
  private destFilterMode: MarchDestFilterMode = "all";
  private manualDestFilter: { x: number; y: number } | null = null;
  private listFilter: MilitaryListFilterV1 = readMilitaryListFilterSession();
  private highlightState: MarchHighlightState | null = null;
  private highlightExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPhaseChangePulseIds: number[] = [];
  private readonly assets?: AssetLoader;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private readonly getCityId: () => number | undefined,
    private onStatus: (msg: string) => void,
    options?: MarchListPanelOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? MARCH_LIST_POLL_MS;
    this.nowMs = options?.nowMs ?? (() => Date.now());
    this.onMarchesUpdated = options?.onMarchesUpdated;
    this.onSelectionChange = options?.onSelectionChange;
    this.getWorldSelectedGrid = options?.getWorldSelectedGrid;
    this.onMarchArrivalReminders = options?.onMarchArrivalReminders;
    this.onRemarchFromRow = options?.onRemarchFromRow;
    this.onOpenMilitaryQueueBanner = options?.onOpenMilitaryQueueBanner;
    this.onViewMarchDestTile = options?.onViewMarchDestTile;
    this.onOpenMilitaryFromInfoCard = options?.onOpenMilitaryFromInfoCard;
    this.onReplayBattleReportFromInfoCard = options?.onReplayBattleReportFromInfoCard;
    this.assets = options?.assets;
  }

  /** 用户手动改出征目标时清除 CLIENT-080 高亮（再出征本身不调用）。 */
  clearRecentMarchHighlight(): void {
    this.highlightState = null;
    clearMarchHighlightSession();
    this.clearHighlightExpiryTimer();
    if (this.isOpen()) this.renderList();
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  getMarches(): MarchSummary[] {
    return this.marches;
  }

  getSelectedMarchId(): number | null {
    return this.selectedMarchId;
  }

  getSelectedMarch(): MarchSummary | null {
    if (this.selectedMarchId == null) return null;
    return this.marches.find((m) => m.march_id === this.selectedMarchId) ?? null;
  }

  getDestFilterMode(): MarchDestFilterMode {
    return this.destFilterMode;
  }

  getDestFilter(): { x: number; y: number } | null {
    return this.resolveDestFilter();
  }

  /** 世界城池列表点选时联动「世界选中格」筛选（客户端快照，无新 RPC）。 */
  syncWorldGridSelection(grid: { x: number; y: number } | null): void {
    if (grid != null) {
      this.destFilterMode = "world";
    } else if (this.destFilterMode === "world") {
      this.destFilterMode = "all";
    }
    this.renderFilterControls();
    this.renderList();
  }

  /** @deprecated 使用 syncWorldGridSelection / setDestFilterMode */
  setDestFilter(x: number | null, y: number | null): void {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.destFilterMode = "all";
      this.manualDestFilter = null;
    } else {
      this.destFilterMode = "manual";
      this.manualDestFilter = { x, y };
    }
    this.renderFilterControls();
    this.renderList();
  }

  setDestFilterMode(mode: MarchDestFilterMode): void {
    this.destFilterMode = mode;
    if (mode !== "manual") this.manualDestFilter = null;
    this.renderFilterControls();
    this.renderList();
  }

  private resolveDestFilter(): { x: number; y: number } | null {
    if (this.destFilterMode === "all") return null;
    if (this.destFilterMode === "world") {
      const g = this.getWorldSelectedGrid?.() ?? null;
      if (g == null || !Number.isFinite(g.x) || !Number.isFinite(g.y)) return null;
      return g;
    }
    return this.manualDestFilter;
  }

  /** 打开军情面板并按目的格筛选（复用 CLIENT-069 客户端快照过滤）。 */
  openIntelViewForGrid(
    destX: number,
    destY: number,
    opts?: { preferWorldSelection?: boolean },
  ): void {
    if (!Number.isFinite(destX) || !Number.isFinite(destY)) return;
    const worldGrid = this.getWorldSelectedGrid?.() ?? null;
    const useWorld =
      opts?.preferWorldSelection !== false &&
      worldGrid != null &&
      worldGrid.x === destX &&
      worldGrid.y === destY;
    if (useWorld) {
      this.destFilterMode = "world";
      this.manualDestFilter = null;
    } else {
      this.destFilterMode = "manual";
      this.manualDestFilter = { x: destX, y: destY };
    }
    this.renderFilterControls();
    if (!this.isOpen()) {
      this.panel.classList.remove("hidden");
      resetCenterPanelViewportScroll(this.panel);
      void this.refreshList();
      this.startPoll();
    } else {
      this.renderList();
    }
  }

  /** 小地图点击目的点时选中列表首条匹配行军（只读）。 */
  selectMarchByDest(destX: number, destY: number): boolean {
    const match = findFirstMarchByDest(this.marches, destX, destY);
    if (!match?.march_id) return false;
    this.setSelectedMarchId(match.march_id);
    if (!this.isOpen()) {
      this.panel.classList.remove("hidden");
      void this.refreshList();
      this.startPoll();
    }
    return true;
  }

  selectMarchById(marchId: number | null, opts?: { openPanel?: boolean }): void {
    if (opts?.openPanel && marchId != null && !this.isOpen()) {
      syncMinimapMarchFocusSession(marchId);
      this.selectedMarchId = marchId;
      this.panel.classList.remove("hidden");
      void this.refreshList();
      this.startPoll();
      const march = this.marches.find((m) => m.march_id === marchId) ?? null;
      this.onSelectionChange?.(march);
      return;
    }
    this.setSelectedMarchId(marchId);
  }

  private readonly onListKeyDownBound = (ev: KeyboardEvent): void => {
    this.onListKeyDown(ev);
  };

  attach(): void {
    this.listFilter = readMilitaryListFilterSession();
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.panel.addEventListener("change", (ev) => this.onFilterChange(ev));
    this.panel.addEventListener("keydown", this.onListKeyDownBound);
    this.renderFilterControls();
    this.mountFilterSkins();
  }

  detach(): void {
    this.stopPoll();
    this.clearHighlightExpiryTimer();
    this.panel?.removeEventListener("keydown", this.onListKeyDownBound);
    this.panel?.remove();
  }

  private onListKeyDown(ev: KeyboardEvent): void {
    if (!this.isOpen()) return;
    const ul = this.panel.querySelector<HTMLElement>('[data-role="march-list"]');
    if (!ul) return;
    handleListRovingKeyDown(ev, ul, {
      itemSelector: "li[data-march-id]",
      onActivate: (row) => {
        const id = Number(row.getAttribute("data-march-id"));
        if (id > 0) this.setSelectedMarchId(id);
      },
    });
  }

  isOpen(): boolean {
    return this.panel != null && !this.panel.classList.contains("hidden");
  }

  getPanelElement(): HTMLElement | null {
    return this.panel ?? null;
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (this.isOpen()) {
      resetCenterPanelViewportScroll(this.panel);
      void this.refreshList();
      this.startPoll();
    } else {
      this.stopPoll();
    }
  }

  /**
   * 出征成功后由主城场景调用（CLIENT-116）：写入高亮、打开军情面板并刷新列表，一步扫读新行军 ETA。
   * CLIENT-222：顶栏军情交接文案 + `intel-new-march-highlight` 3s。
   */
  notifyMarchStarted(
    marchId?: number | null,
    opts?: { march?: MarchSummary | null; toX?: number; toY?: number },
  ): void {
    const fallbackToX = opts?.toX ?? 0;
    const fallbackToY = opts?.toY ?? 0;
    if (marchId != null && marchId > 0) {
      this.setRecentMarchHighlight(marchId);
      syncMinimapMarchFocusSession(marchId);
      this.selectedMarchId = marchId;
    }
    const opening = !this.isOpen();
    if (opening) {
      this.panel.classList.remove("hidden");
      resetCenterPanelViewportScroll(this.panel);
      this.startPoll();
    }
    void this.refreshList().then(() => {
      this.scrollHighlightedMarchIntoView();
      const march =
        opts?.march ??
        (marchId != null ? this.marches.find((m) => m.march_id === marchId) ?? null : null);
      if (march) this.onSelectionChange?.(march);
      if (marchId != null && marchId > 0) {
        const nowMs = this.nowMs();
        applyMarchSubmitIntelHandoff(this.panel, marchId, {
          march,
          toX: fallbackToX,
          toY: fallbackToY,
          nowMs,
        });
        applyMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestDeepestDeeper(
          this.panel,
          marchId,
          nowMs,
          nowMs,
        );
      }
    });
  }

  /** 写入 session 高亮并调度 TTL 清除（CLIENT-080）。 */
  setRecentMarchHighlight(marchId: number): void {
    const now = this.nowMs();
    writeMarchHighlightSession(marchId, now);
    this.highlightState = { march_id: marchId, highlighted_at_ms: now };
    this.scheduleHighlightExpiry();
    if (this.isOpen()) this.renderList();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden march-intel-panel";
    el.dataset.centerPanel = "march";
    el.innerHTML = `
      <h3>行军</h3>
      <p class="${MARCH_SUBMIT_INTEL_HANDOFF_STRIP_CLASS} hidden" data-role="${MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE}" aria-live="polite"></p>
      <p class="hidden" data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}" aria-live="polite"></p>
      <p data-role="march-hint">military.v1.ListMarches；打开面板时每 ${this.pollIntervalMs / 1000}s 自动刷新进行中行军，剩余时间每秒更新。</p>
      <fieldset class="march-dest-filter" data-role="march-dest-filter">
        <legend>目的格点筛选</legend>
        <label><input type="radio" name="march-dest-filter" value="all" checked /> 全部</label>
        <label><input type="radio" name="march-dest-filter" value="world" /> 世界选中格</label>
        <label><input type="radio" name="march-dest-filter" value="manual" /> 手动格点</label>
        <span class="march-dest-filter-manual hidden" data-role="march-dest-manual">
          <input type="number" data-field="filter-to-x" placeholder="x" aria-label="筛选目的 x" />
          <input type="number" data-field="filter-to-y" placeholder="y" aria-label="筛选目的 y" />
          <button type="button" data-action="apply-march-dest-filter">应用</button>
        </span>
      </fieldset>
      <fieldset class="march-list-filter panel-filter-chip-bar" data-role="march-list-filter">
        <legend>阶段与排序</legend>
        <div
          class="march-list-phase-chips"
          data-role="march-phase-chips"
          role="group"
          aria-label="军情阶段筛选"
        ></div>
        <label>
          排序
          <select data-action="march-eta-sort" aria-label="军情 ETA 排序">
            <option value="default">默认顺序</option>
            <option value="eta_asc">ETA 升序</option>
            <option value="eta_desc">ETA 降序</option>
          </select>
        </label>
      </fieldset>
      <button type="button" data-action="refresh-marches">刷新列表</button>
      <p class="report-panel-status" data-role="march-list-status"></p>
      <p class="march-intel-coord-sync-empty-hint hidden" data-role="march-intel-coord-sync-empty-hint" aria-live="polite"></p>
      <aside class="${MARCH_INFO_CARD_CLASS} hidden" data-role="march-info-card" aria-live="polite">
        <h4>行军信息</h4>
        <p class="march-info-card-state hidden" data-role="march-info-card-state"></p>
        <div class="march-info-card-body hidden" data-role="march-info-card-body">
          <p class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}" data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"></p>
          <p class="${MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS}" data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}"></p>
          <p class="march-info-card-primary" data-role="march-info-card-primary"></p>
          <p class="march-info-card-secondary" data-role="march-info-card-secondary"></p>
          <div class="march-info-card-actions">
            <button type="button" data-action="march-info-view-dest">查看目的格点</button>
            <button type="button" data-action="march-info-remarch">再出征</button>
            <button type="button" data-action="${MARCH_INFO_CARD_OPEN_MILITARY_ACTION}">打开军事</button>
            <button type="button" data-action="${MARCH_INFO_REPLAY_BATTLE_REPORT_ACTION}">复盘战报</button>
          </div>
        </div>
      </aside>
      <div class="panel-scroll-body" data-role="march-scroll">
        <ul class="march-list" data-role="march-list"></ul>
      </div>
    `;
    const chipHost = el.querySelector('[data-role="march-phase-chips"]') as HTMLElement | null;
    if (chipHost) ensureMarchListPhaseFilterChips(chipHost);
    return el;
  }

  private mountFilterSkins(): void {
    if (!this.assets || !this.panel) return;
    mountFilterUiSkins(this.panel, this.assets);
  }

  private renderFilterControls(): void {
    const listFilterRoot = this.panel?.querySelector('[data-role="march-list-filter"]');
    if (listFilterRoot) {
      const chipRoot = listFilterRoot.querySelector('[data-role="march-phase-chips"]');
      if (chipRoot) syncMilitaryListPhaseFilterChips(chipRoot, this.listFilter.phase);
      const sortSelect = listFilterRoot.querySelector(
        '[data-action="march-eta-sort"]',
      ) as HTMLSelectElement | null;
      if (sortSelect) sortSelect.value = this.listFilter.etaSort;
    }

    const fieldset = this.panel?.querySelector('[data-role="march-dest-filter"]');
    if (!fieldset) return;
    const mode = this.destFilterMode;
    for (const input of fieldset.querySelectorAll<HTMLInputElement>('input[name="march-dest-filter"]')) {
      input.checked = input.value === mode;
    }
    const manualWrap = fieldset.querySelector('[data-role="march-dest-manual"]');
    manualWrap?.classList.toggle("hidden", mode !== "manual");
    if (this.manualDestFilter) {
      const xEl = fieldset.querySelector('[data-field="filter-to-x"]') as HTMLInputElement | null;
      const yEl = fieldset.querySelector('[data-field="filter-to-y"]') as HTMLInputElement | null;
      if (xEl) xEl.value = String(this.manualDestFilter.x);
      if (yEl) yEl.value = String(this.manualDestFilter.y);
    }
    this.mountFilterSkins();
  }

  private renderList(): void {
    const ul = this.panel.querySelector<HTMLElement>('[data-role="march-list"]');
    const statusEl = this.panel.querySelector('[data-role="march-list-status"]');
    if (!ul) return;

    if (statusEl) {
      statusEl.textContent = this.listLoading
        ? PANEL_STATE_LOADING_MESSAGE
        : this.listError;
    }

    ul.innerHTML = "";
    ul.classList.remove(marchListCompactClass());

    if (this.listLoading && !this.marches.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, {
        assets: this.assets,
      });
      return;
    }

    if (this.listError && !this.marches.length) {
      renderPanelStateListRow(ul, "error", marchListLoadErrorListHint(), {
        legacyClass: marchListEmptyClass(),
        assets: this.assets,
      });
      return;
    }

    const filter = this.resolveDestFilter();
    const destFiltered =
      filter != null
        ? filterMarchesByDestination(this.marches, filter.x, filter.y)
        : this.marches;
    const now = this.nowMs();
    const visible = applyMilitaryListClientFilters(destFiltered, this.listFilter, now);

    if (this.destFilterMode === "world" && filter == null && this.marches.length) {
      renderPanelStateListRow(
        ul,
        "empty",
        "请在「世界」面板点选城池格，或切换为「全部」/「手动格点」筛选",
        { legacyClass: marchListEmptyClass(), assets: this.assets },
      );
      return;
    }

    if (filter != null && !visible.length && this.marches.length) {
      const phaseLabel = militaryListPhaseFilterLabel(this.listFilter.phase);
      const phaseHint =
        this.listFilter.phase !== "all" ? `，阶段「${phaseLabel}」无匹配` : "";
      renderPanelStateListRow(
        ul,
        "empty",
        `格点 (${filter.x},${filter.y}) 暂无指向行军（共 ${this.marches.length} 条进行中${phaseHint}）`,
        { legacyClass: marchListEmptyClass(), assets: this.assets },
      );
      return;
    }

    if (
      destFiltered.length > 0 &&
      !visible.length &&
      this.listFilter.phase !== "all"
    ) {
      renderPanelStateListRow(
        ul,
        "empty",
        `阶段「${militaryListPhaseFilterLabel(this.listFilter.phase)}」暂无匹配行军（共 ${destFiltered.length} 条）`,
        { legacyClass: marchListEmptyClass(), assets: this.assets },
      );
      return;
    }

    if (!visible.length) {
      renderPanelStateListRow(ul, "empty", marchListEmptyMessage(), {
        legacyClass: marchListEmptyClass(),
        assets: this.assets,
      });
      return;
    }

    if (visible.length >= 2) {
      ul.classList.add(marchListCompactClass());
    }

    for (const m of visible) {
      const li = document.createElement("li");
      li.setAttribute("data-ui-filter-row", "");
      const body = document.createElement("div");
      body.className = "march-row-body";
      const primary = document.createElement("span");
      primary.className = "march-row-primary";
      primary.textContent = formatMarchListPrimaryLine(m);
      const isRecent =
        m.march_id != null &&
        marchRowShouldBeRecent(m.march_id, this.highlightState, now);
      if (isRecent) {
        const dot = document.createElement("span");
        dot.setAttribute("data-ui-filter-badge", "dot");
        dot.setAttribute("data-role", "march-row-recent-dot");
        dot.setAttribute("aria-label", "新出征高亮");
        primary.prepend(dot);
        const etaBrief = formatMarchRowRecentEtaBrief(m, now);
        if (etaBrief) {
          const etaEl = document.createElement("span");
          etaEl.className = "march-row-recent-eta";
          etaEl.setAttribute("data-role", MARCH_ROW_RECENT_ETA_ROLE);
          if (m.march_id != null) etaEl.setAttribute("data-march-id", String(m.march_id));
          etaEl.textContent = etaBrief;
          body.appendChild(etaEl);
        }
      }
      const phaseSubline = document.createElement("span");
      phaseSubline.className = INTEL_ROW_PHASE_SUBLINE_CLASS;
      phaseSubline.setAttribute("data-role", INTEL_ROW_PHASE_SUBLINE_CLASS);
      phaseSubline.textContent = formatMarchIntelPhaseEtaStrip(m, now);
      const meta = document.createElement("span");
      meta.className = "march-row-meta";
      meta.setAttribute("data-role", "march-row-meta");
      meta.textContent = formatMarchIntelSecondaryLine(m, now, this.highlightState);
      body.appendChild(primary);
      body.appendChild(phaseSubline);
      body.appendChild(meta);
      li.appendChild(body);
      if (isRecent && m.march_id != null) {
        const toBanner = document.createElement("button");
        toBanner.type = "button";
        toBanner.className = "march-intel-queue-banner-link";
        toBanner.setAttribute("data-action", MARCH_INTEL_TO_QUEUE_BANNER_ACTION);
        toBanner.setAttribute("data-march-id", String(m.march_id));
        toBanner.textContent = "军事队列";
        li.appendChild(toBanner);
      }
      if (m.march_id != null && Number.isFinite(m.to_x) && Number.isFinite(m.to_y)) {
        const remarch = document.createElement("button");
        remarch.type = "button";
        remarch.className = "march-row-remarch-btn";
        remarch.setAttribute("data-action", "march-remarch");
        remarch.setAttribute("data-march-id", String(m.march_id));
        remarch.textContent = "再出征";
        li.appendChild(remarch);
      }
      if (m.march_id != null) {
        li.setAttribute("data-march-id", String(m.march_id));
        meta.setAttribute("data-march-id", String(m.march_id));
        phaseSubline.setAttribute("data-march-id", String(m.march_id));
        li.setAttribute("role", "button");
        li.tabIndex = 0;
      }
      if (m.march_id != null && m.march_id === this.selectedMarchId) {
        li.classList.add("march-list-row-selected", MARCH_ROW_SELECTED_CLASS, "selected");
        li.setAttribute("aria-selected", "true");
      } else {
        li.classList.remove(MARCH_ROW_SELECTED_CLASS);
        li.removeAttribute("aria-selected");
      }
      if (filter != null) {
        li.classList.add(MARCH_LIST_ROW_DEST_MATCH_CLASS);
      }
      if (isRecent) {
        li.classList.add(MARCH_ROW_RECENT_CLASS);
      }
      ul.appendChild(li);
    }
    this.applyPhaseChangeRowPulses();
    syncListRovingTabindex(ul as HTMLElement, "li[data-march-id]");
    this.mountFilterSkins();
    this.renderMarchInfoCard();
  }

  private renderMarchInfoCard(): void {
    const card = this.panel?.querySelector<HTMLElement>('[data-role="march-info-card"]');
    const stateEl = this.panel?.querySelector<HTMLElement>('[data-role="march-info-card-state"]');
    const bodyEl = this.panel?.querySelector<HTMLElement>('[data-role="march-info-card-body"]');
    const primaryEl = this.panel?.querySelector<HTMLElement>(
      '[data-role="march-info-card-primary"]',
    );
    const secondaryEl = this.panel?.querySelector<HTMLElement>(
      '[data-role="march-info-card-secondary"]',
    );
    const phaseEtaStripEl = this.panel?.querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"]`,
    );
    const etaResidualCoordEl = this.panel?.querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}"]`,
    );
    if (
      !card ||
      !stateEl ||
      !bodyEl ||
      !primaryEl ||
      !secondaryEl ||
      !phaseEtaStripEl ||
      !etaResidualCoordEl
    )
      return;

    const march = this.getSelectedMarch();
    const selected = march != null;
    card.classList.toggle("hidden", !selected && !this.listLoading && !this.listError);
    card.classList.toggle(MARCH_ROW_SELECTED_CLASS, selected);
    if (march?.march_id != null) {
      card.setAttribute("data-march-id", String(march.march_id));
    } else {
      card.removeAttribute("data-march-id");
    }

    if (this.listLoading && !march) {
      stateEl.classList.remove("hidden");
      stateEl.textContent = PANEL_STATE_LOADING_MESSAGE;
      applyPanelStateChrome(stateEl, "loading", this.assets);
      bodyEl.classList.add("hidden");
      card.classList.remove("hidden");
      return;
    }

    if (this.listError && !march) {
      stateEl.classList.remove("hidden");
      stateEl.textContent = marchListLoadErrorListHint();
      applyPanelStateChrome(stateEl, "error", this.assets);
      bodyEl.classList.add("hidden");
      card.classList.remove("hidden");
      return;
    }

    if (!march) {
      stateEl.textContent = "";
      stateEl.classList.add("hidden");
      stateEl.removeAttribute("data-panel-state");
      bodyEl.classList.add("hidden");
      card.classList.add("hidden");
      card.classList.remove(MARCH_ROW_SELECTED_CLASS);
      syncMarchIntelPhaseEtaMutualHighlight(this.panel, null);
      etaResidualCoordEl.textContent = "";
      etaResidualCoordEl.classList.add("hidden");
      return;
    }

    stateEl.textContent = "";
    stateEl.classList.add("hidden");
    stateEl.removeAttribute("data-panel-state");
    bodyEl.classList.remove("hidden");

    const now = this.nowMs();
    phaseEtaStripEl.textContent = formatMarchIntelPhaseEtaStrip(march, now);
    const coordLine = formatMarchIntelEtaResidualCoordLine(march);
    if (coordLine) {
      etaResidualCoordEl.textContent = coordLine;
      etaResidualCoordEl.classList.remove("hidden");
    } else {
      etaResidualCoordEl.textContent = "";
      etaResidualCoordEl.classList.add("hidden");
    }
    primaryEl.textContent = formatMarchInfoCardPrimary(march);
    secondaryEl.textContent = formatMarchInfoCardSecondary(march, now);
    syncMarchIntelPhaseEtaMutualHighlight(this.panel, march.march_id ?? null);

    const remarchBtn = card.querySelector<HTMLButtonElement>('[data-action="march-info-remarch"]');
    const viewDestBtn = card.querySelector<HTMLButtonElement>('[data-action="march-info-view-dest"]');
    const openMilitaryBtn = card.querySelector<HTMLButtonElement>(
      `[data-action="${MARCH_INFO_CARD_OPEN_MILITARY_ACTION}"]`,
    );
    const replayReportBtn = card.querySelector<HTMLButtonElement>(
      `[data-action="${MARCH_INFO_REPLAY_BATTLE_REPORT_ACTION}"]`,
    );
    const hasDest = Number.isFinite(march.to_x) && Number.isFinite(march.to_y);
    viewDestBtn?.toggleAttribute("disabled", !hasDest);
    remarchBtn?.toggleAttribute("disabled", !hasDest);
    openMilitaryBtn?.toggleAttribute("disabled", !hasDest);
    const replayReportId = resolveBattleReportIdForMarchReplay(
      march,
      readBattleReportReplaySession(),
    );
    replayReportBtn?.toggleAttribute("disabled", replayReportId == null);
    if (openMilitaryBtn && march.march_id != null) {
      openMilitaryBtn.setAttribute("data-march-id", String(march.march_id));
    }
  }

  private applyPhaseChangeRowPulses(): void {
    if (!this.pendingPhaseChangePulseIds.length) return;
    const changedIds = new Set(this.pendingPhaseChangePulseIds);
    for (const id of this.pendingPhaseChangePulseIds) {
      const li = this.panel.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
      scheduleMarchPhaseChangedPulse(li);
      scheduleIntelPhaseChangeFlash(li);
      scheduleIntelPhaseChangeResidualPulse(li);
      scheduleIntelPhaseChangeResidualDeepPulse(li);
      scheduleIntelPhaseChangeResidualDeeperPulse(li);
      scheduleIntelPhaseChangeResidualDeepestPulse(li);
      scheduleIntelPhaseChangeResidualDeepestDeeperPulse(li);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(li);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(li);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse(li);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(li);
    }
    if (this.selectedMarchId != null && changedIds.has(this.selectedMarchId)) {
      const strip = this.panel.querySelector<HTMLElement>(
        `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"].${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}`,
      );
      scheduleIntelPhaseChangeFlash(strip);
      scheduleIntelPhaseChangeResidualPulse(strip);
      scheduleIntelPhaseChangeResidualDeepPulse(strip);
      scheduleIntelPhaseChangeResidualDeeperPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestDeeperPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse(strip);
      scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(strip);
    }
    this.pendingPhaseChangePulseIds = [];
  }

  private updateRemainingLabels(): void {
    const now = this.nowMs();
    const nodes = this.panel.querySelectorAll<HTMLElement>('[data-role="march-row-meta"]');
    for (const el of nodes) {
      const id = Number(el.getAttribute("data-march-id"));
      if (Number.isNaN(id)) continue;
      const m = this.marches.find((row) => row.march_id === id);
      if (!m) continue;
      el.textContent = formatMarchIntelSecondaryLine(m, now, this.highlightState);
    }
    const sublineNodes = this.panel.querySelectorAll<HTMLElement>(
      `[data-role="${INTEL_ROW_PHASE_SUBLINE_CLASS}"]`,
    );
    for (const el of sublineNodes) {
      const li = el.closest("li[data-march-id]");
      const id = Number(li?.getAttribute("data-march-id"));
      if (Number.isNaN(id)) continue;
      const m = this.marches.find((row) => row.march_id === id);
      if (!m) continue;
      el.textContent = formatMarchIntelPhaseEtaStrip(m, now);
    }
    const infoSecondary = this.panel.querySelector<HTMLElement>(
      '[data-role="march-info-card-secondary"]',
    );
    const phaseEtaStripEl = this.panel.querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"]`,
    );
    const selected = this.getSelectedMarch();
    if (infoSecondary && selected) {
      infoSecondary.textContent = formatMarchInfoCardSecondary(selected, now);
    }
    if (phaseEtaStripEl && selected) {
      phaseEtaStripEl.textContent = formatMarchIntelPhaseEtaStrip(selected, now);
    }
    const etaNodes = this.panel.querySelectorAll<HTMLElement>(
      `[data-role="${MARCH_ROW_RECENT_ETA_ROLE}"]`,
    );
    for (const el of etaNodes) {
      const id = Number(el.getAttribute("data-march-id"));
      if (Number.isNaN(id)) continue;
      const m = this.marches.find((row) => row.march_id === id);
      if (!m) continue;
      const brief = formatMarchRowRecentEtaBrief(m, now);
      if (brief) el.textContent = brief;
    }
  }

  private setSelectedMarchId(marchId: number | null): void {
    syncMinimapMarchFocusSession(marchId);
    const nextHighlight = resolveMarchHighlightOnRowSelect(
      marchId,
      this.highlightState,
      this.nowMs(),
    );
    if (nextHighlight !== this.highlightState) {
      if (nextHighlight == null) clearMarchHighlightSession();
      this.highlightState = nextHighlight;
      this.clearHighlightExpiryTimer();
      if (nextHighlight) this.scheduleHighlightExpiry();
    }
    this.selectedMarchId = marchId;
    this.renderList();
    const march = marchId != null ? this.marches.find((m) => m.march_id === marchId) ?? null : null;
    this.onSelectionChange?.(march);
  }

  private async refreshList(): Promise<void> {
    this.listError = "";
    this.listLoading = true;
    this.renderList();
    this.onStatus("拉取行军…");
    const cityId = this.getCityId();
    const prevSnapshot = this.lastListSnapshot;
    try {
      const res = (await this.gateway.listMarches(cityId, 20, 0)) as {
        marches?: MarchSummary[];
        total?: number;
      };
      const nextMarches = res.marches ?? [];
      this.pendingPhaseChangePulseIds = detectMarchPhaseChange(prevSnapshot, nextMarches);
      const reminders = detectNewMarchArrivalReminders(prevSnapshot, nextMarches, new Set());
      if (reminders.length) this.onMarchArrivalReminders?.(reminders);
      this.marches = nextMarches;
      this.lastListSnapshot = nextMarches.map((m) => ({ ...m }));
      this.onStatus(`行军 ${this.marches.length}/${res.total ?? 0} 条`);
      this.syncPollTimers();
    } catch (e) {
      this.marches = [];
      this.lastListSnapshot = [];
      this.listError = `加载失败：${(e as Error).message}`;
      this.onStatus(this.listError);
      this.stopPoll();
    }
    if (
      this.selectedMarchId != null &&
      !this.marches.some((m) => m.march_id === this.selectedMarchId)
    ) {
      this.selectedMarchId = null;
      this.onSelectionChange?.(null);
    }
    this.syncHighlightFromSession();
    this.tryRestoreMinimapMarchFocus();
    this.onMarchesUpdated?.(this.marches);
    this.listLoading = false;
    this.renderList();
  }

  /** 小地图 ListMarches 快照到达后恢复焦点（面板可未打开）。 */
  syncMinimapMarchFocusFromSnapshot(marches: MarchSummary[]): void {
    this.applyMinimapMarchFocusRestore(marches);
  }

  /** 会话内恢复小地图↔军情焦点（CLIENT-090）；不覆盖用户已选行。 */
  private tryRestoreMinimapMarchFocus(): void {
    this.applyMinimapMarchFocusRestore(this.marches);
  }

  private applyMinimapMarchFocusRestore(marches: MarchSummary[]): void {
    if (this.selectedMarchId != null) return;
    const id = readMinimapMarchFocusSession();
    if (id == null) return;
    if (!marches.some((m) => m.march_id === id)) {
      clearMinimapMarchFocusSession();
      return;
    }
    this.selectedMarchId = id;
    const march = marches.find((m) => m.march_id === id) ?? null;
    this.onSelectionChange?.(march);
  }

  private syncHighlightFromSession(): void {
    this.highlightState = readMarchHighlightSession(this.nowMs());
    this.clearHighlightExpiryTimer();
    if (this.highlightState) this.scheduleHighlightExpiry();
  }

  private scheduleHighlightExpiry(): void {
    this.clearHighlightExpiryTimer();
    if (!this.highlightState) return;
    const delay = remainingMarchHighlightMs(this.highlightState, this.nowMs());
    if (delay <= 0) {
      this.highlightState = null;
      clearMarchHighlightSession();
      return;
    }
    this.highlightExpiryTimer = setTimeout(() => {
      this.highlightExpiryTimer = null;
      this.highlightState = readMarchHighlightSession(this.nowMs());
      if (!this.highlightState) clearMarchHighlightSession();
      this.renderList();
    }, delay);
  }

  private clearHighlightExpiryTimer(): void {
    if (this.highlightExpiryTimer) {
      clearTimeout(this.highlightExpiryTimer);
      this.highlightExpiryTimer = null;
    }
  }

  private scrollHighlightedMarchIntoView(): void {
    if (!this.highlightState) return;
    const id = this.highlightState.march_id;
    const li = this.panel.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
    li?.scrollIntoView?.({ block: "nearest" });
  }

  private syncPollTimers(): void {
    if (!this.isOpen()) {
      this.stopPoll();
      return;
    }
    if (!marchNeedsPoll(this.marches)) {
      this.stopPoll();
      return;
    }
    if (!this.listPollTimer) this.startListPoll();
    if (!this.remainingTickTimer) this.startRemainingTick();
  }

  private startPoll(): void {
    if (!this.isOpen()) return;
    if (marchNeedsPoll(this.marches)) {
      if (!this.listPollTimer) this.startListPoll();
      if (!this.remainingTickTimer) this.startRemainingTick();
    }
  }

  private startListPoll(): void {
    if (this.listPollTimer) return;
    this.listPollTimer = setInterval(() => {
      if (!this.isOpen()) {
        this.stopPoll();
        return;
      }
      void this.refreshList();
    }, this.pollIntervalMs);
  }

  private startRemainingTick(): void {
    if (this.remainingTickTimer) return;
    this.remainingTickTimer = setInterval(() => {
      if (!this.isOpen()) {
        this.stopPoll();
        return;
      }
      if (!marchNeedsPoll(this.marches)) {
        this.stopRemainingTick();
        return;
      }
      this.updateRemainingLabels();
    }, MARCH_LIST_REMAINING_TICK_MS);
  }

  private stopRemainingTick(): void {
    if (this.remainingTickTimer) {
      clearInterval(this.remainingTickTimer);
      this.remainingTickTimer = null;
    }
  }

  private stopPoll(): void {
    if (this.listPollTimer) {
      clearInterval(this.listPollTimer);
      this.listPollTimer = null;
    }
    this.stopRemainingTick();
  }

  private setListFilter(next: MilitaryListFilterV1): void {
    if (
      next.phase === this.listFilter.phase &&
      next.etaSort === this.listFilter.etaSort
    ) {
      return;
    }
    this.listFilter = next;
    writeMilitaryListFilterSession(next);
    this.renderFilterControls();
    this.renderList();
  }

  private onFilterChange(ev: Event): void {
    const target = ev.target as HTMLElement;
    const sortSelect = target.closest('[data-action="march-eta-sort"]');
    if (!sortSelect) return;
    const root = this.panel.querySelector('[data-role="march-list-filter"]');
    const sortEl = root?.querySelector(
      '[data-action="march-eta-sort"]',
    ) as HTMLSelectElement | null;
    const etaSort = (sortEl?.value ?? this.listFilter.etaSort) as MilitaryListFilterV1["etaSort"];
    this.setListFilter({ ...this.listFilter, etaSort });
  }

  private onClick(ev: Event): void {
    const phaseChip = (ev.target as HTMLElement).closest('[data-action="march-phase-filter-chip"]');
    if (phaseChip) {
      const phase = parseMilitaryListPhaseChipPhase(phaseChip.getAttribute("data-phase"));
      if (phase) {
        const next = militaryListPhaseChipReducer(this.listFilter, { type: "select", phase });
        this.setListFilter(next);
      }
      return;
    }

    const infoCardBtn = (ev.target as HTMLElement).closest(
      `[data-action="${MARCH_INFO_CARD_OPEN_MILITARY_ACTION}"]`,
    );
    if (infoCardBtn) {
      ev.stopPropagation();
      const id = Number(infoCardBtn.getAttribute("data-march-id"));
      if (!Number.isNaN(id) && id > 0) {
        const march = this.marches.find((row) => row.march_id === id) ?? null;
        if (march) this.onOpenMilitaryFromInfoCard?.(march);
      }
      return;
    }

    const replayReportBtn = (ev.target as HTMLElement).closest(
      `[data-action="${MARCH_INFO_REPLAY_BATTLE_REPORT_ACTION}"]`,
    );
    if (replayReportBtn) {
      ev.stopPropagation();
      const march = this.getSelectedMarch();
      if (!march) return;
      const reportId = resolveBattleReportIdForMarchReplay(
        march,
        readBattleReportReplaySession(),
      );
      if (reportId != null) this.onReplayBattleReportFromInfoCard?.(march, reportId);
      return;
    }

    const toBannerBtn = (ev.target as HTMLElement).closest(
      `[data-action="${MARCH_INTEL_TO_QUEUE_BANNER_ACTION}"]`,
    );
    if (toBannerBtn) {
      ev.stopPropagation();
      const id = Number(toBannerBtn.getAttribute("data-march-id"));
      if (!Number.isNaN(id) && id > 0) this.onOpenMilitaryQueueBanner?.(id);
      return;
    }

    const infoViewDest = (ev.target as HTMLElement).closest('[data-action="march-info-view-dest"]');
    if (infoViewDest) {
      ev.stopPropagation();
      const march = this.getSelectedMarch();
      if (march) this.onViewMarchDestTile?.(march);
      return;
    }

    const infoRemarch = (ev.target as HTMLElement).closest('[data-action="march-info-remarch"]');
    if (infoRemarch) {
      ev.stopPropagation();
      const march = this.getSelectedMarch();
      if (march) this.onRemarchFromRow?.(march);
      return;
    }

    const infoCard = (ev.target as HTMLElement).closest('[data-role="march-info-card"]');
    if (infoCard && !(ev.target as HTMLElement).closest("button")) {
      const id = this.selectedMarchId;
      if (id != null) {
        const row = this.panel.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
        row?.scrollIntoView?.({ block: "nearest" });
        row?.classList.add(MARCH_ROW_SELECTED_CLASS);
        infoCard.classList.add(MARCH_ROW_SELECTED_CLASS);
      }
      return;
    }

    const remarchBtn = (ev.target as HTMLElement).closest('[data-action="march-remarch"]');
    if (remarchBtn) {
      ev.stopPropagation();
      const id = Number(remarchBtn.getAttribute("data-march-id"));
      if (!Number.isNaN(id)) {
        const march = this.marches.find((row) => row.march_id === id) ?? null;
        if (march) this.onRemarchFromRow?.(march);
      }
      return;
    }

    const filterRadio = (ev.target as HTMLElement).closest(
      'input[name="march-dest-filter"]',
    ) as HTMLInputElement | null;
    if (filterRadio) {
      const mode = filterRadio.value as MarchDestFilterMode;
      if (mode === "all" || mode === "world" || mode === "manual") {
        this.setDestFilterMode(mode);
      }
      return;
    }

    const row = (ev.target as HTMLElement).closest("li[data-march-id]");
    if (row) {
      const id = Number(row.getAttribute("data-march-id"));
      if (!Number.isNaN(id)) {
        if (id === this.selectedMarchId) {
          this.setSelectedMarchId(null);
        } else {
          this.setSelectedMarchId(id);
        }
        return;
      }
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "refresh-marches") void this.refreshList();
    if (btn.getAttribute("data-action") === "apply-march-dest-filter") {
      const root = this.panel.querySelector('[data-role="march-dest-filter"]');
      const x = Number((root?.querySelector('[data-field="filter-to-x"]') as HTMLInputElement)?.value);
      const y = Number((root?.querySelector('[data-field="filter-to-y"]') as HTMLInputElement)?.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        this.onStatus("请输入有效的目的格点坐标");
        return;
      }
      this.destFilterMode = "manual";
      this.manualDestFilter = { x, y };
      this.renderFilterControls();
      this.renderList();
    }
  }
}
