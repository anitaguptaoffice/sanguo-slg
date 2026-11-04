import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { skinDefaultPanel } from "@/engine/artPanelSkin";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import { formatServerLine, parseGameServerInfo, type GameServerRow } from "@/net/socialFormat";
import { createOverlayFocusTrap, type OverlayFocusTrap } from "@/ui/overlayFocusTrap";

const DEFAULT_LOGIN = "demo";
const DEFAULT_PASSWORD = "demo123";

export class ServerSelectScene implements Scene {
  readonly name = "serverSelect";
  private hud!: HTMLElement;
  private panel!: HTMLElement;
  private servers: GameServerRow[] = [];
  private selectedId = 0;
  private status = "";
  private lifecycle = 0;
  private active = false;
  private listBusy = false;
  private entering = false;
  private hudStatusEl: HTMLElement | null = null;
  private triggerBtn: HTMLButtonElement | null = null;
  private focusTrap: OverlayFocusTrap | null = null;

  async enter(ctx: SceneContext): Promise<void> {
    const lifecycle = ++this.lifecycle;
    this.active = true;
    this.servers = [];
    this.selectedId = 0;
    this.listBusy = true;
    this.status = "连接网关…";
    this.hud = ctx.hud;
    this.mountHudChrome();
    this.panel = document.createElement("div");
    this.panel.className = "server-select-panel";
    this.panel.id = "server-select-overlay";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-labelledby", "server-select-title");
    this.panel.innerHTML = `
      <h2 id="server-select-title">选择游戏服</h2>
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
    this.triggerBtn = this.hud.querySelector<HTMLButtonElement>('[data-role="server-select-trigger"]');
    this.focusTrap = createOverlayFocusTrap({
      root: this.panel,
      trigger: this.triggerBtn,
      onClose: () => this.syncHudTriggerExpanded(),
    });
    this.triggerBtn?.addEventListener("click", () => this.togglePanel());
    this.focusTrap.open();
    this.syncHudTriggerExpanded();
    this.syncPanel();
    try {
      await ctx.gateway.connect();
      if (!this.isCurrent(lifecycle)) return;
      this.listBusy = false;
      await this.loadServers(ctx.gateway);
    } catch (e) {
      if (!this.isCurrent(lifecycle)) return;
      this.listBusy = false;
      this.status = `连接失败: ${(e as Error).message}`;
      this.syncPanel();
    }
  }

  leave(): void {
    this.active = false;
    this.lifecycle++;
    this.listBusy = false;
    this.focusTrap?.dispose();
    this.focusTrap = null;
    this.panel?.remove();
  }

  private mountHudChrome(): void {
    this.hud.innerHTML = `
      <button type="button" class="hud-server-select-trigger" data-role="server-select-trigger"
        aria-controls="server-select-overlay" aria-expanded="false">选服</button>
      <span class="hud-server-select-status" data-role="server-select-hud-status"></span>
    `;
    this.hudStatusEl = this.hud.querySelector('[data-role="server-select-hud-status"]');
  }

  private setHudStatus(text: string): void {
    if (this.hudStatusEl) this.hudStatusEl.textContent = text;
    else this.hud.textContent = text;
  }

  private syncHudTriggerExpanded(): void {
    const open = this.focusTrap?.isActive() ?? !this.panel?.classList.contains("hidden");
    this.triggerBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  private togglePanel(): void {
    if (!this.focusTrap) return;
    if (this.focusTrap.isActive()) this.focusTrap.close();
    else this.focusTrap.open();
    this.syncHudTriggerExpanded();
  }

  private isCurrent(lifecycle: number): boolean {
    return this.active && lifecycle === this.lifecycle;
  }

  private canEnter(server: GameServerRow): boolean {
    return Number.isInteger(server.server_id) && (server.server_id ?? 0) > 0 &&
      (server.status === 1 || server.status === 2);
  }

  private async loadServers(gateway: SceneContext["gateway"]): Promise<void> {
    if (!this.active || this.listBusy) return;
    const lifecycle = this.lifecycle;
    this.listBusy = true;
    this.status = "拉取服务器列表…";
    this.syncPanel();
    try {
      const res = (await gateway.listGameServers(1, 50)) as { servers?: unknown[] };
      if (!this.isCurrent(lifecycle)) return;
      const raw = res.servers ?? [];
      this.servers = raw.map((s) => parseGameServerInfo(s as Parameters<typeof parseGameServerInfo>[0]));
      if (!this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) {
        this.selectedId = this.servers.find(s => this.canEnter(s))?.server_id ?? 0;
      }
      this.status = `共 ${this.servers.length} 个服`;
    } catch (e) {
      if (!this.isCurrent(lifecycle)) return;
      this.status = `拉取失败: ${(e as Error).message}`;
      this.servers = [];
      this.selectedId = 0;
    }
    if (!this.isCurrent(lifecycle)) return;
    this.listBusy = false;
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
        if (id === this.selectedId && this.canEnter(s)) li.classList.add("selected");
        if (!this.canEnter(s) || this.listBusy || this.entering) li.classList.add("disabled");
        ul.appendChild(li);
      }
    }
    if (statusEl) statusEl.textContent = this.status;
    if (enterBtn) enterBtn.disabled = this.listBusy || this.entering ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s));
    const refreshBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="refresh-servers"]');
    if (refreshBtn) refreshBtn.disabled = this.listBusy || this.entering;
    const hudBusy =
      /^(连接|拉取|进入服)/.test(this.status) || this.status.includes("失败");
    this.setHudStatus(hudBusy ? this.status : "请选择游戏服");
  }

  private onClick(ev: Event, ctx: SceneContext): void {
    if (!this.active || this.listBusy || this.entering) return;
    const li = (ev.target as HTMLElement).closest("li[data-server-id]");
    if (li) {
      const id = Number(li.getAttribute("data-server-id"));
      if (this.servers.some(s => s.server_id === id && this.canEnter(s))) {
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
    if (!this.active || this.listBusy || this.entering ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) return;
    const lifecycle = this.lifecycle;
    const serverId = this.selectedId;
    this.entering = true;
    this.status = `进入服 #${this.selectedId}…`;
    this.syncPanel();
    try {
      const session = await bootstrapMainCity(
        ctx.gateway,
        DEFAULT_LOGIN,
        DEFAULT_PASSWORD,
        serverId,
      );
      if (!this.isCurrent(lifecycle)) return;
      await ctx.switchScene("mainCity", session);
    } catch (e) {
      if (!this.isCurrent(lifecycle)) return;
      this.status = `进服失败: ${(e as Error).message}`;
      this.syncPanel();
    } finally {
      // Leaving cannot cancel an already submitted bootstrap; keep it single-flight on re-entry.
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }
}
