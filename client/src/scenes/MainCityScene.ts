import type { AssetLoader } from "@/engine/AssetLoader";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { skinNineSlicePanel } from "@/engine/artPanelSkin";
import { applyLayoutTransform, canvasToLayout, type LayoutViewport } from "@/engine/layoutViewport";
import {
  LAYOUT_FRAME,
  MAIN_CITY_SLOTS,
  STAGE_HEIGHT,
  STAGE_TOP_Y,
  TOOLBAR_TOP_Y,
  type MainCitySlotDef,
} from "@/engine/mainCitySlots";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, CityTroopStack, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { SocialPanels } from "@/ui/SocialPanels";
import { ContentPanels } from "@/ui/ContentPanels";
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
  private social!: SocialPanels;
  private content!: ContentPanels;
  private assets!: AssetLoader;
  private getViewport!: () => LayoutViewport;
  private canvas!: HTMLCanvasElement;
  private hitDebug = "";
  private readonly onCanvasPointerBound = (ev: PointerEvent) => this.onCanvasPointer(ev);

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.assets = ctx.assets;
    this.getViewport = ctx.getViewport;
    this.canvas = ctx.canvas;
    this.session = (data as MainCitySession) ?? null;
    this.hud = ctx.hud;
    this.gateway = ctx.gateway;
    this.renderHud();
    this.toolbar = document.createElement("div");
    this.toolbar.className = "main-city-toolbar layout-toolbar";
    this.toolbar.innerHTML = `
      <button type="button" data-action="upgrade-farm">升级农田</button>
      <button type="button" data-action="refresh">刷新状态</button>
      <button type="button" data-action="toggle-military">军事</button>
      <button type="button" data-action="toggle-chat">聊天</button>
      <button type="button" data-action="toggle-guild">军团</button>
      <button type="button" data-action="toggle-rank">排行</button>
      <button type="button" data-action="toggle-quest">任务</button>
      <button type="button" data-action="toggle-bag">背包</button>
      <button type="button" data-action="toggle-shop">商城</button>
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
    const parent = ctx.layoutFrame;
    parent.appendChild(this.toolbar);
    parent.appendChild(this.militaryPanel);
    this.social = new SocialPanels(
      parent,
      this.gateway,
      () => this.session,
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
    );
    this.social.attach();
    this.content = new ContentPanels(
      parent,
      this.gateway,
      () => this.session,
      (patch) => {
        if (!this.session) return;
        Object.assign(this.session, patch);
        this.renderHud();
      },
      (msg) => {
        this.status = msg;
        this.renderHud();
      },
    );
    this.content.attach();
    skinPrimaryButtons(this.toolbar, this.assets);
    skinNineSlicePanel(this.militaryPanel, this.assets, 420, 320);
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerBound);
    this.syncMilitaryPanel();
  }

  leave(): void {
    this.canvas?.removeEventListener("pointerdown", this.onCanvasPointerBound);
    this.social?.detach();
    this.content?.detach();
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
    if (action === "toggle-chat") this.social.toggleChat();
    if (action === "toggle-guild") this.social.toggleGuild();
    if (action === "toggle-rank") this.social.toggleRank();
    if (action === "toggle-quest") this.content.toggleQuest();
    if (action === "toggle-bag") this.content.toggleBag();
    if (action === "toggle-shop") this.content.toggleShop();
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

  private onCanvasPointer(ev: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = ev.clientX - rect.left;
    const cssY = ev.clientY - rect.top;
    const layout = canvasToLayout(cssX, cssY, this.getViewport());
    const hits = [...MAIN_CITY_SLOTS]
      .sort((a, b) => b.z - a.z)
      .filter((slot) => this.pointInRect(layout, slot.hit));
    const top = hits[0];
    if (!top) return;
    this.hitDebug = top.slot_key;
    if (top.slot_key === "farm") void this.upgradeFarm();
    else {
      this.status = `选中 ${SLOT_LABEL[top.slot_key] ?? top.slot_key}`;
      this.renderHud();
    }
  }

  private pointInRect(p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean {
    return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  }

  private renderHud(): void {
    const s = this.session;
    const w = s?.wallet ?? {};
    const p = s?.player;
    const troopHint = formatTroopStacks(s?.cityTroops);
    const dprTag = `art ${this.assets.getTextureScale()}× @${this.assets.getDevicePixelRatio().toFixed(1)}dpr`;
    this.hud.textContent =
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1} · ` +
      `粮 ${w.food ?? 0} 木 ${w.wood ?? 0} 铁 ${w.iron ?? 0} 石 ${w.stone ?? 0} 币 ${w.gold ?? 0}` +
      (troopHint !== "无" ? ` · 兵 ${troopHint}` : "") +
      (this.hitDebug ? ` · 点选 ${SLOT_LABEL[this.hitDebug] ?? this.hitDebug}` : "") +
      ` · ${dprTag}` +
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
    const vp = this.getViewport();
    c2d.save();
    applyLayoutTransform(c2d, vp);

    c2d.fillStyle = "rgba(26, 20, 16, 0.85)";
    c2d.fillRect(0, 0, LAYOUT_FRAME.w, STAGE_TOP_Y);
    c2d.fillStyle = "rgba(26, 20, 16, 0.92)";
    c2d.fillRect(0, TOOLBAR_TOP_Y, LAYOUT_FRAME.w, LAYOUT_FRAME.h - TOOLBAR_TOP_Y);

    const bg = this.assets.getImageForAsset("mc.bg.plateau.v1");
    if (bg) {
      c2d.drawImage(bg.img, 0, STAGE_TOP_Y, LAYOUT_FRAME.w, STAGE_HEIGHT);
    } else {
      c2d.fillStyle = "#3d5c3a";
      c2d.fillRect(0, STAGE_TOP_Y, LAYOUT_FRAME.w, STAGE_HEIGHT);
    }

    const buildingLevels = new Map(
      (this.session?.buildings ?? []).map((b) => [b.slot_key ?? "", b] as const),
    );
    const sorted = [...MAIN_CITY_SLOTS].sort((a, b) => a.z - b.z);
    for (const slot of sorted) {
      this.drawSlot(c2d, slot, buildingLevels.get(slot.slot_key));
    }

    const food = this.assets.getImageForAsset("res.icon.food.v1");
    if (food) {
      c2d.drawImage(food.img, 16, 12, 32, 32);
    }
    c2d.fillStyle = "#f5e6c8";
    c2d.font = "16px system-ui";
    const w = this.session?.wallet;
    c2d.fillText(`粮 ${w?.food ?? 0}`, 56, 34);

    c2d.restore();
  }

  private drawSlot(
    c2d: CanvasRenderingContext2D,
    slot: MainCitySlotDef,
    building?: CityBuilding,
  ): void {
    const assetId = slot.asset_id ?? `mc.building.${slot.slot_key}.v1`;
    const pack = slot.asset_id ? this.assets.getImageForAsset(assetId) : undefined;
    const { display, ground_anchor: ga } = slot;
    if (pack) {
      const anchor = pack.meta.anchor;
      const ax = pack.meta.anchor_unit === "normalized" ? anchor.x * display.w : anchor.x;
      const ay = pack.meta.anchor_unit === "normalized" ? anchor.y * display.h : anchor.y;
      const topX = display.x + ga.x - ax;
      const topY = display.y + ga.y - ay;
      c2d.drawImage(pack.img, topX, topY, display.w, display.h);
    } else {
      c2d.fillStyle = "rgba(42, 61, 40, 0.75)";
      c2d.fillRect(display.x, display.y, display.w, display.h);
      c2d.fillStyle = "#e8dcc8";
      c2d.font = "14px system-ui";
      c2d.fillText(slot.label, display.x + 8, display.y + 24);
    }
    if (building) {
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "13px system-ui";
      c2d.fillText(`Lv${building.level ?? 0}`, display.x + 8, display.y + display.h - 12);
      if (building.upgrade_finish_at_ms && building.upgrade_finish_at_ms > Date.now()) {
        c2d.fillStyle = "#f0c674";
        c2d.fillText("升级中", display.x + display.w - 56, display.y + 20);
      }
    }
  }
}
