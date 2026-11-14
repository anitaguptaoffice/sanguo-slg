import { GATEWAY_WS_URL } from "@/config";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import { skinDefaultPanel } from "@/engine/artPanelSkin";
import type { Scene, SceneContext } from "@/engine/SceneManager";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import { formatServerLine, parseGameServerInfo, type GameServerRow } from "@/net/socialFormat";
import { createOverlayFocusTrap, type OverlayFocusTrap } from "@/ui/overlayFocusTrap";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import { FirstCityController } from "@/net/firstCityController";
import {
  canOfferFirstCityContinue, canOfferFirstCitySubmit,
  runFirstCityContinueCommand, runFirstCitySubmitCommand,
} from "./firstCityServerSelectCommand";
import {
  canOfferFirstCityResult, runFirstCityResultCommand, suggestFirstCityResultCommandId,
} from "./firstCityServerSelectResult";
import {
  bindFirstCityActor,
  firstCityActorBindingDrifted,
  FIRST_CITY_STALE_ACTOR_NOTICE,
  type FirstCityActorBinding,
} from "./firstCityServerSelectActor";
import {
  permitsFirstCityV2Probe, runFirstCityDiscoverProbe, supportsFirstCityPersisted,
} from "./firstCityServerSelectEntry";
import { formatFirstCityCanonicalWinnerPanel } from "./firstCityServerSelectCanonicalWinner";
import { formatFirstCityLosingProposalsPanel } from "./firstCityServerSelectLosingProposal";
import { formatFirstCityLocalDraftPanel } from "./firstCityServerSelectLocalDraft";
import { formatFirstCityHeadConflictPanel } from "./firstCityServerSelectHeadConflict";
import { formatFirstCityIdContentConflictPanel } from "./firstCityServerSelectIdContentConflict";
import { formatFirstCityNotObservedPanel } from "./firstCityServerSelectNotObserved";
import { formatFirstCityTerminalReceiptPanel } from "./firstCityServerSelectTerminalReceipt";
import { formatFirstCityPendingIntakePanel } from "./firstCityServerSelectPendingIntake";
import { formatFirstCityDiscoveryEmptyPanel } from "./firstCityServerSelectDiscoveryEmpty";
import { formatFirstCityCommandOutcomePanel } from "./firstCityServerSelectCommandOutcome";
import { formatFirstCityAuthorizedScopePanel } from "./firstCityServerSelectAuthorizedScope";
import { formatFirstCityRetainedTemplatePanel } from "./firstCityServerSelectRetainedTemplate";
import { formatFirstCityHeadPredecessorPanel } from "./firstCityServerSelectHeadPredecessor";
import { formatFirstCityLegacyRouteBoundaryPanel } from "./firstCityServerSelectLegacyRouteBoundary";
import { formatFirstCityDurableHeadC1Panel } from "./firstCityServerSelectDurableHeadC1";
import { formatFirstCityLocalC1DivergencePanel } from "./firstCityServerSelectLocalC1Divergence";
import { formatFirstCityProposalFormBoundaryPanel } from "./firstCityServerSelectProposalFormBoundary";
import { formatFirstCitySubmitFormLocalBoundaryPanel } from "./firstCityServerSelectSubmitFormLocalBoundary";
import { formatFirstCityContinueLocalIntentBoundaryPanel } from "./firstCityServerSelectContinueLocalIntentBoundary";
import { formatFirstCitySubmitFormLocalIdBoundaryPanel } from "./firstCityServerSelectSubmitFormLocalIdBoundary";
import { formatFirstCitySubmitRejectedHeadBoundaryPanel } from "./firstCityServerSelectSubmitRejectedHeadBoundary";
import { formatFirstCitySubmitPendingHeadBoundaryPanel } from "./firstCityServerSelectSubmitPendingHeadBoundary";
import { formatFirstCitySubmitSucceededHeadBoundaryPanel } from "./firstCityServerSelectSubmitSucceededHeadBoundary";
import { formatFirstCitySubmitEmptyHeadBoundaryPanel } from "./firstCityServerSelectSubmitEmptyHeadBoundary";
import { formatFirstCityContinueRejectedHeadBoundaryPanel } from "./firstCityServerSelectContinueRejectedHeadBoundary";
import { formatFirstCityContinuePendingHeadBoundaryPanel } from "./firstCityServerSelectContinuePendingHeadBoundary";
import { formatFirstCityContinueSucceededHeadBoundaryPanel } from "./firstCityServerSelectContinueSucceededHeadBoundary";
import { formatFirstCityContinueEmptyHeadBoundaryPanel } from "./firstCityServerSelectContinueEmptyHeadBoundary";
import { formatFirstCityGetEmptyHeadBoundaryPanel } from "./firstCityServerSelectGetEmptyHeadBoundary";
import { formatFirstCityGetPendingHeadBoundaryPanel } from "./firstCityServerSelectGetPendingHeadBoundary";
import { formatFirstCityGetRejectedHeadBoundaryPanel } from "./firstCityServerSelectGetRejectedHeadBoundary";

export function permitsExistingAccountLogin(url: string): boolean {
  try {
    const target = new URL(url);
    return !target.username && !target.password && (target.protocol === "wss:" ||
      (target.protocol === "ws:" && ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)));
  } catch { return false; }
}

const DEFAULT_LOGIN = "demo";
const DEFAULT_PASSWORD = "demo123";
const REGISTER_UNKNOWN = "注册结果尚未确认，账号可能已创建；本页不会重复注册。可重新输入凭据并明确点击登录核实。首次建城尚未开放。";

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
  private connected = false;
  private connectionVersion = 0;
  private listVersion = 0;
  private entering = false;
  private registrationAttempted = false;
  private registrationNotice = "";
  private registrationView = 0;
  private hudStatusEl: HTMLElement | null = null;
  private triggerBtn: HTMLButtonElement | null = null;
  private focusTrap: OverlayFocusTrap | null = null;
  private gatewayRef: SceneContext["gateway"] | null = null;
  private firstCityProbeEligible = false;
  private firstCityProbeNotice = "";
  private firstCityProbeInFlight = false;
  private firstCityController: FirstCityController | null = null;
  private firstCityKnowledge: FirstCityKnowledge | null = null;
  private firstCityActorBinding: FirstCityActorBinding | null = null;

  async enter(ctx: SceneContext): Promise<void> {
    ++this.lifecycle;
    this.active = true;
    this.servers = [];
    this.selectedId = 0;
    this.listBusy = false;
    this.connected = false;
    this.gatewayRef = ctx.gateway;
    this.firstCityProbeEligible = false;
    this.firstCityProbeNotice = "";
    this.firstCityProbeInFlight = false;
    this.firstCityController = null;
    this.firstCityKnowledge = null;
    this.firstCityActorBinding = null;
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
      <p class="server-select-hint">演示账号 ${DEFAULT_LOGIN} 与个人账号分开进入</p>
      <ul class="server-list" data-role="server-list"></ul>
      <form data-role="existing-account" autocomplete="off">
        <p>登录已有账号仅进入已有城池。注册只创建账号，不会登录或建城；首次建城尚未开放。</p>
        <label>账号 <input name="login" autocomplete="off" required></label>
        <label>密码 <input name="password" type="password" autocomplete="off" required></label>
        <button type="submit" data-action="login-existing" disabled>登录已有账号</button>
        <button type="button" data-action="register-account" disabled>注册新账号（不建城）</button>
      </form>
      <p data-role="registration-status" role="status"></p>
      <section class="first-city-probe" data-role="first-city-probe" hidden>
        <p class="first-city-probe-hint">无城池账号可在本机开发网关下<strong>显式</strong>尝试 V2 意图发现；不调用 v1 建城、不进入主城。</p>
        <p class="first-city-legacy-route-boundary" data-role="first-city-legacy-route-boundary" role="status" hidden></p>
        <button type="button" data-action="discover-first-city" disabled>V2 首城意图发现（仅探测）</button>
        <p data-role="first-city-probe-status" role="status"></p>
        <p class="first-city-authorized-scope" data-role="first-city-authorized-scope" role="status" hidden></p>
        <p class="first-city-retained-template" data-role="first-city-retained-template" role="status" hidden></p>
        <p class="first-city-head-predecessor" data-role="first-city-head-predecessor" role="status" hidden></p>
        <p class="first-city-durable-head-c1" data-role="first-city-durable-head-c1" role="status" hidden></p>
        <p class="first-city-canonical-winner" data-role="first-city-canonical-winner" role="status" hidden></p>
        <p class="first-city-proposal-form-boundary" data-role="first-city-proposal-form-boundary" role="status" hidden></p>
        <p class="first-city-submit-form-local-boundary" data-role="first-city-submit-form-local-boundary" role="status" hidden></p>
        <p class="first-city-submit-form-local-id-boundary" data-role="first-city-submit-form-local-id-boundary" role="status" hidden></p>
        <p class="first-city-submit-rejected-head-boundary" data-role="first-city-submit-rejected-head-boundary" role="status" hidden></p>
        <p class="first-city-submit-pending-head-boundary" data-role="first-city-submit-pending-head-boundary" role="status" hidden></p>
        <p class="first-city-submit-succeeded-head-boundary" data-role="first-city-submit-succeeded-head-boundary" role="status" hidden></p>
        <p class="first-city-submit-empty-head-boundary" data-role="first-city-submit-empty-head-boundary" role="status" hidden></p>
        <p class="first-city-continue-rejected-head-boundary" data-role="first-city-continue-rejected-head-boundary" role="status" hidden></p>
        <p class="first-city-continue-pending-head-boundary" data-role="first-city-continue-pending-head-boundary" role="status" hidden></p>
        <p class="first-city-continue-succeeded-head-boundary" data-role="first-city-continue-succeeded-head-boundary" role="status" hidden></p>
        <p class="first-city-continue-empty-head-boundary" data-role="first-city-continue-empty-head-boundary" role="status" hidden></p>
        <p class="first-city-get-empty-head-boundary" data-role="first-city-get-empty-head-boundary" role="status" hidden></p>
        <p class="first-city-get-pending-head-boundary" data-role="first-city-get-pending-head-boundary" role="status" hidden></p>
        <p class="first-city-get-rejected-head-boundary" data-role="first-city-get-rejected-head-boundary" role="status" hidden></p>
        <p class="first-city-continue-local-intent-boundary" data-role="first-city-continue-local-intent-boundary" role="status" hidden></p>
        <p class="first-city-losing-proposal" data-role="first-city-losing-proposal" role="status" hidden></p>
        <p class="first-city-local-draft" data-role="first-city-local-draft" role="status" hidden></p>
        <p class="first-city-local-c1-divergence" data-role="first-city-local-c1-divergence" role="status" hidden></p>
        <p class="first-city-head-conflict" data-role="first-city-head-conflict" role="status" hidden></p>
        <p class="first-city-id-content-conflict" data-role="first-city-id-content-conflict" role="status" hidden></p>
        <p class="first-city-not-observed" data-role="first-city-not-observed" role="status" hidden></p>
        <p class="first-city-pending-intake" data-role="first-city-pending-intake" role="status" hidden></p>
        <p class="first-city-discovery-empty" data-role="first-city-discovery-empty" role="status" hidden></p>
        <p class="first-city-command-outcome" data-role="first-city-command-outcome" role="status" hidden></p>
        <p class="first-city-terminal-receipt" data-role="first-city-terminal-receipt" role="status" hidden></p>
        <div class="first-city-command" data-role="first-city-command" hidden>
          <label>城名 <input name="fc-name" maxlength="32" autocomplete="off"></label>
          <label>X <input name="fc-x" type="number" min="0" max="499" value="60" autocomplete="off"></label>
          <label>Y <input name="fc-y" type="number" min="0" max="499" value="60" autocomplete="off"></label>
          <button type="button" data-action="submit-first-city" disabled>显式 V2 Submit</button>
          <button type="button" data-action="continue-first-city" disabled>显式 V2 Continue</button>
          <label>commandId <input name="fc-command-id" maxlength="36" autocomplete="off" spellcheck="false"></label>
          <button type="button" data-action="get-first-city-result" disabled>显式 V2 GetResult</button>
        </div>
      </section>
      <button type="button" data-action="refresh-servers">刷新列表</button>
      <button type="button" class="art-btn-primary art-btn-primary-full" data-action="enter-game" disabled>进入演示账号</button>
      <p class="server-select-status" data-role="status"></p>
    `;
    this.panel.classList.add("layout-overlay-center");
    ctx.layoutFrame.appendChild(this.panel);
    skinDefaultPanel(this.panel, ctx.assets, 560, 360);
    skinPrimaryButtons(this.panel, ctx.assets);
    this.panel.addEventListener("click", (ev) => this.onClick(ev, ctx));
    this.panel.addEventListener("input", (ev) => {
      const target = ev.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.name === "login" && this.firstCityKnowledge &&
        this.firstCityActorBinding && target.value.trim() !== this.firstCityActorBinding.login) {
        this.clearFirstCityRetain();
        this.firstCityProbeNotice = FIRST_CITY_STALE_ACTOR_NOTICE;
      }
      this.syncPanel();
    });
    this.panel.querySelector("form")!.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void this.enterGame(ctx, true);
    });
    this.triggerBtn = this.hud.querySelector<HTMLButtonElement>('[data-role="server-select-trigger"]');
    this.focusTrap = createOverlayFocusTrap({
      root: this.panel,
      trigger: this.triggerBtn,
      onClose: () => {
        this.registrationView++;
        this.clearPassword();
        this.syncPanel();
        this.syncHudTriggerExpanded();
      },
    });
    this.triggerBtn?.addEventListener("click", () => this.togglePanel());
    this.focusTrap.open();
    this.syncHudTriggerExpanded();
    this.syncPanel();
    await this.loadServers(ctx.gateway);
  }

  leave(): void {
    this.active = false;
    this.lifecycle++;
    this.registrationView++;
    this.connectionVersion++;
    this.listVersion++;
    this.connected = false;
    this.listBusy = false;
    this.focusTrap?.dispose();
    this.focusTrap = null;
    this.clearPassword();
    this.gatewayRef = null;
    this.firstCityProbeEligible = false;
    this.firstCityProbeNotice = "";
    this.firstCityProbeInFlight = false;
    this.firstCityController = null;
    this.firstCityKnowledge = null;
    this.firstCityActorBinding = null;
    this.panel?.remove();
  }

  private clearFirstCityRetain(): void {
    this.firstCityController = null;
    this.firstCityKnowledge = null;
    this.firstCityActorBinding = null;
  }

  private firstCityStaleActor(login: string): boolean {
    if (!this.firstCityKnowledge) return false;
    return firstCityActorBindingDrifted(this.firstCityActorBinding, this.firstCityKnowledge, login, this.selectedId,
      this.gatewayRef?.getSessionGeneration?.());
  }

  private clearPassword(): void {
    const input = this.panel?.querySelector<HTMLInputElement>('input[name="password"]');
    if (input) input.value = "";
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

  private connectGateway(gateway: SceneContext["gateway"], lifecycle: number): Promise<void> {
    const version = ++this.connectionVersion;
    const current = () => this.isCurrent(lifecycle) && version === this.connectionVersion;
    return new Promise((resolve, reject) => {
      const interrupted = () => {
        if (current()) {
          this.connectionVersion++;
          this.listVersion++;
          this.connected = false;
          this.listBusy = false;
          this.servers = [];
          this.selectedId = 0;
          this.status = "连接已中断，请刷新列表重试";
          this.syncPanel();
        }
        // Gateway connect may remain pending if the socket closes before open.
        reject(new Error("gateway disconnected"));
      };
      gateway.connect({ onClose: interrupted, onError: interrupted }).then(() => {
        if (current()) this.connected = true;
        resolve();
      }, reject);
    });
  }

  private async loadServers(gateway: SceneContext["gateway"]): Promise<void> {
    if (!this.active || this.listBusy) return;
    const lifecycle = this.lifecycle;
    const version = ++this.listVersion;
    const current = () => this.isCurrent(lifecycle) && version === this.listVersion;
    this.listBusy = true;
    this.status = this.connected ? "拉取服务器列表…" : "连接网关…";
    this.syncPanel();
    try {
      if (!this.connected) await this.connectGateway(gateway, lifecycle);
      if (!current()) return;
      const res = (await gateway.listGameServers(1, 50)) as { servers?: unknown[] };
      if (!current()) return;
      const raw = res.servers ?? [];
      this.servers = raw.map((s) => parseGameServerInfo(s as Parameters<typeof parseGameServerInfo>[0]));
      if (!this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) {
        this.selectedId = this.servers.find(s => this.canEnter(s))?.server_id ?? 0;
      }
      this.status = `共 ${this.servers.length} 个服`;
    } catch (e) {
      if (!current()) return;
      this.status = `${this.connected ? "拉取" : "连接"}失败: ${(e as Error).message}`;
      this.servers = [];
      this.selectedId = 0;
    }
    if (!current()) return;
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
    this.panel.querySelector<HTMLElement>('[data-role="registration-status"]')!.textContent = this.registrationNotice;
    if (enterBtn) enterBtn.disabled = !this.connected || this.listBusy || this.entering ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s));
    const login = this.panel.querySelector<HTMLInputElement>('input[name="login"]')!;
    const password = this.panel.querySelector<HTMLInputElement>('input[name="password"]')!;
    login.disabled = password.disabled = this.entering;
    this.panel.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.disabled =
      !!enterBtn?.disabled || !login.value.trim() || !password.value;
    this.panel.querySelector<HTMLButtonElement>('[data-action="register-account"]')!.disabled =
      this.registrationAttempted || !this.connected || this.listBusy || this.entering || !login.value.trim() || !password.value;
    const refreshBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="refresh-servers"]');
    if (refreshBtn) refreshBtn.disabled = this.listBusy || this.entering;
    const probe = this.panel.querySelector<HTMLElement>('[data-role="first-city-probe"]');
    const legacyRouteBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-legacy-route-boundary"]');
    const probeBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]');
    const probeStatus = this.panel.querySelector<HTMLElement>('[data-role="first-city-probe-status"]');
    const authorizedScope = this.panel.querySelector<HTMLElement>('[data-role="first-city-authorized-scope"]');
    const retainedTemplate = this.panel.querySelector<HTMLElement>('[data-role="first-city-retained-template"]');
    const headPredecessor = this.panel.querySelector<HTMLElement>('[data-role="first-city-head-predecessor"]');
    const durableHeadC1 = this.panel.querySelector<HTMLElement>('[data-role="first-city-durable-head-c1"]');
    const canonicalWinner = this.panel.querySelector<HTMLElement>('[data-role="first-city-canonical-winner"]');
    const proposalFormBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-proposal-form-boundary"]');
    const submitFormLocalBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-form-local-boundary"]');
    const submitFormLocalIdBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-form-local-id-boundary"]');
    const submitRejectedHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-rejected-head-boundary"]');
    const submitPendingHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-pending-head-boundary"]');
    const submitSucceededHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-succeeded-head-boundary"]');
    const submitEmptyHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-submit-empty-head-boundary"]');
    const continueRejectedHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-continue-rejected-head-boundary"]');
    const continuePendingHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-continue-pending-head-boundary"]');
    const continueSucceededHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-continue-succeeded-head-boundary"]');
    const continueEmptyHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-continue-empty-head-boundary"]');
    const getEmptyHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-get-empty-head-boundary"]');
    const getPendingHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-get-pending-head-boundary"]');
    const getRejectedHeadBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-get-rejected-head-boundary"]');
    const continueLocalIntentBoundary = this.panel.querySelector<HTMLElement>('[data-role="first-city-continue-local-intent-boundary"]');
    const losingProposal = this.panel.querySelector<HTMLElement>('[data-role="first-city-losing-proposal"]');
    const localDraft = this.panel.querySelector<HTMLElement>('[data-role="first-city-local-draft"]');
    const localC1Divergence = this.panel.querySelector<HTMLElement>('[data-role="first-city-local-c1-divergence"]');
    const headConflict = this.panel.querySelector<HTMLElement>('[data-role="first-city-head-conflict"]');
    const idContentConflict = this.panel.querySelector<HTMLElement>('[data-role="first-city-id-content-conflict"]');
    const notObserved = this.panel.querySelector<HTMLElement>('[data-role="first-city-not-observed"]');
    const pendingIntake = this.panel.querySelector<HTMLElement>('[data-role="first-city-pending-intake"]');
    const discoveryEmpty = this.panel.querySelector<HTMLElement>('[data-role="first-city-discovery-empty"]');
    const commandOutcome = this.panel.querySelector<HTMLElement>('[data-role="first-city-command-outcome"]');
    const terminalReceipt = this.panel.querySelector<HTMLElement>('[data-role="first-city-terminal-receipt"]');
    const probeVisible = this.firstCityProbeEligible && permitsFirstCityV2Probe(GATEWAY_WS_URL);
    if (probe) probe.hidden = !probeVisible;
    const legacyBoundaryText = formatFirstCityLegacyRouteBoundaryPanel(probeVisible);
    if (legacyRouteBoundary) {
      legacyRouteBoundary.hidden = !probeVisible || !legacyBoundaryText;
      legacyRouteBoundary.textContent = legacyBoundaryText;
    }
    if (probeStatus) probeStatus.textContent = this.firstCityProbeNotice;
    if (probeBtn) {
      probeBtn.disabled = !probeVisible || this.entering || this.firstCityProbeInFlight || this.listBusy ||
        !this.connected || !login.value.trim() || !password.value || !supportsFirstCityPersisted(this.gatewayRef);
    }
    const command = this.panel.querySelector<HTMLElement>('[data-role="first-city-command"]');
    const submitBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="submit-first-city"]');
    const continueBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="continue-first-city"]');
    const resultBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="get-first-city-result"]');
    const fcName = this.panel.querySelector<HTMLInputElement>('input[name="fc-name"]');
    const fcX = this.panel.querySelector<HTMLInputElement>('input[name="fc-x"]');
    const fcY = this.panel.querySelector<HTMLInputElement>('input[name="fc-y"]');
    const fcCommandId = this.panel.querySelector<HTMLInputElement>('input[name="fc-command-id"]');
    const staleActor = this.firstCityStaleActor(login.value.trim());
    if (command) command.hidden = !probeVisible || !this.firstCityKnowledge;
    const commandReady = !!this.firstCityKnowledge && !this.firstCityKnowledge.unavailable && !staleActor;
    if (staleActor && probeStatus && !this.firstCityProbeInFlight) {
      probeStatus.textContent = FIRST_CITY_STALE_ACTOR_NOTICE;
    }
    if (authorizedScope) {
      const scopeText = formatFirstCityAuthorizedScopePanel(this.firstCityKnowledge, staleActor);
      authorizedScope.hidden = !probeVisible || !scopeText;
      authorizedScope.textContent = scopeText;
    }
    if (retainedTemplate) {
      const templateText = formatFirstCityRetainedTemplatePanel(this.firstCityKnowledge, staleActor);
      retainedTemplate.hidden = !probeVisible || !templateText;
      retainedTemplate.textContent = templateText;
    }
    if (headPredecessor) {
      const predecessorText = formatFirstCityHeadPredecessorPanel(this.firstCityKnowledge, staleActor);
      headPredecessor.hidden = !probeVisible || !predecessorText;
      headPredecessor.textContent = predecessorText;
    }
    if (durableHeadC1) {
      const c1Text = formatFirstCityDurableHeadC1Panel(this.firstCityKnowledge, staleActor);
      durableHeadC1.hidden = !probeVisible || !c1Text;
      durableHeadC1.textContent = c1Text;
    }
    if (canonicalWinner) {
      const winnerText = formatFirstCityCanonicalWinnerPanel(this.firstCityKnowledge, staleActor);
      canonicalWinner.hidden = !probeVisible || !winnerText;
      canonicalWinner.textContent = winnerText;
    }
    const formSnapshot = fcName && fcX && fcY
      ? { name: fcName.value, x: Number(fcX.value), y: Number(fcY.value) }
      : null;
    if (proposalFormBoundary) {
      const boundaryText = formatFirstCityProposalFormBoundaryPanel(this.firstCityKnowledge, formSnapshot, staleActor);
      proposalFormBoundary.hidden = !probeVisible || !boundaryText;
      proposalFormBoundary.textContent = boundaryText;
    }
    if (submitFormLocalBoundary) {
      const submitBoundaryText = formatFirstCitySubmitFormLocalBoundaryPanel(this.firstCityKnowledge, formSnapshot, staleActor);
      submitFormLocalBoundary.hidden = !probeVisible || !submitBoundaryText;
      submitFormLocalBoundary.textContent = submitBoundaryText;
    }
    if (submitFormLocalIdBoundary) {
      const submitIdBoundaryText = formatFirstCitySubmitFormLocalIdBoundaryPanel(this.firstCityKnowledge, formSnapshot, staleActor);
      submitFormLocalIdBoundary.hidden = !probeVisible || !submitIdBoundaryText;
      submitFormLocalIdBoundary.textContent = submitIdBoundaryText;
    }
    if (submitRejectedHeadBoundary) {
      const rejectedHeadText = formatFirstCitySubmitRejectedHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      submitRejectedHeadBoundary.hidden = !probeVisible || !rejectedHeadText;
      submitRejectedHeadBoundary.textContent = rejectedHeadText;
    }
    if (submitPendingHeadBoundary) {
      const pendingHeadText = formatFirstCitySubmitPendingHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      submitPendingHeadBoundary.hidden = !probeVisible || !pendingHeadText;
      submitPendingHeadBoundary.textContent = pendingHeadText;
    }
    if (submitSucceededHeadBoundary) {
      const succeededHeadText = formatFirstCitySubmitSucceededHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      submitSucceededHeadBoundary.hidden = !probeVisible || !succeededHeadText;
      submitSucceededHeadBoundary.textContent = succeededHeadText;
    }
    if (submitEmptyHeadBoundary) {
      const emptyHeadText = formatFirstCitySubmitEmptyHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      submitEmptyHeadBoundary.hidden = !probeVisible || !emptyHeadText;
      submitEmptyHeadBoundary.textContent = emptyHeadText;
    }
    if (continueRejectedHeadBoundary) {
      const continueRejectedText = formatFirstCityContinueRejectedHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      continueRejectedHeadBoundary.hidden = !probeVisible || !continueRejectedText;
      continueRejectedHeadBoundary.textContent = continueRejectedText;
    }
    if (continuePendingHeadBoundary) {
      const continuePendingText = formatFirstCityContinuePendingHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      continuePendingHeadBoundary.hidden = !probeVisible || !continuePendingText;
      continuePendingHeadBoundary.textContent = continuePendingText;
    }
    if (continueSucceededHeadBoundary) {
      const continueSucceededText = formatFirstCityContinueSucceededHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      continueSucceededHeadBoundary.hidden = !probeVisible || !continueSucceededText;
      continueSucceededHeadBoundary.textContent = continueSucceededText;
    }
    if (continueEmptyHeadBoundary) {
      const continueEmptyHeadText = formatFirstCityContinueEmptyHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      continueEmptyHeadBoundary.hidden = !probeVisible || !continueEmptyHeadText;
      continueEmptyHeadBoundary.textContent = continueEmptyHeadText;
    }
    if (getEmptyHeadBoundary) {
      const getEmptyHeadText = formatFirstCityGetEmptyHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      getEmptyHeadBoundary.hidden = !probeVisible || !getEmptyHeadText;
      getEmptyHeadBoundary.textContent = getEmptyHeadText;
    }
    if (getPendingHeadBoundary) {
      const getPendingHeadText = formatFirstCityGetPendingHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      getPendingHeadBoundary.hidden = !probeVisible || !getPendingHeadText;
      getPendingHeadBoundary.textContent = getPendingHeadText;
    }
    if (getRejectedHeadBoundary) {
      const getRejectedHeadText = formatFirstCityGetRejectedHeadBoundaryPanel(this.firstCityKnowledge, staleActor);
      getRejectedHeadBoundary.hidden = !probeVisible || !getRejectedHeadText;
      getRejectedHeadBoundary.textContent = getRejectedHeadText;
    }
    if (continueLocalIntentBoundary) {
      const continueBoundaryText = formatFirstCityContinueLocalIntentBoundaryPanel(this.firstCityKnowledge, staleActor);
      continueLocalIntentBoundary.hidden = !probeVisible || !continueBoundaryText;
      continueLocalIntentBoundary.textContent = continueBoundaryText;
    }
    if (losingProposal) {
      const loserText = formatFirstCityLosingProposalsPanel(this.firstCityKnowledge, staleActor);
      losingProposal.hidden = !probeVisible || !loserText;
      losingProposal.textContent = loserText;
    }
    if (localDraft) {
      const draftText = formatFirstCityLocalDraftPanel(this.firstCityKnowledge, staleActor);
      localDraft.hidden = !probeVisible || !draftText;
      localDraft.textContent = draftText;
    }
    if (localC1Divergence) {
      const c1DivergenceText = formatFirstCityLocalC1DivergencePanel(this.firstCityKnowledge, staleActor);
      localC1Divergence.hidden = !probeVisible || !c1DivergenceText;
      localC1Divergence.textContent = c1DivergenceText;
    }
    if (headConflict) {
      const conflictText = formatFirstCityHeadConflictPanel(this.firstCityKnowledge, staleActor);
      headConflict.hidden = !probeVisible || !conflictText;
      headConflict.textContent = conflictText;
    }
    if (idContentConflict) {
      const contentText = formatFirstCityIdContentConflictPanel(this.firstCityKnowledge, staleActor);
      idContentConflict.hidden = !probeVisible || !contentText;
      idContentConflict.textContent = contentText;
    }
    if (notObserved) {
      const lookupText = formatFirstCityNotObservedPanel(this.firstCityKnowledge, staleActor);
      notObserved.hidden = !probeVisible || !lookupText;
      notObserved.textContent = lookupText;
    }
    if (pendingIntake) {
      const intakeText = formatFirstCityPendingIntakePanel(this.firstCityKnowledge, staleActor);
      pendingIntake.hidden = !probeVisible || !intakeText;
      pendingIntake.textContent = intakeText;
    }
    if (discoveryEmpty) {
      const emptyText = formatFirstCityDiscoveryEmptyPanel(this.firstCityKnowledge, staleActor);
      discoveryEmpty.hidden = !probeVisible || !emptyText;
      discoveryEmpty.textContent = emptyText;
    }
    if (commandOutcome) {
      const outcomeText = formatFirstCityCommandOutcomePanel(this.firstCityKnowledge, staleActor);
      commandOutcome.hidden = !probeVisible || !outcomeText;
      commandOutcome.textContent = outcomeText;
    }
    if (terminalReceipt) {
      const receiptText = formatFirstCityTerminalReceiptPanel(this.firstCityKnowledge, staleActor);
      terminalReceipt.hidden = !probeVisible || !receiptText;
      terminalReceipt.textContent = receiptText;
    }
    if (submitBtn) {
      submitBtn.disabled = !commandReady || !canOfferFirstCitySubmit(this.firstCityKnowledge) || this.firstCityProbeInFlight ||
        this.entering || !password.value || this.listBusy;
    }
    if (continueBtn) {
      continueBtn.disabled = !commandReady || !canOfferFirstCityContinue(this.firstCityKnowledge) || this.firstCityProbeInFlight ||
        this.entering || !password.value || this.listBusy;
    }
    if (fcName && submitBtn) fcName.disabled = submitBtn.disabled && !canOfferFirstCitySubmit(this.firstCityKnowledge);
    if (fcCommandId && commandReady) {
      if (!fcCommandId.value.trim()) {
        const suggested = suggestFirstCityResultCommandId(this.firstCityKnowledge);
        if (suggested) fcCommandId.value = suggested;
      }
      fcCommandId.disabled = this.firstCityProbeInFlight || this.entering || this.listBusy;
    }
    if (resultBtn) {
      resultBtn.disabled = !commandReady || !canOfferFirstCityResult(this.firstCityKnowledge, fcCommandId?.value ?? "") ||
        this.firstCityProbeInFlight || this.entering || !password.value || this.listBusy;
    }
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
        if (this.firstCityActorBinding && id !== this.firstCityActorBinding.serverId) {
          this.clearFirstCityRetain();
          this.firstCityProbeNotice = FIRST_CITY_STALE_ACTOR_NOTICE;
        }
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
    if (action === "register-account") void this.registerAccount(ctx);
    if (action === "discover-first-city") void this.discoverFirstCity(ctx);
    if (action === "submit-first-city") void this.submitFirstCity(ctx);
    if (action === "continue-first-city") void this.continueFirstCity(ctx);
    if (action === "get-first-city-result") void this.getFirstCityResult(ctx);
  }

  private async registerAccount(ctx: SceneContext): Promise<void> {
    if (!this.active || !this.focusTrap?.isActive() || !this.connected || this.listBusy || this.entering || this.registrationAttempted) return;
    const login = this.panel.querySelector<HTMLInputElement>('input[name="login"]')!.value.trim();
    const password = this.panel.querySelector<HTMLInputElement>('input[name="password"]')!.value;
    if (!login || !password) return;
    this.clearPassword();
    if (!permitsExistingAccountLogin(GATEWAY_WS_URL)) {
      this.registrationNotice = "注册账号需要加密网关连接；本机开发网关除外";
      this.syncPanel();
      return;
    }
    const lifecycle = this.lifecycle, view = this.registrationView;
    const generation = ctx.gateway.getSessionGeneration?.();
    this.registrationAttempted = true;
    this.registrationNotice = REGISTER_UNKNOWN;
    this.entering = true;
    this.syncPanel();
    try {
      const result = await ctx.gateway.register(login, password) as { account_id?: unknown };
      if (!this.isCurrent(lifecycle) || view !== this.registrationView || !this.connected ||
        generation !== ctx.gateway.getSessionGeneration?.()) return;
      // A valid receipt confirms creation only, never an authenticated identity.
      if (/^[1-9][0-9]*$/.test(String(result?.account_id ?? ""))) {
        this.registrationNotice = "账号已注册；本次注册未登录或建城。首次建城尚未开放。可重新输入密码并点击登录已有账号。";
      }
    } catch {
      // Even a failed response may follow a committed insert. Never retry or expose RPC errors.
    } finally {
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }

  private async discoverFirstCity(ctx: SceneContext): Promise<void> {
    if (!this.active || !this.focusTrap?.isActive() || !this.firstCityProbeEligible || !this.connected ||
      this.listBusy || this.entering || this.firstCityProbeInFlight || !permitsFirstCityV2Probe(GATEWAY_WS_URL) ||
      !supportsFirstCityPersisted(ctx.gateway)) return;
    const login = this.panel.querySelector<HTMLInputElement>('input[name="login"]')!.value.trim();
    const password = this.panel.querySelector<HTMLInputElement>('input[name="password"]')!.value;
    if (!login || !password ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) return;
    this.clearPassword();
    const lifecycle = this.lifecycle;
    const generation = ctx.gateway.getSessionGeneration?.();
    if (this.firstCityStaleActor(login)) {
      this.firstCityProbeNotice = FIRST_CITY_STALE_ACTOR_NOTICE;
      this.syncPanel();
      return;
    }
    const inProgress = "首城 V2 探测进行中…";
    this.firstCityProbeInFlight = true;
    this.entering = true;
    this.firstCityProbeNotice = inProgress;
    this.syncPanel();
    try {
      const result = await runFirstCityDiscoverProbe(ctx.gateway, login, password, this.selectedId, generation);
      if (!this.isCurrent(lifecycle) || generation !== ctx.gateway.getSessionGeneration?.()) {
        this.firstCityProbeNotice = "首城 V2 探测结果尚未确认；未调用 v1 建城，也未进入主城。";
        this.status = "首城 V2 探测未完成";
        return;
      }
      this.firstCityController = result.controller;
      this.firstCityKnowledge = result.knowledge;
      this.firstCityActorBinding = bindFirstCityActor(login, this.selectedId, ctx.gateway.getSessionGeneration?.(),
        result.knowledge);
      this.firstCityProbeNotice = result.message;
      this.status = "首城 V2 探测完成；未建城、未进主城。";
    } catch {
      if (!this.isCurrent(lifecycle)) return;
      this.clearFirstCityRetain();
      this.firstCityProbeNotice = "首城 V2 探测结果尚未确认；未调用 v1 建城，也未进入主城。";
      this.status = "首城 V2 探测未完成";
    } finally {
      if (this.firstCityProbeNotice === inProgress) {
        this.firstCityProbeNotice = "首城 V2 探测结果尚未确认；未调用 v1 建城，也未进入主城。";
      }
      this.firstCityProbeInFlight = false;
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }

  private async submitFirstCity(ctx: SceneContext): Promise<void> {
    await this.runFirstCityCommand(ctx, "submit");
  }

  private async continueFirstCity(ctx: SceneContext): Promise<void> {
    await this.runFirstCityCommand(ctx, "continue");
  }

  private async getFirstCityResult(ctx: SceneContext): Promise<void> {
    if (!this.active || !this.focusTrap?.isActive() || !this.firstCityProbeEligible || !this.connected ||
      this.listBusy || this.entering || this.firstCityProbeInFlight || !permitsFirstCityV2Probe(GATEWAY_WS_URL) ||
      !supportsFirstCityPersisted(ctx.gateway) || !this.firstCityController || !this.firstCityKnowledge) return;
    const login = this.panel.querySelector<HTMLInputElement>('input[name="login"]')!.value.trim();
    const password = this.panel.querySelector<HTMLInputElement>('input[name="password"]')!.value;
    const commandId = this.panel.querySelector<HTMLInputElement>('input[name="fc-command-id"]')!.value;
    if (!login || !password || !canOfferFirstCityResult(this.firstCityKnowledge, commandId) ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) return;
    if (this.firstCityStaleActor(login)) {
      this.firstCityProbeNotice = FIRST_CITY_STALE_ACTOR_NOTICE;
      this.syncPanel();
      return;
    }
    this.clearPassword();
    const lifecycle = this.lifecycle;
    const generation = ctx.gateway.getSessionGeneration?.();
    const inProgress = "首城 V2 GetResult 进行中…";
    const failure = "首城 V2 GetResult 结果尚未确认；未调用 v1 建城，也未进入主城。";
    this.firstCityProbeInFlight = true;
    this.entering = true;
    this.firstCityProbeNotice = inProgress;
    this.syncPanel();
    try {
      const result = await runFirstCityResultCommand(ctx.gateway, this.firstCityController, this.firstCityKnowledge,
        commandId, login, password, this.selectedId, generation, this.firstCityActorBinding);
      if (!this.isCurrent(lifecycle) || generation !== ctx.gateway.getSessionGeneration?.()) {
        this.firstCityProbeNotice = failure;
        this.status = "首城 V2 GetResult 未完成";
        return;
      }
      this.firstCityKnowledge = result.knowledge;
      this.firstCityProbeNotice = result.message;
      this.status = "首城 V2 GetResult 往返完成；未进主城。";
    } catch {
      if (!this.isCurrent(lifecycle)) return;
      this.firstCityProbeNotice = failure;
      this.status = "首城 V2 GetResult 未完成";
    } finally {
      if (this.firstCityProbeNotice === inProgress) this.firstCityProbeNotice = failure;
      this.firstCityProbeInFlight = false;
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }

  private async runFirstCityCommand(ctx: SceneContext, kind: "submit" | "continue"): Promise<void> {
    if (!this.active || !this.focusTrap?.isActive() || !this.firstCityProbeEligible || !this.connected ||
      this.listBusy || this.entering || this.firstCityProbeInFlight || !permitsFirstCityV2Probe(GATEWAY_WS_URL) ||
      !supportsFirstCityPersisted(ctx.gateway) || !this.firstCityController || !this.firstCityKnowledge) return;
    const login = this.panel.querySelector<HTMLInputElement>('input[name="login"]')!.value.trim();
    const password = this.panel.querySelector<HTMLInputElement>('input[name="password"]')!.value;
    if (!login || !password ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) return;
  if (kind === "submit" && !canOfferFirstCitySubmit(this.firstCityKnowledge)) return;
    if (kind === "continue" && !canOfferFirstCityContinue(this.firstCityKnowledge)) return;
    if (this.firstCityStaleActor(login)) {
      this.firstCityProbeNotice = FIRST_CITY_STALE_ACTOR_NOTICE;
      this.syncPanel();
      return;
    }
    this.clearPassword();
    const lifecycle = this.lifecycle;
    const generation = ctx.gateway.getSessionGeneration?.();
    const inProgress = kind === "submit" ? "首城 V2 Submit 进行中…" : "首城 V2 Continue 进行中…";
    this.firstCityProbeInFlight = true;
    this.entering = true;
    this.firstCityProbeNotice = inProgress;
    this.syncPanel();
    const failure = "首城 V2 命令结果尚未确认；未调用 v1 建城，也未进入主城。";
    try {
      let result: { message: string; knowledge: FirstCityKnowledge };
      if (kind === "submit") {
        const name = this.panel.querySelector<HTMLInputElement>('input[name="fc-name"]')!.value;
        const x = Number(this.panel.querySelector<HTMLInputElement>('input[name="fc-x"]')!.value);
        const y = Number(this.panel.querySelector<HTMLInputElement>('input[name="fc-y"]')!.value);
        result = await runFirstCitySubmitCommand(ctx.gateway, this.firstCityController, this.firstCityKnowledge,
          { name, x, y }, login, password, this.selectedId, generation, this.firstCityActorBinding);
      } else {
        result = await runFirstCityContinueCommand(ctx.gateway, this.firstCityController, this.firstCityKnowledge,
          login, password, this.selectedId, generation, this.firstCityActorBinding);
      }
      if (!this.isCurrent(lifecycle) || generation !== ctx.gateway.getSessionGeneration?.()) {
        this.firstCityProbeNotice = failure;
        this.status = "首城 V2 命令未完成";
        return;
      }
      this.firstCityKnowledge = result.knowledge;
      this.firstCityProbeNotice = result.message;
      this.status = `首城 V2 ${kind === "submit" ? "Submit" : "Continue"} 往返完成；未进主城。`;
    } catch {
      if (!this.isCurrent(lifecycle)) return;
      this.firstCityProbeNotice = failure;
      this.status = "首城 V2 命令未完成";
    } finally {
      if (this.firstCityProbeNotice === inProgress) this.firstCityProbeNotice = failure;
      this.firstCityProbeInFlight = false;
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }

  private async enterGame(ctx: SceneContext, existing = false): Promise<void> {
    if (!this.active || !this.connected || this.listBusy || this.entering ||
      !this.servers.some(s => s.server_id === this.selectedId && this.canEnter(s))) return;
    const login = existing ? this.panel.querySelector<HTMLInputElement>('input[name="login"]')!.value.trim() : DEFAULT_LOGIN;
    const password = existing ? this.panel.querySelector<HTMLInputElement>('input[name="password"]')!.value : DEFAULT_PASSWORD;
    if (existing && (!login || !password)) return;
    if (existing && !permitsExistingAccountLogin(GATEWAY_WS_URL)) {
      this.clearPassword();
      this.status = "已有账号登录需要加密网关连接；本机开发网关除外";
      this.syncPanel();
      return;
    }
    this.clearPassword();
    const lifecycle = this.lifecycle;
    const serverId = this.selectedId;
    this.entering = true;
    this.status = `进入服 #${this.selectedId}…`;
    this.syncPanel();
    try {
      const session = await bootstrapMainCity(ctx.gateway, login, password, serverId, existing ? "existing" : "demo");
      if (!this.isCurrent(lifecycle) || !this.connected) return;
      await ctx.switchScene("mainCity", session);
    } catch (e) {
      if (!this.isCurrent(lifecycle)) return;
      const message = (e as Error).message;
      const noCity = message === "此账号在所选服尚无城池；首次建城流程尚未开放，本次未注册账号或创建城池";
      if (existing && noCity) {
        this.clearFirstCityRetain();
        this.firstCityProbeEligible = true;
      }
      this.status = existing
        ? (noCity ? message : "登录未完成，请核对账号、密码、所选服或连接后重试")
        : `进服失败: ${message}`;
      this.syncPanel();
    } finally {
      // Leaving cannot cancel an already submitted bootstrap; keep it single-flight on re-entry.
      this.entering = false;
      if (this.active) this.syncPanel();
    }
  }
}
