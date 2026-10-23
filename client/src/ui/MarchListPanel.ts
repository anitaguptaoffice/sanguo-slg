import type { GatewayPort } from "@/net/GatewayClient";
import {
  formatMarchRowMetaLine,
  formatMarchRowPrimaryLine,
  marchNeedsPoll,
  MARCH_LIST_POLL_MS,
  MARCH_LIST_REMAINING_TICK_MS,
  type MarchSummary,
} from "@/net/militaryFormat";
import {
  marchListCompactClass,
  marchListEmptyClass,
  marchListEmptyMessage,
} from "@/net/panelDensity";
import {
  clearMarchHighlightSession,
  MARCH_ROW_RECENT_CLASS,
  readMarchHighlightSession,
  remainingMarchHighlightMs,
  resolveMarchHighlightOnRowSelect,
  type MarchHighlightState,
  writeMarchHighlightSession,
} from "@/net/marchHighlight";
import {
  filterMarchesByDestination,
  MARCH_LIST_ROW_DEST_MATCH_CLASS,
  type MarchDestFilterMode,
} from "@/ui/marchWorldListLink";
import { findFirstMarchByDest } from "@/ui/worldMinimap";

export type MarchListPanelOptions = {
  pollIntervalMs?: number;
  nowMs?: () => number;
  onMarchesUpdated?: (marches: MarchSummary[]) => void;
  onSelectionChange?: (march: MarchSummary | null) => void;
  /** CLIENT-061 世界列表当前选中格（「世界选中格」筛选）。 */
  getWorldSelectedGrid?: () => { x: number; y: number } | null;
};

export class MarchListPanel {
  private panel!: HTMLElement;
  private marches: MarchSummary[] = [];
  private listError = "";
  private listPollTimer: ReturnType<typeof setInterval> | null = null;
  private remainingTickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs: number;
  private readonly nowMs: () => number;
  private readonly onMarchesUpdated?: (marches: MarchSummary[]) => void;
  private readonly onSelectionChange?: (march: MarchSummary | null) => void;
  private readonly getWorldSelectedGrid?: () => { x: number; y: number } | null;
  private selectedMarchId: number | null = null;
  private destFilterMode: MarchDestFilterMode = "all";
  private manualDestFilter: { x: number; y: number } | null = null;
  private highlightState: MarchHighlightState | null = null;
  private highlightExpiryTimer: ReturnType<typeof setTimeout> | null = null;

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

  attach(): void {
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.renderFilterControls();
  }

  detach(): void {
    this.stopPoll();
    this.clearHighlightExpiryTimer();
    this.panel?.remove();
  }

  isOpen(): boolean {
    return this.panel != null && !this.panel.classList.contains("hidden");
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (this.isOpen()) {
      void this.refreshList();
      this.startPoll();
    } else {
      this.stopPoll();
    }
  }

  /** 出征成功后由主城场景调用：记住高亮 march_id，面板打开时立即刷新列表。 */
  notifyMarchStarted(marchId?: number | null): void {
    if (marchId != null && marchId > 0) {
      this.setRecentMarchHighlight(marchId);
    }
    if (!this.isOpen()) return;
    void this.refreshList();
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
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>行军</h3>
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
      <button type="button" data-action="refresh-marches">刷新列表</button>
      <p class="report-panel-status" data-role="march-list-status"></p>
      <ul class="march-list" data-role="march-list"></ul>
    `;
    return el;
  }

  private renderFilterControls(): void {
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
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="march-list"]');
    const statusEl = this.panel.querySelector('[data-role="march-list-status"]');
    if (!ul) return;

    if (statusEl) statusEl.textContent = this.listError;

    ul.innerHTML = "";
    ul.classList.remove(marchListCompactClass());

    if (this.listError) return;

    const filter = this.resolveDestFilter();
    const visible =
      filter != null
        ? filterMarchesByDestination(this.marches, filter.x, filter.y)
        : this.marches;

    if (this.destFilterMode === "world" && filter == null && this.marches.length) {
      const li = document.createElement("li");
      li.className = marchListEmptyClass();
      li.textContent = "请在「世界」面板点选城池格，或切换为「全部」/「手动格点」筛选";
      ul.appendChild(li);
      return;
    }

    if (filter != null && !visible.length && this.marches.length) {
      const li = document.createElement("li");
      li.className = marchListEmptyClass();
      li.textContent = `格点 (${filter.x},${filter.y}) 暂无指向行军（共 ${this.marches.length} 条进行中）`;
      ul.appendChild(li);
      return;
    }

    if (!visible.length) {
      const li = document.createElement("li");
      li.className = marchListEmptyClass();
      li.textContent = marchListEmptyMessage();
      ul.appendChild(li);
      return;
    }

    if (visible.length >= 2) {
      ul.classList.add(marchListCompactClass());
    }

    const now = this.nowMs();
    for (const m of visible) {
      const li = document.createElement("li");
      const body = document.createElement("div");
      body.className = "march-row-body";
      const primary = document.createElement("span");
      primary.className = "march-row-primary";
      primary.textContent = formatMarchRowPrimaryLine(m);
      const meta = document.createElement("span");
      meta.className = "march-row-meta";
      meta.setAttribute("data-role", "march-row-meta");
      meta.textContent = formatMarchRowMetaLine(m, now);
      body.appendChild(primary);
      body.appendChild(meta);
      li.appendChild(body);
      if (m.march_id != null) {
        li.setAttribute("data-march-id", String(m.march_id));
        meta.setAttribute("data-march-id", String(m.march_id));
        li.setAttribute("role", "button");
        li.tabIndex = 0;
      }
      if (m.march_id != null && m.march_id === this.selectedMarchId) {
        li.classList.add("march-list-row-selected");
      }
      if (filter != null) {
        li.classList.add(MARCH_LIST_ROW_DEST_MATCH_CLASS);
      }
      if (
        m.march_id != null &&
        this.highlightState &&
        m.march_id === this.highlightState.march_id
      ) {
        li.classList.add(MARCH_ROW_RECENT_CLASS);
      }
      ul.appendChild(li);
    }
  }

  private updateRemainingLabels(): void {
    const now = this.nowMs();
    const nodes = this.panel.querySelectorAll<HTMLElement>('[data-role="march-row-meta"]');
    for (const el of nodes) {
      const id = Number(el.getAttribute("data-march-id"));
      if (Number.isNaN(id)) continue;
      const m = this.marches.find((row) => row.march_id === id);
      if (!m) continue;
      el.textContent = formatMarchRowMetaLine(m, now);
    }
  }

  private setSelectedMarchId(marchId: number | null): void {
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
    this.onStatus("拉取行军…");
    const cityId = this.getCityId();
    try {
      const res = (await this.gateway.listMarches(cityId, 20, 0)) as {
        marches?: MarchSummary[];
        total?: number;
      };
      this.marches = res.marches ?? [];
      this.onStatus(`行军 ${this.marches.length}/${res.total ?? 0} 条`);
      this.syncPollTimers();
    } catch (e) {
      this.marches = [];
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
    this.onMarchesUpdated?.(this.marches);
    this.renderList();
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

  private onClick(ev: Event): void {
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
