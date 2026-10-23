import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
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
  formatDailyQuestLine,
  pickDefaultDailyQuest,
  type DailyQuestRow,
} from "@/net/dailyQuestState";
import { pickFirstDailyTodoQuestCfgId } from "@/net/hudTodoBadge";
import {
  formatDailyQuestNextStepHint,
  resolveDailyQuestNavAction,
  type DailyQuestNavAction,
} from "@/net/dailyQuestObjective";

type RewardBundle = {
  items?: { item_cfg_id?: number; quantity?: number }[];
  resources?: ResourceWallet;
};

export class DailyQuestPanels {
  private panel!: HTMLElement;
  private rows: DailyQuestRow[] = [];
  private selectedCfgId = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private readonly cityStateFetch?: CityStateFetch,
    private readonly onNavigate?: (action: DailyQuestNavAction) => void,
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

  getRoot(): HTMLElement {
    return this.panel;
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (!this.panel.classList.contains("hidden")) void this.refreshList();
  }

  /** 待办角标深链：打开并高亮 chain 400 首条可接/可领（cfg id 来自轮询快照）。 */
  openFromTodoBadge(preferredCfgId = 0): void {
    this.panel.classList.remove("hidden");
    void this.refreshList(preferredCfgId, "todo-badge").then(() => {
      const id = this.selectedCfgId;
      if (id > 0) {
        const row = this.panel.querySelector(`li[data-quest-cfg-id="${id}"]`);
        row?.scrollIntoView?.({ block: "nearest" });
      }
    });
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
    el.innerHTML = `
      <h3>日常</h3>
      <p data-role="daily-hint">chain ${DAILY_QUEST_CHAIN_ID}；接取后由服务端自动累积进度，无需手填上报。</p>
      <button type="button" data-action="refresh-daily">刷新列表</button>
      <button type="button" data-action="accept-daily">接取</button>
      <button type="button" data-action="claim-daily">领奖</button>
      <ul class="daily-quest-list" data-role="daily-list"></ul>
      <p class="daily-quest-next" data-role="daily-next" hidden></p>
      <button type="button" data-action="daily-go-next" hidden>前往下一步</button>
      <pre class="daily-quest-detail" data-role="daily-detail"></pre>
    `;
    return el;
  }

  private renderList(): void {
    const ul = this.panel.querySelector('[data-role="daily-list"]');
    const pre = this.panel.querySelector('[data-role="daily-detail"]');
    if (!ul) return;
    ul.innerHTML = "";
    if (!this.rows.length) {
      const li = document.createElement("li");
      li.textContent = "（暂无日常任务，请刷新或提升君主等级）";
      ul.appendChild(li);
    } else {
      for (const q of this.rows) {
        const li = document.createElement("li");
        const id = q.quest_cfg_id ?? 0;
        li.textContent = formatDailyQuestLine(q);
        if (id) {
          li.setAttribute("data-quest-cfg-id", String(id));
          if (id === this.selectedCfgId) li.classList.add("selected");
        }
        ul.appendChild(li);
      }
    }
    const selected = this.rows.find((r) => r.quest_cfg_id === this.selectedCfgId) ?? null;
    if (pre) pre.textContent = formatDailyQuestDetail(selected);
    this.renderNextStep(selected);
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
    pickMode: "default" | "todo-badge" = "default",
  ): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取日常…");
    try {
      const res = await this.gateway.listPlayerQuests(sid, {
        chainId: DAILY_QUEST_CHAIN_ID,
        includeCompleted: true,
      });
      this.rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
      let pick: DailyQuestRow | null = null;
      if (focusCfgId != null && focusCfgId > 0) {
        pick = this.rows.find((r) => r.quest_cfg_id === focusCfgId) ?? null;
      }
      if (!pick && pickMode === "todo-badge") {
        const todoId = pickFirstDailyTodoQuestCfgId(this.rows);
        if (todoId > 0) pick = this.rows.find((r) => r.quest_cfg_id === todoId) ?? null;
      }
      if (!pick) pick = pickDefaultDailyQuest(this.rows);
      if (pick?.quest_cfg_id) this.selectedCfgId = pick.quest_cfg_id;
      this.renderList();
      this.onStatus(`日常 ${this.rows.length} 条`);
    } catch (e) {
      this.onStatus((e as Error).message);
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
    this.onStatus(`领取日常 #${id}…`);
    try {
      const res = (await this.gateway.claimQuestReward(sid, id)) as {
        granted_rewards?: RewardBundle;
      };
      await this.syncBagAndWallet(res.granted_rewards);
      await this.refreshList();
      this.onStatus("日常奖励已领取");
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private onClick(ev: Event): void {
    const li = (ev.target as HTMLElement).closest("li[data-quest-cfg-id]");
    if (li) {
      this.selectedCfgId = Number(li.getAttribute("data-quest-cfg-id")) || 0;
      this.renderList();
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-daily") void this.refreshList();
    if (a === "accept-daily") void this.acceptDaily();
    if (a === "claim-daily") void this.claimDaily();
    if (a === "daily-go-next") this.goNextStep();
  }
}
