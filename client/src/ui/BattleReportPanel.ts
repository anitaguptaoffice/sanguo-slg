import type { GatewayPort } from "@/net/GatewayClient";
import {
  battleReportListLines,
  formatBattleReportDetail,
  formatReportLine,
  type BattleReportSummary,
} from "@/net/militaryFormat";

export class BattleReportPanel {
  private panel!: HTMLElement;
  private reports: BattleReportSummary[] = [];
  private selectedReportId = 0;
  private detailText = "";
  private listError = "";
  private detailError = "";

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private onStatus: (msg: string) => void,
  ) {}

  attach(): void {
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
  }

  detach(): void {
    this.panel?.remove();
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (!this.panel.classList.contains("hidden")) void this.refreshList();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>战报</h3>
      <p data-role="report-hint">military.v1 战报列表；点击条目加载详情。</p>
      <button type="button" data-action="refresh-reports">刷新列表</button>
      <p class="report-panel-status" data-role="report-list-status"></p>
      <ul class="battle-report-list" data-role="report-list"></ul>
      <p class="report-panel-status" data-role="report-detail-status"></p>
      <pre class="report-detail" data-role="report-detail"></pre>
    `;
    return el;
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="report-list"]');
    const statusEl = this.panel.querySelector('[data-role="report-list-status"]');
    const detailPre = this.panel.querySelector('[data-role="report-detail"]');
    const detailStatus = this.panel.querySelector('[data-role="report-detail-status"]');
    if (!ul) return;

    if (statusEl) {
      statusEl.textContent = this.listError;
    }

    ul.innerHTML = "";
    if (this.listError) {
      return;
    }

    const lines = battleReportListLines(this.reports);
    if (!this.reports.length) {
      const li = document.createElement("li");
      li.textContent = lines[0];
      ul.appendChild(li);
      return;
    }

    for (const r of this.reports) {
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

    if (detailPre) detailPre.textContent = this.detailText;
    if (detailStatus) detailStatus.textContent = this.detailError;
  }

  private async refreshList(): Promise<void> {
    this.listError = "";
    this.onStatus("拉取战报…");
    try {
      const res = (await this.gateway.listBattleReports(20, 0)) as {
        reports?: BattleReportSummary[];
        total?: number;
      };
      this.reports = res.reports ?? [];
      this.onStatus(`战报 ${this.reports.length}/${res.total ?? 0} 条`);
    } catch (e) {
      this.reports = [];
      this.listError = `加载失败：${(e as Error).message}`;
      this.onStatus(this.listError);
    }
    this.renderList();
  }

  private async openReport(reportId: number): Promise<void> {
    this.selectedReportId = reportId;
    this.detailError = "";
    this.detailText = "";
    this.onStatus(`战报 #${reportId}…`);
    this.renderList();
    try {
      const res = (await this.gateway.getBattleReport(reportId)) as {
        report?: {
          summary?: BattleReportSummary;
          detail?: {
            result?: string;
            rounds?: { round?: number }[];
            attacker_casualties?: Record<string, number>;
            defender_casualties?: Record<string, number>;
          };
        };
      };
      this.detailText = formatBattleReportDetail(
        reportId,
        res.report?.summary,
        res.report?.detail,
      );
      this.onStatus("战报已加载");
    } catch (e) {
      this.detailError = `详情加载失败：${(e as Error).message}`;
      this.detailText = "";
      this.onStatus(this.detailError);
    }
    this.renderList();
  }

  private onClick(ev: Event): void {
    const li = (ev.target as HTMLElement).closest("li[data-report-id]");
    if (li) {
      const id = Number(li.getAttribute("data-report-id"));
      if (id) void this.openReport(id);
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "refresh-reports") void this.refreshList();
  }
}
