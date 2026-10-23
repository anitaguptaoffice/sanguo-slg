import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, CityTroopStack, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import {
  formatMarchHint,
  formatReportLine,
  formatTimeMs,
  formatTroopStacks,
  mergeCityTroops,
  unitLabel,
  type BattleReportSummary,
  type MarchSummary,
} from "@/net/militaryFormat";

const SLOT_LABEL: Record<string, string> = {
  hall: "城主府",
  farm: "农田",
  lumber: "伐木场",
  quarry: "采石场",
  iron: "铁矿",
  barracks: "兵营",
  wall: "城墙",
};

const DEFAULT_MARCH_TARGET = { x: 5, y: 5 };
const PURPOSE_ATTACK = 1;

export class MainCityScene implements Scene {
  readonly name = "mainCity";
  private session: MainCitySession | null = null;
  private hud!: HTMLElement;
  private toolbar!: HTMLElement;
  private militaryPanel!: HTMLElement;
  private reportDetail!: HTMLElement;
  private gateway!: SceneContext["gateway"];
  private status = "";
  private lastMarch: MarchSummary | null = null;
  private reportLines: BattleReportSummary[] = [];
  private selectedReportText = "";

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.session = (data as MainCitySession) ?? null;
    this.hud = ctx.hud;
    this.gateway = ctx.gateway;
    this.renderHud();
    this.toolbar = document.createElement("div");
    this.toolbar.className = "main-city-toolbar";
    this.toolbar.innerHTML = `
      <button type="button" data-action="upgrade-farm">升级农田</button>
      <button type="button" data-action="refresh">刷新状态</button>
      <button type="button" data-action="toggle-military">军事</button>
    `;
    this.militaryPanel = document.createElement("div");
    this.militaryPanel.className = "military-panel hidden";
    this.militaryPanel.innerHTML = `
      <h3>军事</h3>
      <p class="military-troops" data-role="troops"></p>
      <label>募兵兵种
        <select data-field="unit">
          <option value="1">步兵</option>
          <option value="2">骑兵</option>
          <option value="3">弓兵</option>
          <option value="4">器械</option>
        </select>
      </label>
      <label>数量 <input type="number" data-field="recruit-count" min="1" value="20" /></label>
      <button type="button" data-action="recruit">募兵</button>
      <hr />
      <label>目标 X <input type="number" data-field="to-x" value="${DEFAULT_MARCH_TARGET.x}" /></label>
      <label>目标 Y <input type="number" data-field="to-y" value="${DEFAULT_MARCH_TARGET.y}" /></label>
      <label>出征步兵 <input type="number" data-field="march-count" min="1" value="50" /></label>
      <button type="button" data-action="march">出征攻击</button>
      <p class="military-march" data-role="march"></p>
      <hr />
      <button type="button" data-action="list-reports">刷新战报列表</button>
      <ul class="report-list" data-role="report-list"></ul>
      <pre class="report-detail" data-role="report-detail"></pre>
    `;
    this.reportDetail = this.militaryPanel.querySelector('[data-role="report-detail"]') as HTMLElement;
    const parent = ctx.canvas.parentElement;
    parent?.appendChild(this.toolbar);
    parent?.appendChild(this.militaryPanel);
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.syncMilitaryPanel();
  }

  leave(): void {
    this.toolbar?.remove();
    this.militaryPanel?.remove();
  }

  private onToolbarClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "upgrade-farm") void this.upgradeFarm();
    if (action === "refresh") void this.refreshState();
    if (action === "toggle-military") {
      this.militaryPanel.classList.toggle("hidden");
      this.syncMilitaryPanel();
    }
  }

  private onMilitaryClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    const li = (ev.target as HTMLElement).closest("li[data-report-id]");
    if (li) {
      const id = Number(li.getAttribute("data-report-id"));
      if (id) void this.openReport(id);
      return;
    }
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "recruit") void this.recruit();
    if (action === "march") void this.startMarch();
    if (action === "list-reports") void this.loadReports();
  }

  private field(name: string): HTMLInputElement | HTMLSelectElement | null {
    return this.militaryPanel.querySelector(`[data-field="${name}"]`);
  }

  private syncMilitaryPanel(): void {
    const troopsEl = this.militaryPanel.querySelector('[data-role="troops"]');
    const marchEl = this.militaryPanel.querySelector('[data-role="march"]');
    if (troopsEl) {
      troopsEl.textContent = `城内兵力：${formatTroopStacks(this.session?.cityTroops)}`;
    }
    if (marchEl) {
      marchEl.textContent = this.lastMarch ? formatMarchHint(this.lastMarch) : "暂无行军";
    }
    this.renderReportList();
    if (this.reportDetail) this.reportDetail.textContent = this.selectedReportText;
  }

  private renderReportList(): void {
    const ul = this.militaryPanel.querySelector('[data-role="report-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    for (const r of this.reportLines) {
      const li = document.createElement("li");
      li.setAttribute("data-report-id", String(r.report_id ?? 0));
      li.textContent = formatReportLine(r);
      ul.appendChild(li);
    }
  }

  private renderHud(): void {
    const s = this.session;
    const w = s?.wallet ?? {};
    const p = s?.player;
    const troopHint = formatTroopStacks(s?.cityTroops);
    this.hud.textContent =
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1} · ` +
      `粮 ${w.food ?? 0} 木 ${w.wood ?? 0} 铁 ${w.iron ?? 0} 石 ${w.stone ?? 0}` +
      (troopHint !== "无" ? ` · 兵 ${troopHint}` : "") +
      (this.status ? ` · ${this.status}` : "");
  }

  private async refreshState(): Promise<void> {
    if (!this.session) return;
    this.status = "刷新中…";
    this.renderHud();
    try {
      const state = (await this.gateway.getCityState(this.session.cityId)) as {
        wallet?: ResourceWallet;
        buildings?: CityBuilding[];
      };
      this.session.wallet = state.wallet ?? this.session.wallet;
      this.session.buildings = state.buildings ?? [];
      this.status = "已刷新";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private async upgradeFarm(): Promise<void> {
    if (!this.session) return;
    const farm = this.session.buildings.find((b) => b.slot_key === "farm");
    const cfgId = farm?.building_cfg_id ?? 2;
    this.status = "升级请求中…";
    this.renderHud();
    try {
      const res = (await this.gateway.startBuildingUpgrade(this.session.cityId, "farm", cfgId)) as {
        wallet?: ResourceWallet;
        building?: CityBuilding;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      if (res.building) {
        const idx = this.session.buildings.findIndex((b) => b.slot_key === "farm");
        if (idx >= 0) this.session.buildings[idx] = res.building;
        else this.session.buildings.push(res.building);
      }
      await this.refreshState();
      this.status = "农田已排队升级";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
  }

  private async recruit(): Promise<void> {
    if (!this.session) return;
    const unitCfgId = Number((this.field("unit") as HTMLSelectElement)?.value ?? 1);
    const count = Number((this.field("recruit-count") as HTMLInputElement)?.value ?? 1);
    this.status = `募兵 ${unitLabel(unitCfgId)}×${count}…`;
    this.renderHud();
    try {
      const res = (await this.gateway.recruitTroop(this.session.cityId, unitCfgId, count)) as {
        wallet?: ResourceWallet;
        troop?: CityTroopStack;
        queue_id?: number;
        finish_at_ms?: number;
      };
      if (res.wallet) this.session.wallet = res.wallet;
      if (res.troop) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, [res.troop]);
      }
      const finish = res.finish_at_ms ? formatTimeMs(res.finish_at_ms) : "已完成";
      this.status = res.queue_id
        ? `募兵排队 #${res.queue_id}，预计 ${finish}`
        : `募兵完成，${unitLabel(unitCfgId)} 当前 ${res.troop?.count ?? "?"}`;
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private async startMarch(): Promise<void> {
    if (!this.session) return;
    const toX = Number((this.field("to-x") as HTMLInputElement)?.value ?? DEFAULT_MARCH_TARGET.x);
    const toY = Number((this.field("to-y") as HTMLInputElement)?.value ?? DEFAULT_MARCH_TARGET.y);
    const marchCount = Number((this.field("march-count") as HTMLInputElement)?.value ?? 1);
    if (marchCount <= 0) {
      this.status = "出征数量须大于 0";
      this.renderHud();
      return;
    }
    const troops = [{ unit_cfg_id: 1, count: marchCount }];
    this.status = `向 (${toX},${toY}) 出征…`;
    this.renderHud();
    try {
      const res = (await this.gateway.startMarch(
        this.session.cityId,
        toX,
        toY,
        PURPOSE_ATTACK,
        troops.map((t) => ({ unit_cfg_id: t.unit_cfg_id ?? 1, count: t.count ?? 0 })),
      )) as { march?: MarchSummary; city_troops?: CityTroopStack[] };
      this.lastMarch = res.march ?? null;
      if (res.city_troops?.length) {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, res.city_troops);
      } else {
        this.session.cityTroops = mergeCityTroops(this.session.cityTroops, troops.map((t) => ({
          unit_cfg_id: t.unit_cfg_id,
          count: 0,
        })));
      }
      this.status = formatMarchHint(this.lastMarch ?? undefined) || "行军已出发";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private async loadReports(): Promise<void> {
    this.status = "拉取战报…";
    this.renderHud();
    try {
      const res = (await this.gateway.listBattleReports(20, 0)) as {
        reports?: BattleReportSummary[];
        total?: number;
      };
      this.reportLines = res.reports ?? [];
      this.status = `战报 ${this.reportLines.length}/${res.total ?? 0} 条`;
      this.selectedReportText = "";
    } catch (e) {
      this.status = (e as Error).message;
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  private async openReport(reportId: number): Promise<void> {
    this.status = `战报 #${reportId}…`;
    this.renderHud();
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
      const sum = res.report?.summary;
      const det = res.report?.detail;
      const rounds = det?.rounds?.length ?? 0;
      this.selectedReportText =
        `${sum ? formatReportLine(sum) : `#${reportId}`}\n` +
        `结果：${det?.result ?? "—"}\n` +
        `回合数：${rounds}\n` +
        `攻方伤亡：${JSON.stringify(det?.attacker_casualties ?? {})}\n` +
        `守方伤亡：${JSON.stringify(det?.defender_casualties ?? {})}\n` +
        `（明细字段随服务端 battle 输出；占位展示）`;
      this.status = "战报已加载";
    } catch (e) {
      this.status = (e as Error).message;
      this.selectedReportText = "";
    }
    this.renderHud();
    this.syncMilitaryPanel();
  }

  draw(c2d: CanvasRenderingContext2D): void {
    const w = c2d.canvas.width;
    const h = c2d.canvas.height;
    c2d.fillStyle = "#3d5c3a";
    c2d.fillRect(0, 0, w, h);
    c2d.fillStyle = "#5c4a32";
    c2d.fillRect(16, h - 160, w - 32, 136);
    c2d.fillStyle = "#f5e6c8";
    c2d.font = "18px system-ui";
    c2d.fillText("主城（占位美术）", 24, h - 128);
    c2d.font = "13px system-ui";
    c2d.fillStyle = "#c9b896";
    const p = this.session?.player;
    c2d.fillText(`战力 ${p?.power ?? 0}`, 24, h - 104);
    if (this.lastMarch?.march_id) {
      c2d.fillText(formatMarchHint(this.lastMarch).slice(0, 48), 24, h - 84);
    }

    const buildings = this.session?.buildings ?? [];
    let x = 24;
    const y = 48;
    for (const b of buildings) {
      const label = SLOT_LABEL[b.slot_key ?? ""] ?? b.slot_key ?? "?";
      c2d.fillStyle = "#2a3d28";
      c2d.fillRect(x, y, 100, 72);
      c2d.fillStyle = "#e8dcc8";
      c2d.font = "12px system-ui";
      c2d.fillText(label, x + 8, y + 24);
      c2d.fillText(`Lv${b.level ?? 0}`, x + 8, y + 44);
      if (b.upgrade_finish_at_ms && b.upgrade_finish_at_ms > Date.now()) {
        c2d.fillStyle = "#f0c674";
        c2d.fillText("升级中", x + 8, y + 60);
      }
      x += 112;
    }

    c2d.fillStyle = "#8fbc8f";
    c2d.fillRect(w - 56, 40, 40, 40);
    c2d.fillStyle = "#1a1410";
    c2d.font = "11px system-ui";
    c2d.fillText("M2", w - 50, 66);
    c2d.fillText("(5,5)", w - 54, 78);
  }
}
