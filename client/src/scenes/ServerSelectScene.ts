import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { skinDefaultPanel } from "@/engine/artPanelSkin";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import { formatServerLine, parseGameServerInfo, type GameServerRow } from "@/net/socialFormat";

const DEFAULT_LOGIN = "demo";
const DEFAULT_PASSWORD = "demo123";

export class ServerSelectScene implements Scene {
  readonly name = "serverSelect";
  private hud!: HTMLElement;
  private panel!: HTMLElement;
  private servers: GameServerRow[] = [];
  private selectedId = 0;
  private status = "";

  async enter(ctx: SceneContext): Promise<void> {
    this.hud = ctx.hud;
    this.panel = document.createElement("div");
    this.panel.className = "server-select-panel";
    this.panel.innerHTML = `
      <h2>选择游戏服</h2>
      <p class="server-select-hint">账号 ${DEFAULT_LOGIN} · 选服后进入主城</p>
      <ul class="server-list" data-role="server-list"></ul>
      <button type="button" data-action="refresh-servers">刷新列表</button>
      <button type="button" class="art-btn-primary art-btn-primary-full" data-action="enter-game" disabled>进入游戏</button>
      <p class="server-select-status" data-role="status"></p>
    `;
    this.panel.classList.add("layout-overlay-center");
    ctx.layoutFrame.appendChild(this.panel);
    skinDefaultPanel(this.panel, ctx.assets, 560, 360);
    skinPrimaryButtons(this.panel, ctx.assets);
    this.panel.addEventListener("click", (ev) => this.onClick(ev, ctx));
    this.hud.textContent = "连接网关…";
    try {
      await ctx.gateway.connect();
      await this.loadServers(ctx.gateway);
    } catch (e) {
      this.status = `连接失败: ${(e as Error).message}`;
      this.syncPanel();
    }
  }

  leave(): void {
    this.panel?.remove();
  }

  private async loadServers(gateway: SceneContext["gateway"]): Promise<void> {
    this.status = "拉取服务器列表…";
    this.syncPanel();
    try {
      const res = (await gateway.listGameServers(1, 50)) as { servers?: unknown[] };
      const raw = res.servers ?? [];
      this.servers = raw.map((s) => parseGameServerInfo(s as Parameters<typeof parseGameServerInfo>[0]));
      if (!this.selectedId && this.servers[0]?.server_id) {
        this.selectedId = this.servers[0].server_id!;
      }
      this.status = `共 ${this.servers.length} 个服`;
    } catch (e) {
      this.status = (e as Error).message;
      this.servers = [{ server_id: 1, display_name: "S1", status: 1, online_count: 0, has_player: false }];
      this.selectedId = 1;
    }
    this.syncPanel();
  }

  private syncPanel(): void {
    const ul = this.panel.querySelector('[data-role="server-list"]');
    const statusEl = this.panel.querySelector('[data-role="status"]');
    const enterBtn = this.panel.querySelector('[data-action="enter-game"]') as HTMLButtonElement | null;
    if (ul) {
      ul.innerHTML = "";
      for (const s of this.servers) {
        const li = document.createElement("li");
        const id = s.server_id ?? 0;
        li.textContent = formatServerLine(s);
        li.dataset.serverId = String(id);
        if (id === this.selectedId) li.classList.add("selected");
        if (s.status === 0 || s.status === 3) li.classList.add("disabled");
        ul.appendChild(li);
      }
    }
    if (statusEl) statusEl.textContent = this.status;
    if (enterBtn) enterBtn.disabled = !this.selectedId;
    const hudBusy =
      /^(连接|拉取|进入服)/.test(this.status) || this.status.includes("失败");
    this.hud.textContent = hudBusy ? this.status : "请选择游戏服";
  }

  private onClick(ev: Event, ctx: SceneContext): void {
    const li = (ev.target as HTMLElement).closest("li[data-server-id]");
    if (li) {
      const id = Number(li.getAttribute("data-server-id"));
      if (!Number.isNaN(id)) {
        this.selectedId = id;
        this.syncPanel();
      }
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "refresh-servers") void this.loadServers(ctx.gateway);
    if (action === "enter-game") void this.enterGame(ctx);
  }

  private async enterGame(ctx: SceneContext): Promise<void> {
    if (!this.selectedId) return;
    this.status = `进入服 #${this.selectedId}…`;
    this.syncPanel();
    try {
      const session = await bootstrapMainCity(
        ctx.gateway,
        DEFAULT_LOGIN,
        DEFAULT_PASSWORD,
        this.selectedId,
      );
      await ctx.switchScene("mainCity", session);
    } catch (e) {
      this.status = `进服失败: ${(e as Error).message}`;
      this.syncPanel();
    }
  }
}
