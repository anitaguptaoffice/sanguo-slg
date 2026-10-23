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
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { BattleReportPanel } from "@/ui/BattleReportPanel";
import { DailyQuestPanels } from "@/ui/DailyQuestPanels";
import {
  formatMarchHint,
  formatTimeMs,
  formatTroopStacks,
  mergeCityTroops,
  unitLabel,
  type MarchSummary,
} from "@/net/militaryFormat";
import {
  formatKeyBuildingHudLine,
  formatResourceAmount,
  formatResourceHudGroup,
  formatSlotBuildingCaption,
  hasActiveBuildingUpgrade,
  KEY_BUILDING_SLOTS,
} from "@/net/hudFormat";

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
  private gateway!: SceneContext["gateway"];
  private status = "";
  private lastMarch: MarchSummary | null = null;
  private social!: SocialPanels;
  private content!: ContentPanels;
  private heroMail!: HeroMailPanels;
  private battleReports!: BattleReportPanel;
  private dailyQuest!: DailyQuestPanels;
  private assets!: AssetLoader;
  private getViewport!: () => LayoutViewport;
  private canvas!: HTMLCanvasElement;
  private hitDebug = "";
  private hudRefreshAccum = 0;
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
      <button type="button" data-action="toggle-reports">战报</button>
      <button type="button" data-action="toggle-chat">聊天</button>
      <button type="button" data-action="toggle-guild">军团</button>
      <button type="button" data-action="toggle-rank">排行</button>
      <button type="button" data-action="toggle-quest">任务</button>
      <button type="button" data-action="toggle-daily">日常</button>
      <button type="button" data-action="toggle-bag">背包</button>
      <button type="button" data-action="toggle-shop">商城</button>
      <button type="button" data-action="toggle-hero">将领</button>
      <button type="button" data-action="toggle-mail">邮件</button>
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
    `;
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
    this.heroMail = new HeroMailPanels(
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
    this.heroMail.attach();
    this.battleReports = new BattleReportPanel(parent, this.gateway, (msg) => {
      this.status = msg;
      this.renderHud();
    });
    this.battleReports.attach();
    this.dailyQuest = new DailyQuestPanels(
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
    this.dailyQuest.attach();
    skinPrimaryButtons(this.toolbar, this.assets);
    skinNineSlicePanel(this.militaryPanel, this.assets, 420, 320);
    this.toolbar.addEventListener("click", (ev) => this.onToolbarClick(ev));
    this.militaryPanel.addEventListener("click", (ev) => this.onMilitaryClick(ev));
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerBound);
    this.syncMilitaryPanel();
  }

  update(dt: number): void {
    if (!this.session || !hasActiveBuildingUpgrade(this.session.buildings)) {
      this.hudRefreshAccum = 0;
      return;
    }
    this.hudRefreshAccum += dt;
    if (this.hudRefreshAccum >= 1) {
      this.hudRefreshAccum = 0;
      this.renderHud();
    }
  }

  leave(): void {
    this.canvas?.removeEventListener("pointerdown", this.onCanvasPointerBound);
    this.social?.detach();
    this.content?.detach();
    this.heroMail?.detach();
    this.battleReports?.detach();
    this.dailyQuest?.detach();
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
    if (action === "toggle-reports") this.battleReports.toggle();
    if (action === "toggle-chat") this.social.toggleChat();
    if (action === "toggle-guild") this.social.toggleGuild();
    if (action === "toggle-rank") this.social.toggleRank();
    if (action === "toggle-quest") this.content.toggleQuest();
    if (action === "toggle-daily") this.dailyQuest.toggle();
    if (action === "toggle-bag") this.content.toggleBag();
    if (action === "toggle-shop") this.content.toggleShop();
    if (action === "toggle-hero") this.heroMail.toggleHero();
    if (action === "toggle-mail") this.heroMail.toggleMail();
  }

  private onMilitaryClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "recruit") void this.recruit();
    if (action === "march") void this.startMarch();
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
    const now = Date.now();
    const p = s?.player;
    const troopHint = formatTroopStacks(s?.cityTroops);
    const dprTag = `art ${this.assets.getTextureScale()}× @${this.assets.getDevicePixelRatio().toFixed(1)}dpr`;
    const groups: string[] = [
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1}`,
      formatResourceHudGroup(s?.wallet),
      formatKeyBuildingHudLine(s?.buildings, SLOT_LABEL, ["hall", "farm"], now),
    ];
    if (troopHint !== "无") groups.push(`兵 ${troopHint}`);
    if (this.hitDebug) groups.push(`点选 ${SLOT_LABEL[this.hitDebug] ?? this.hitDebug}`);
    groups.push(dprTag);
    if (this.status) groups.push(this.status);

    this.hud.replaceChildren();
    for (let i = 0; i < groups.length; i++) {
      const span = document.createElement("span");
      span.className = "hud-group";
      span.textContent = groups[i];
      this.hud.appendChild(span);
    }
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
    c2d.fillText(`粮 ${formatResourceAmount(w?.food)}`, 56, 34);

    c2d.restore();
  }

  private drawSlot(
    c2d: CanvasRenderingContext2D,
    slot: MainCitySlotDef,
    building?: CityBuilding,
  ): void {
    const assetId = slot.asset_id ?? `mc.building.${slot.slot_key}.v1`;
    const pack = this.assets.getImageForAsset(assetId);
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
    const now = Date.now();
    const caption = formatSlotBuildingCaption(
      slot.slot_key,
      slot.label,
      building,
      now,
    );
    if (KEY_BUILDING_SLOTS.has(slot.slot_key)) {
      c2d.fillStyle = "rgba(26, 20, 16, 0.72)";
      c2d.fillRect(display.x, display.y - 4, Math.min(display.w, 120), 22);
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "12px system-ui";
      c2d.fillText(caption.title, display.x + 6, display.y + 14);
    }
    if (building) {
      c2d.fillStyle = "#f5e6c8";
      c2d.font = "13px system-ui";
      c2d.fillText(caption.levelLine, display.x + 8, display.y + display.h - 12);
      if (caption.upgradeLine) {
        c2d.fillStyle = "#f0c674";
        c2d.font = "12px system-ui";
        c2d.fillText(caption.upgradeLine, display.x + display.w - 88, display.y + 20);
      }
    }
  }
}
