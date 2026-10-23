import type { CityBuilding, MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  activeBuildingUpgrades,
  formatBuildingUpgradeQueueLine,
  formatRecruitQueueLine,
  isRecruitQueueActive,
  mergeRecruitQueue,
  pruneFinishedRecruits,
  type RecruitQueueEntry,
} from "@/net/queueState";

export class QueuePanels {
  private panel!: HTMLElement;
  private recruits: RecruitQueueEntry[] = [];
  private tickAccum = 0;
  private readonly completedRecruitIds = new Set<number>();

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private readonly getSession: () => MainCitySession | null,
    private readonly slotLabels: Record<string, string>,
    private readonly onStatus: (msg: string) => void,
    private readonly onAfterCityRefresh: () => void,
    private readonly onMilitarySync: () => void,
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
    return !!this.panel && !this.panel.classList.contains("hidden");
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (this.isOpen()) {
      this.tickAccum = 0;
      this.render();
    }
  }

  addRecruitEntry(entry: RecruitQueueEntry | null): void {
    if (!entry) return;
    this.recruits = mergeRecruitQueue(this.recruits, entry);
    if (this.isOpen()) this.render();
  }

  tick(dt: number): void {
    if (!this.isOpen()) {
      this.tickAccum = 0;
      return;
    }
    this.tickAccum += dt;
    if (this.tickAccum < 1) return;
    this.tickAccum = 0;
    this.render();
    void this.checkRecruitCompletions();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>队列</h3>
      <p class="queue-panel-hint">内政升级与募兵排队（打开时每秒刷新）。</p>
      <button type="button" data-action="refresh-queue">刷新内政</button>
      <ul class="queue-list" data-role="queue-list"></ul>
      <p class="queue-panel-status" data-role="queue-status"></p>
    `;
    return el;
  }

  private buildings(): CityBuilding[] {
    return this.getSession()?.buildings ?? [];
  }

  private render(): void {
    const ul = this.panel.querySelector('[data-role="queue-list"]');
    if (!ul) return;
    const now = Date.now();
    this.recruits = pruneFinishedRecruits(this.recruits, now);
    const lines: string[] = [];
    for (const b of activeBuildingUpgrades(this.buildings(), now)) {
      lines.push(formatBuildingUpgradeQueueLine(b, this.slotLabels, now));
    }
    for (const r of this.recruits) {
      lines.push(formatRecruitQueueLine(r, now));
    }
    ul.innerHTML = "";
    if (!lines.length) {
      const li = document.createElement("li");
      li.textContent = "（当前无排队中的升级或募兵）";
      ul.appendChild(li);
      return;
    }
    for (const text of lines) {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    }
  }

  private setPanelStatus(msg: string): void {
    const el = this.panel.querySelector('[data-role="queue-status"]');
    if (el) el.textContent = msg;
  }

  private async checkRecruitCompletions(): Promise<void> {
    const now = Date.now();
    for (const entry of this.recruits) {
      if (isRecruitQueueActive(entry, now)) continue;
      if (this.completedRecruitIds.has(entry.queue_id)) continue;
      this.completedRecruitIds.add(entry.queue_id);
      this.onStatus(`募兵 #${entry.queue_id} 已完成，请刷新军事兵力`);
      this.setPanelStatus("募兵已完成：可刷新内政并打开军事查看兵力。");
      this.onMilitarySync();
      await this.refreshCityState();
    }
  }

  private async refreshCityState(): Promise<void> {
    const session = this.getSession();
    if (!session) return;
    try {
      const state = (await this.gateway.getCityState(session.cityId)) as {
        buildings?: CityBuilding[];
      };
      if (state.buildings) session.buildings = state.buildings;
      this.onAfterCityRefresh();
      this.render();
    } catch {
      /* ignore */
    }
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "refresh-queue") {
      void this.refreshCityState().then(() => this.setPanelStatus("已刷新内政状态"));
    }
  }
}
