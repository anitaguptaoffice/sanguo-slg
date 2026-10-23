import type { GatewayPort } from "@/net/GatewayClient";
import {
  formatMarchLine,
  marchListLines,
  marchNeedsPoll,
  MARCH_LIST_POLL_MS,
  type MarchSummary,
} from "@/net/militaryFormat";

export type MarchListPanelOptions = {
  pollIntervalMs?: number;
};

export class MarchListPanel {
  private panel!: HTMLElement;
  private marches: MarchSummary[] = [];
  private listError = "";
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private readonly getCityId: () => number | undefined,
    private onStatus: (msg: string) => void,
    options?: MarchListPanelOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? MARCH_LIST_POLL_MS;
  }

  attach(): void {
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
  }

  detach(): void {
    this.stopPoll();
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

  /** 出征成功后由主城场景调用，面板打开时立即刷新列表。 */
  notifyMarchStarted(): void {
    if (!this.isOpen()) return;
    void this.refreshList();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>行军</h3>
      <p data-role="march-hint">military.v1.ListMarches；打开面板时每 ${this.pollIntervalMs / 1000}s 自动刷新进行中行军。</p>
      <button type="button" data-action="refresh-marches">刷新列表</button>
      <p class="report-panel-status" data-role="march-list-status"></p>
      <ul class="march-list" data-role="march-list"></ul>
    `;
    return el;
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="march-list"]');
    const statusEl = this.panel.querySelector('[data-role="march-list-status"]');
    if (!ul) return;

    if (statusEl) statusEl.textContent = this.listError;

    ul.innerHTML = "";
    if (this.listError) return;

    const lines = marchListLines(this.marches);
    if (!this.marches.length) {
      const li = document.createElement("li");
      li.textContent = lines[0];
      ul.appendChild(li);
      return;
    }

    for (const m of this.marches) {
      const li = document.createElement("li");
      li.textContent = formatMarchLine(m);
      ul.appendChild(li);
    }
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
      if (this.isOpen() && !marchNeedsPoll(this.marches)) {
        this.stopPoll();
      } else if (this.isOpen() && marchNeedsPoll(this.marches) && !this.pollTimer) {
        this.startPoll();
      }
    } catch (e) {
      this.marches = [];
      this.listError = `加载失败：${(e as Error).message}`;
      this.onStatus(this.listError);
    }
    this.renderList();
  }

  private startPoll(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.isOpen()) {
        this.stopPoll();
        return;
      }
      void this.refreshList();
    }, this.pollIntervalMs);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "refresh-marches") void this.refreshList();
  }
}
