import type { Scene, SceneContext } from "@/engine/SceneManager";
import type { CityBuilding, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";

const SLOT_LABEL: Record<string, string> = {
  hall: "城主府",
  farm: "农田",
  lumber: "伐木场",
  quarry: "采石场",
  iron: "铁矿",
  barracks: "兵营",
  wall: "城墙",
};

export class MainCityScene implements Scene {
  readonly name = "mainCity";
  private session: MainCitySession | null = null;
  private hud!: HTMLElement;
  private toolbar!: HTMLElement;
  private gateway!: SceneContext["gateway"];
  private status = "";

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
    `;
    ctx.canvas.parentElement?.appendChild(this.toolbar);
    this.toolbar.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "upgrade-farm") void this.upgradeFarm();
      if (action === "refresh") void this.refreshState();
    });
  }

  leave(): void {
    this.toolbar?.remove();
  }

  private renderHud(): void {
    const s = this.session;
    const w = s?.wallet ?? {};
    const p = s?.player;
    this.hud.textContent =
      `${s?.cityName ?? "主城"} · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1} · ` +
      `粮 ${w.food ?? 0} 木 ${w.wood ?? 0} 铁 ${w.iron ?? 0} 石 ${w.stone ?? 0}` +
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
  }
}
