import type { CityBuilding, MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import { applyUseResult, bagStackQuantity } from "@/net/bagState";
import { formatUseConsumableEffectSummary, gatewayErrorMessage } from "@/net/contentFeedback";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { findBuildDailyQuestForBuilding } from "@/net/dailyQuestQueueMatch";
import { resetQueuePanelViewportScroll } from "@/ui/queuePanelScroll";
import {
  activeBuildingUpgrades,
  formatBuildingUpgradeQueueLine,
  formatQueuePanelOverviewBar,
  formatRecruitQueueLine,
  isRecruitQueueActive,
  mergeRecruitQueue,
  pruneFinishedRecruits,
  type RecruitQueueEntry,
} from "@/net/queueState";

export const QUEUE_DAILY_NEXT_BUTTON_LABEL = "日常：下一步";

export type QueuePanelReskin = (root: HTMLElement) => void;

/** 建造队列加速符（与 DATA-001 / content catalog item_cfg_id 2003 一致，勿新增 cfg）。 */
export const BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID = 2003;

const SPEEDUP_BUTTON_LABEL = "使用短促工符";

export class QueuePanels {
  private panel!: HTMLElement;
  private militarySection!: HTMLElement;
  private recruits: RecruitQueueEntry[] = [];
  private tickAccum = 0;
  private speedupBusy = false;
  private readonly completedRecruitIds = new Set<number>();

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private readonly getSession: () => MainCitySession | null,
    private readonly slotLabels: Record<string, string>,
    private readonly onStatus: (msg: string) => void,
    private readonly onAfterCityRefresh: () => void,
    private readonly onMilitarySync: () => void,
    private readonly getDailyChainRows?: () => DailyQuestRow[],
    private readonly onOpenDailyBuildQuest?: (questCfgId: number) => void,
    private readonly reskinPrimary?: QueuePanelReskin,
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

  getRoot(): HTMLElement {
    return this.panel;
  }

  getMilitarySectionRoot(): HTMLElement {
    return this.militarySection;
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (this.isOpen()) {
      resetQueuePanelViewportScroll(this.panel);
      this.tickAccum = 0;
      this.render();
      resetQueuePanelViewportScroll(this.panel);
    }
  }

  /** 打开队列面板（日常练兵/建造引导）。 */
  open(): void {
    this.panel.classList.remove("hidden");
    resetQueuePanelViewportScroll(this.panel);
    this.tickAccum = 0;
    this.render();
    resetQueuePanelViewportScroll(this.panel);
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
    el.dataset.centerPanel = "queue";
    el.innerHTML = `
      <h3>队列</h3>
      <p class="queue-panel-overview" data-role="queue-overview"></p>
      <p class="queue-panel-hint">内政升级与募兵排队（打开时每秒刷新）。进行中建造可使用短促工符加速。</p>
      <div class="content-panel-actions">
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-queue">刷新内政</button>
      </div>
      <div class="panel-scroll-body" data-role="queue-scroll">
        <ul class="queue-list" data-role="queue-build-list"></ul>
        <div class="queue-military-section hidden" data-role="queue-military-section">
          <p class="queue-military-heading">募兵队列</p>
          <ul class="queue-list" data-role="queue-recruit-list"></ul>
        </div>
      </div>
      <p class="queue-panel-status" data-role="queue-status"></p>
    `;
    this.militarySection = el.querySelector('[data-role="queue-military-section"]') as HTMLElement;
    return el;
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private buildings(): CityBuilding[] {
    return this.getSession()?.buildings ?? [];
  }

  private canUseBuildSpeedup(now: number): boolean {
    if (activeBuildingUpgrades(this.buildings(), now).length === 0) return false;
    const bag = this.getSession()?.bag ?? [];
    return bagStackQuantity(bag, BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID) >= 1;
  }

  private render(): void {
    const buildUl = this.panel.querySelector('[data-role="queue-build-list"]');
    const recruitUl = this.panel.querySelector('[data-role="queue-recruit-list"]');
    const overviewEl = this.panel.querySelector('[data-role="queue-overview"]');
    if (!buildUl || !recruitUl) return;
    const now = Date.now();
    this.recruits = pruneFinishedRecruits(this.recruits, now);
    if (overviewEl) {
      overviewEl.textContent = formatQueuePanelOverviewBar(this.buildings(), this.recruits, now);
    }
    const speedupEnabled = this.canUseBuildSpeedup(now) && !this.speedupBusy;
    const buildRows = activeBuildingUpgrades(this.buildings(), now);
    const recruitLines = this.recruits.map((r) => formatRecruitQueueLine(r, now));

    buildUl.innerHTML = "";
    recruitUl.innerHTML = "";
    this.militarySection.classList.toggle("hidden", recruitLines.length === 0);

    if (!buildRows.length && !recruitLines.length) {
      const li = document.createElement("li");
      li.textContent = "（当前无排队中的升级或募兵）";
      buildUl.appendChild(li);
      return;
    }

    if (!buildRows.length) {
      const li = document.createElement("li");
      li.textContent = "（当前无排队中的内政升级）";
      buildUl.appendChild(li);
    }

    const dailyRows = this.getDailyChainRows?.() ?? [];

    for (const b of buildRows) {
      const text = formatBuildingUpgradeQueueLine(b, this.slotLabels, now);
      const li = document.createElement("li");
      li.className = "queue-list-row";
      const span = document.createElement("span");
      span.textContent = text;
      li.appendChild(span);
      const linkedQuest = findBuildDailyQuestForBuilding(b, dailyRows, now);
      if (linkedQuest && this.onOpenDailyBuildQuest) {
        const cfgId = linkedQuest.quest_cfg_id ?? 0;
        const dailyBtn = document.createElement("button");
        dailyBtn.type = "button";
        dailyBtn.setAttribute("data-action", "daily-build-next");
        if (cfgId > 0) dailyBtn.setAttribute("data-quest-cfg-id", String(cfgId));
        dailyBtn.textContent = QUEUE_DAILY_NEXT_BUTTON_LABEL;
        li.appendChild(dailyBtn);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "art-btn-primary";
      btn.setAttribute("data-action", "speedup-build");
      btn.textContent = SPEEDUP_BUTTON_LABEL;
      if (!speedupEnabled) {
        btn.disabled = true;
        if (bagStackQuantity(this.getSession()?.bag ?? [], BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID) < 1) {
          btn.title = "背包中无短促工符（道具 2003）";
        }
      }
      li.appendChild(btn);
      buildUl.appendChild(li);
    }

    for (const text of recruitLines) {
      const li = document.createElement("li");
      li.className = "queue-list-row";
      const span = document.createElement("span");
      span.textContent = text;
      li.appendChild(span);
      recruitUl.appendChild(li);
    }
    this.reskinPrimary?.(this.panel);
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
        wallet?: MainCitySession["wallet"];
        production_rates?: MainCitySession["productionRates"];
      };
      if (state.buildings) session.buildings = state.buildings;
      if (state.wallet) session.wallet = state.wallet;
      if (state.production_rates) session.productionRates = state.production_rates;
      this.onAfterCityRefresh();
      this.render();
    } catch {
      /* ignore */
    }
  }

  private async useBuildSpeedup(): Promise<void> {
    const now = Date.now();
    if (!this.canUseBuildSpeedup(now)) {
      const msg =
        activeBuildingUpgrades(this.buildings(), now).length === 0
          ? "当前无进行中的建造，无法使用短促工符"
          : "背包中短促工符不足（需要道具 2003×1）";
      this.setPanelStatus(msg);
      this.onStatus(msg);
      return;
    }
    const sid = this.serverId();
    const itemId = BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID;
    this.speedupBusy = true;
    this.render();
    this.onStatus(`队列：${SPEEDUP_BUTTON_LABEL}…`);
    try {
      const res = (await this.gateway.useConsumable(sid, itemId, 1)) as {
        remaining?: number;
        effect_summary?: string;
        speedup_seconds?: number;
      };
      const session = this.getSession();
      if (session) {
        session.bag = applyUseResult(session.bag, itemId, res.remaining ?? 0);
      }
      const summary = formatUseConsumableEffectSummary(itemId, res);
      this.setPanelStatus(summary);
      this.onStatus(summary);
      await this.refreshCityState();
    } catch (e) {
      const msg = gatewayErrorMessage(e);
      this.setPanelStatus(msg);
      this.onStatus(msg);
    } finally {
      this.speedupBusy = false;
      this.render();
    }
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "refresh-queue") {
      void this.refreshCityState().then(() => this.setPanelStatus("已刷新内政状态"));
    } else if (action === "speedup-build") {
      void this.useBuildSpeedup();
    } else if (action === "daily-build-next") {
      const cfgId = Number(btn.getAttribute("data-quest-cfg-id")) || 0;
      if (cfgId > 0 && this.onOpenDailyBuildQuest) {
        this.onOpenDailyBuildQuest(cfgId);
      }
    }
  }
}
