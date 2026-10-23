import type { BattleReportUnreadSession } from "@/net/battleReportUnread";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  battleReportListLines,
  filterBattleReportsByOutcome,
  formatBattleReportDetail,
  formatBattleRoundLine,
  formatReportLine,
  type BattleReportDetailView,
  type BattleReportOutcomeFilter,
  type BattleReportSummary,
} from "@/net/militaryFormat";

const PAGE_LIMIT = 20;

export type BattleReportPanelOptions = {
  unreadSession?: BattleReportUnreadSession;
  onUnreadChange?: (count: number) => void;
};

export class BattleReportPanel {
  private panel!: HTMLElement;
  /** 已从服务端加载的完整列表（未按 outcome 筛选）。 */
  private reports: BattleReportSummary[] = [];
  private total = 0;
  private outcomeFilter: BattleReportOutcomeFilter = "all";
  private selectedReportId = 0;
  private detailText = "";
  private detailRounds: BattleReportDetailView["rounds"] = [];
  private listError = "";
  private detailError = "";
  private listLoading = false;
  private detailLoading = false;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private onStatus: (msg: string) => void,
    private readonly panelOpts?: BattleReportPanelOptions,
  ) {}

  attach(): void {
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

  toggle(): void {
    const wasHidden = this.panel.classList.contains("hidden");
    this.panel.classList.toggle("hidden");
    if (wasHidden && this.isOpen()) void this.openAndSyncUnread();
  }

  /** 行军结束提示等入口：打开列表并清零未读基线。 */
  openPanel(): void {
    this.panel.classList.remove("hidden");
    void this.openAndSyncUnread();
  }

  private async openAndSyncUnread(): Promise<void> {
    await this.refreshList();
    this.panelOpts?.unreadSession?.markPanelOpened(this.reports);
    this.panelOpts?.onUnreadChange?.(0);
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>战报</h3>
      <p data-role="report-hint">military.v1 战报列表；筛选仅在客户端生效，点击条目加载详情。</p>
      <div class="battle-report-filters" role="group" aria-label="战报结果筛选">
        <span>筛选：</span>
        <button type="button" data-action="filter-outcome" data-filter="all" class="active">全部</button>
        <button type="button" data-action="filter-outcome" data-filter="win">胜</button>
        <button type="button" data-action="filter-outcome" data-filter="loss">负</button>
        <button type="button" data-action="filter-outcome" data-filter="draw">平</button>
      </div>
      <button type="button" data-action="refresh-reports">刷新列表</button>
      <button type="button" data-action="load-more-reports" data-role="load-more" hidden>加载更多</button>
      <button type="button" data-action="retry-list" data-role="retry-list" hidden>重试加载列表</button>
      <p class="report-panel-status" data-role="report-list-status"></p>
      <ul class="battle-report-list" data-role="report-list"></ul>
      <p class="report-panel-status" data-role="report-detail-status"></p>
      <button type="button" data-action="retry-detail" data-role="retry-detail" hidden>重试加载详情</button>
      <div class="report-detail" data-role="report-detail"></div>
    `;
    return el;
  }

  private visibleReports(): BattleReportSummary[] {
    return filterBattleReportsByOutcome(this.reports, this.outcomeFilter);
  }

  private updateFilterButtons(): void {
    for (const btn of Array.from(
      this.panel.querySelectorAll<HTMLButtonElement>('[data-action="filter-outcome"]'),
    )) {
      const f = btn.getAttribute("data-filter") as BattleReportOutcomeFilter;
      btn.classList.toggle("active", f === this.outcomeFilter);
    }
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="report-list"]');
    const statusEl = this.panel.querySelector('[data-role="report-list-status"]');
    const loadMore = this.panel.querySelector('[data-role="load-more"]');
    const retryList = this.panel.querySelector('[data-role="retry-list"]');
    if (!ul) return;

    this.updateFilterButtons();

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
      const canMore = !this.listError && !this.listLoading && this.reports.length < this.total;
      (loadMore as HTMLElement).hidden = !canMore;
    }

    ul.innerHTML = "";
    if (this.listError || this.listLoading) {
      this.renderDetail();
      return;
    }

    const filtered = this.visibleReports();
    if (!this.reports.length) {
      const li = document.createElement("li");
      li.textContent = battleReportListLines([])[0];
      ul.appendChild(li);
      this.renderDetail();
      return;
    }

    if (!filtered.length) {
      const li = document.createElement("li");
      li.textContent = "（当前筛选下暂无战报，可切换「全部」或加载更多）";
      ul.appendChild(li);
      this.renderDetail();
      return;
    }

    for (const r of filtered) {
      const li = document.createElement("li");
      li.textContent = formatReportLine(r);
      const id = r.report_id ?? 0;
      if (id) {
        li.setAttribute("data-report-id", String(id));
        li.style.cursor = "pointer";
        if (id === this.selectedReportId) li.classList.add("selected");
      }
      ul.appendChild(li);
    }

    this.renderDetail();
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

    detailEl.textContent = "";
    if (!this.selectedReportId || this.detailLoading) return;
    if (this.detailError) return;

    const pre = document.createElement("pre");
    pre.textContent = this.detailText;
    detailEl.appendChild(pre);

    const rounds = this.detailRounds ?? [];
    if (rounds.length > 0) {
      const details = document.createElement("details");
      details.className = "report-rounds-collapse";
      const summary = document.createElement("summary");
      summary.textContent = `回合明细（${rounds.length} 回合，点击展开）`;
      details.appendChild(summary);
      const roundPre = document.createElement("pre");
      roundPre.textContent = rounds.map((r) => formatBattleRoundLine(r)).join("\n");
      details.appendChild(roundPre);
      detailEl.appendChild(details);
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
    if (this.listLoading || this.reports.length >= this.total) return;
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

  private setOutcomeFilter(filter: BattleReportOutcomeFilter): void {
    if (this.outcomeFilter === filter) return;
    this.outcomeFilter = filter;
    this.renderList();
  }

  private async openReport(reportId: number): Promise<void> {
    this.selectedReportId = reportId;
    this.detailError = "";
    this.detailText = "";
    this.detailRounds = [];
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
      this.detailText = formatBattleReportDetail(
        reportId,
        res.report?.summary,
        res.report?.detail,
      );
      this.detailRounds = res.report?.detail?.rounds ?? [];
      this.onStatus("战报已加载");
    } catch (e) {
      this.detailError = `详情加载失败：${(e as Error).message}`;
      this.detailText = "";
      this.detailRounds = [];
      this.onStatus(this.detailError);
    }
    this.detailLoading = false;
    this.renderList();
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
    }
  }
}
