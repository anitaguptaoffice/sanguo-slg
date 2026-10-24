import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import {
  formatLeaderboardSnapshotMeta,
  formatMyRankPinLine,
  formatViewerRankSummary,
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  selectedLeaderboardTypeFromValue,
  viewerScoreFallback,
  type LeaderboardEntryRow,
  type LeaderboardPagePayload,
} from "@/net/leaderboardFormat";
import { leaderboardRowDomId } from "@/net/battleReportSideLink";
import {
  formatRankLastRefreshLine,
  readRankLastRefreshMs,
  writeRankLastRefreshMs,
} from "@/net/rankLastRefreshSession";
import {
  CHAT_CHANNEL_GUILD,
  CHAT_CHANNEL_PRIVATE,
  CHAT_CHANNEL_WORLD,
  chatChannelLabel,
  formatGuildMemberPrimaryNick,
  formatGuildMemberSecondaryLine,
  formatGuildMentionDraft,
  groupGuildMembersByRole,
  guildRoleChipClass,
  guildRoleGroupDefaultExpanded,
  guildRoleLabel,
  formatGuildSummaryText,
  formatSenderLabel,
  formatSocialChatEmptyMessage,
  formatSocialGatewayError,
  formatSocialGuildMembersEmptyMessage,
  formatSocialGuildNotJoinedReadonlyMessage,
  formatSocialGuildTabNavigateLabel,
  formatSocialPanelListRefreshHint,
  formatSocialRankEmptyMessage,
  groupChatMessagesByLocalDay,
  socialChatEmptyListClass,
  socialGuildMembersEmptyListClass,
  socialRankEmptyRowClass,
  type ChatMessageRow,
  type GuildMemberRow,
} from "@/net/socialFormat";
import { formatTimeMs } from "@/net/militaryFormat";
import { SocialPanelInflight } from "@/net/socialPanelInflight";
import { gatewayErrorMessage } from "@/net/contentFeedback";
import { formatPanelRefreshMeta } from "@/net/socialRefreshFormat";
import {
  CHAT_PANEL_LAST_REFRESH_SESSION_KEY,
  GUILD_PANEL_LAST_REFRESH_SESSION_KEY,
  readSocialPanelLastRefreshMs,
  writeSocialPanelLastRefreshMs,
} from "@/net/socialPanelRefreshSession";
import {
  chatChannelStorageKey,
  type ChatUnreadSummary,
  type ChatUnreadTracker,
  isElementScrolledToBottom,
  maxChatMessageSentAtMs,
} from "@/net/chatUnread";
import { formatHudBadgeCount } from "@/net/hudTodoBadge";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import {
  detectLeaderboardMyRankChange,
  formatMyRankPinSecondaryLine,
  scheduleRankMyRankChangedPulse,
} from "@/net/leaderboardMyRankRefresh";
import {
  formatRankReadonlySummary,
  resolveRankRowDeepLink,
  type RankRowDeepLink,
} from "@/net/rankRowDeepLink";

export type SocialRankDeepLinkHandlers = {
  getViewerHeroIds?: () => Promise<number[]>;
  onOpenHeroDetail?: (heroId: number) => void | Promise<void>;
  onOpenWorldAtGrid?: (gridX: number, gridY: number) => void;
  onOpenWorldViewer?: () => void;
};

export class SocialPanels {
  private chatPanel!: HTMLElement;
  private guildPanel!: HTMLElement;
  private rankPanel!: HTMLElement;
  private guildId = 0;
  private guildName = "";
  private readonly chatListInflight = new SocialPanelInflight<void>();
  private readonly rankListInflight = new SocialPanelInflight<void>();
  private readonly guildListInflight = new SocialPanelInflight<void>();
  private readonly refreshClock = {
    chat: { lastUpdatedMs: 0, stale: false },
    rank: { lastUpdatedMs: 0, stale: false },
    guild: { lastUpdatedMs: 0, stale: false },
  };
  private chatListError = "";
  private guildListError = "";
  private guildMembersCache: GuildMemberRow[] = [];
  private readonly guildRoleGroupExpanded = new Map<number, boolean>();
  private readonly rankSnapshotByType = new Map<number, LeaderboardPagePayload>();
  private pendingRankPinPulse = false;
  private rankHighlightEntityId = 0;
  private rankDeepLink: SocialRankDeepLinkHandlers = {};
  private lastRenderedChatMessages: ChatMessageRow[] = [];

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onStatus: (msg: string) => void,
    private readonly chatUnreadTracker: ChatUnreadTracker | null = null,
  ) {}

  setRankDeepLinkHandlers(handlers: SocialRankDeepLinkHandlers): void {
    this.rankDeepLink = { ...handlers };
  }

  attach(): void {
    this.chatPanel = this.buildChatPanel();
    this.guildPanel = this.buildGuildPanel();
    this.rankPanel = this.buildRankPanel();
    this.mount.appendChild(this.chatPanel);
    this.mount.appendChild(this.guildPanel);
    this.mount.appendChild(this.rankPanel);
    this.chatPanel.addEventListener("click", (ev) => this.onChatClick(ev));
    this.guildPanel.addEventListener("click", (ev) => this.onGuildClick(ev));
    this.rankPanel.addEventListener("click", (ev) => this.onRankClick(ev));
    this.rankPanel.querySelector('[data-field="rank-type"]')?.addEventListener("change", () => {
      if (!this.rankPanel.classList.contains("hidden")) void this.refreshRank();
    });
  }

  detach(): void {
    this.chatPanel?.remove();
    this.guildPanel?.remove();
    this.rankPanel?.remove();
  }

  toggleChat(): void {
    this.chatPanel.classList.toggle("hidden");
    if (!this.chatPanel.classList.contains("hidden")) {
      resetCenterPanelViewportScroll(this.chatPanel);
      this.hydrateChatRefreshClockFromSession();
      void this.refreshChat();
    }
  }

  toggleGuild(): void {
    this.guildPanel.classList.toggle("hidden");
    if (!this.guildPanel.classList.contains("hidden")) {
      resetCenterPanelViewportScroll(this.guildPanel);
      this.hydrateGuildRefreshClockFromSession();
      this.syncGuildSummary();
      this.renderGuildMembersList([]);
    }
  }

  /** 聊天/排行等入口跳转军团面板（不触发新 RPC）。 */
  openGuildPanel(): void {
    this.chatPanel.classList.add("hidden");
    this.rankPanel.classList.add("hidden");
    this.guildPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.guildPanel);
    this.syncGuildSummary();
    this.renderGuildMembersList([]);
  }

  toggleRank(): void {
    this.rankPanel.classList.toggle("hidden");
    if (!this.rankPanel.classList.contains("hidden")) {
      this.hydrateRankRefreshClockFromSession();
      void this.refreshRank();
    }
  }

  /** 战报深链：打开战力榜并高亮 entity_id 行（CLIENT-100）。 */
  openPowerRankHighlightEntity(entityId: number): void {
    if (!entityId) return;
    this.chatPanel.classList.add("hidden");
    this.guildPanel.classList.add("hidden");
    this.rankHighlightEntityId = entityId;
    const typeSelect = this.rankPanel.querySelector(
      '[data-field="rank-type"]',
    ) as HTMLSelectElement | null;
    if (typeSelect) typeSelect.value = String(LB_PLAYER_POWER);
    this.rankPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.rankPanel);
    void this.refreshRank().then(() => this.scrollRankHighlightIntoView());
  }

  private scrollRankHighlightIntoView(): void {
    const id = this.rankHighlightEntityId;
    if (!id) return;
    const row = this.rankPanel.querySelector<HTMLElement>(
      `#${CSS.escape(leaderboardRowDomId(id))}`,
    );
    row?.scrollIntoView?.({ block: "nearest" });
  }

  getRankRoot(): HTMLElement {
    return this.rankPanel;
  }

  getGuildRoot(): HTMLElement {
    return this.guildPanel;
  }

  getChatRoot(): HTMLElement {
    return this.chatPanel;
  }

  getGuildId(): number {
    return this.guildId;
  }

  isChatOpen(): boolean {
    return !!this.chatPanel && !this.chatPanel.classList.contains("hidden");
  }

  isGuildOpen(): boolean {
    return !!this.guildPanel && !this.guildPanel.classList.contains("hidden");
  }

  /** HUD / 军团面板 tab 角标与底栏同步（CLIENT-102）。 */
  syncChatUnreadBadges(summary: ChatUnreadSummary): void {
    this.setChatTabBadge(CHAT_CHANNEL_WORLD, summary.world);
    this.setChatTabBadge(CHAT_CHANNEL_GUILD, summary.guild);
    const guildBadge = this.guildPanel?.querySelector<HTMLElement>(
      '[data-role="guild-chat-entry-badge"]',
    );
    if (guildBadge) {
      const text = formatHudBadgeCount(summary.guild);
      guildBadge.textContent = text;
      guildBadge.classList.toggle("hidden", !text);
    }
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private selectedChatChannel(): number {
    return Number(
      (this.chatPanel.querySelector('[data-field="channel"]') as HTMLSelectElement)?.value ?? CHAT_CHANNEL_WORLD,
    );
  }

  private syncChatChannelUi(ch: number): void {
    this.chatPanel.querySelector(".private-target")?.classList.toggle("hidden", ch !== CHAT_CHANNEL_PRIVATE);
    this.chatPanel.querySelector('[data-role="guild-chat-hint"]')?.classList.toggle("hidden", ch !== CHAT_CHANNEL_GUILD);
  }

  private syncChatChannelTabUi(ch: number): void {
    const tabs = this.chatPanel.querySelectorAll<HTMLButtonElement>("[data-action='pick-chat-channel']");
    for (const tab of tabs) {
      const tabCh = Number(tab.getAttribute("data-chat-channel") ?? 0);
      const active = tabCh === ch;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  private setChatTabBadge(channel: number, count: number): void {
    const badge = this.chatPanel?.querySelector<HTMLElement>(`[data-role="chat-tab-badge-${channel}"]`);
    if (!badge) return;
    const text = formatHudBadgeCount(count);
    badge.textContent = text;
    badge.classList.toggle("hidden", !text);
  }

  private pushChatSnapshot(channel: number, messages: ChatMessageRow[]): void {
    if (!this.chatUnreadTracker) return;
    if (channel !== CHAT_CHANNEL_WORLD && channel !== CHAT_CHANNEL_GUILD) return;
    const guildId = channel === CHAT_CHANNEL_GUILD ? this.guildId : 0;
    const key = chatChannelStorageKey(channel, guildId);
    this.chatUnreadTracker.replaceSnapshot({ key, channel, messages });
    this.syncChatUnreadBadges(this.chatUnreadTracker.getSummary(this.guildId));
  }

  private maybeMarkChatChannelRead(): void {
    if (!this.chatUnreadTracker || this.chatPanel.classList.contains("hidden")) return;
    const ch = this.selectedChatChannel();
    if (ch !== CHAT_CHANNEL_WORLD && ch !== CHAT_CHANNEL_GUILD) return;
    const scroll = this.chatPanel.querySelector('[data-role="chat-scroll"]') as HTMLElement | null;
    if (!scroll || !isElementScrolledToBottom(scroll)) return;
    const guildId = ch === CHAT_CHANNEL_GUILD ? this.guildId : 0;
    const key = chatChannelStorageKey(ch, guildId);
    const through = maxChatMessageSentAtMs(this.lastRenderedChatMessages);
    if (through > 0) this.chatUnreadTracker.markChannelRead(key, through);
  }

  private openGuildChatChannel(): void {
    this.rankPanel.classList.add("hidden");
    this.guildPanel.classList.add("hidden");
    this.chatPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.chatPanel);
    const sel = this.chatPanel.querySelector('[data-field="channel"]') as HTMLSelectElement | null;
    if (sel) sel.value = String(CHAT_CHANNEL_GUILD);
    this.syncChatChannelUi(CHAT_CHANNEL_GUILD);
    this.syncChatChannelTabUi(CHAT_CHANNEL_GUILD);
    void this.refreshChat();
  }

  private chatListOpts(ch: number): { peerPlayerId?: number; guildId?: number } {
    if (ch === CHAT_CHANNEL_PRIVATE) {
      const peer = Number((this.chatPanel.querySelector('[data-field="peer-id"]') as HTMLInputElement)?.value ?? 0);
      return { peerPlayerId: peer };
    }
    if (ch === CHAT_CHANNEL_GUILD) {
      return { guildId: this.guildId };
    }
    return {};
  }

  private chatSendOpts(ch: number): { recipientPlayerId?: number; guildId?: number } {
    if (ch === CHAT_CHANNEL_PRIVATE) {
      const peer = Number((this.chatPanel.querySelector('[data-field="peer-id"]') as HTMLInputElement)?.value ?? 0);
      return { recipientPlayerId: peer };
    }
    if (ch === CHAT_CHANNEL_GUILD) {
      return { guildId: this.guildId };
    }
    return {};
  }

  private ensureGuildChatReady(ch: number): boolean {
    if (ch !== CHAT_CHANNEL_GUILD) return true;
    if (this.guildId > 0) return true;
    this.onStatus("军团频道需要先创建或加入军团");
    return false;
  }

  private buildChatPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "social-panel hidden";
    el.dataset.centerPanel = "chat";
    el.innerHTML = `
      <h3>聊天</h3>
      <div class="chat-channel-tabs" data-role="chat-channel-tabs" role="tablist" aria-label="聊天频道">
        <button type="button" class="chat-channel-tab active" data-action="pick-chat-channel" data-chat-channel="1" role="tab" aria-selected="true">世界<span class="chat-channel-tab-badge hidden" data-role="chat-tab-badge-1"></span></button>
        <button type="button" class="chat-channel-tab" data-action="pick-chat-channel" data-chat-channel="2" role="tab" aria-selected="false">私聊</button>
        <button type="button" class="chat-channel-tab" data-action="pick-chat-channel" data-chat-channel="3" role="tab" aria-selected="false">军团<span class="chat-channel-tab-badge hidden" data-role="chat-tab-badge-3"></span></button>
      </div>
      <label class="chat-channel-select-label">频道
        <select data-field="channel">
          <option value="1">世界</option>
          <option value="2">私聊</option>
          <option value="3">军团</option>
        </select>
      </label>
      <label class="private-target hidden">对方玩家 ID
        <input type="number" data-field="peer-id" min="1" value="10002" />
      </label>
      <p class="guild-chat-hint hidden" data-role="guild-chat-hint">军团频道需先在「军团」面板创建或加入军团（chat.v1 + guild_id）。</p>
      <div class="panel-scroll-body" data-role="chat-scroll">
        <ul class="chat-log" data-role="chat-log"></ul>
      </div>
      <label>内容 <input type="text" data-field="chat-content" maxlength="120" placeholder="输入消息" /></label>
      <button type="button" data-action="send-chat">发送</button>
      <button type="button" data-action="refresh-chat">刷新</button>
      <button type="button" class="social-refresh-retry hidden" data-action="retry-refresh-chat" data-role="chat-refresh-retry">重试</button>
      <p class="social-refresh-status" data-role="chat-refresh-status" hidden aria-live="polite">
        <span class="social-refresh-spinner" data-role="chat-refresh-spinner" hidden></span>
        <span data-role="chat-refresh-status-text"></span>
      </p>
    `;
    el.querySelector('[data-field="channel"]')?.addEventListener("change", (ev) => {
      const ch = Number((ev.target as HTMLSelectElement).value);
      this.syncChatChannelUi(ch);
      this.syncChatChannelTabUi(ch);
      if (!el.classList.contains("hidden")) void this.refreshChat();
    });
    el.querySelector('[data-role="chat-scroll"]')?.addEventListener(
      "scroll",
      () => this.maybeMarkChatChannelRead(),
      { passive: true },
    );
    return el;
  }

  private buildGuildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "social-panel hidden";
    el.dataset.centerPanel = "guild";
    el.innerHTML = `
      <h3>军团</h3>
      <button type="button" class="guild-chat-entry" data-action="open-guild-chat-channel">军团频道<span class="chat-channel-tab-badge hidden" data-role="guild-chat-entry-badge" aria-hidden="true"></span></button>
      <p data-role="guild-summary">尚未加入军团</p>
      <label>军团名称 <input type="text" data-field="guild-name" placeholder="新建军团名" /></label>
      <button type="button" data-action="create-guild">创建军团</button>
      <label>军团 ID <input type="number" data-field="join-guild-id" min="1" /></label>
      <button type="button" data-action="join-guild">加入军团</button>
      <button type="button" data-action="refresh-members">刷新成员</button>
      <button type="button" class="social-refresh-retry hidden" data-action="retry-refresh-members" data-role="guild-refresh-retry">重试</button>
      <p class="social-refresh-status" data-role="guild-refresh-status" hidden aria-live="polite">
        <span class="social-refresh-spinner" data-role="guild-refresh-spinner" hidden></span>
        <span data-role="guild-refresh-status-text"></span>
      </p>
      <div class="panel-scroll-body" data-role="guild-scroll">
        <ul class="guild-members" data-role="guild-members"></ul>
      </div>
    `;
    return el;
  }

  selectedLeaderboardType(): number {
    const raw = (this.rankPanel.querySelector('[data-field="rank-type"]') as HTMLSelectElement)?.value ?? LB_PLAYER_POWER;
    return selectedLeaderboardTypeFromValue(raw);
  }

  private buildRankPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden rank-panel";
    el.dataset.centerPanel = "rank";
    el.innerHTML = `
      <h3>排行榜</h3>
      <label>榜单
        <select data-field="rank-type">
          <option value="${LB_PLAYER_POWER}">玩家战力</option>
          <option value="${LB_PLAYER_RESOURCE}">玩家资源总量</option>
        </select>
      </label>
      <button type="button" data-action="refresh-rank">刷新排行榜</button>
      <button type="button" class="social-refresh-retry hidden" data-action="retry-refresh-rank" data-role="rank-refresh-retry">重试</button>
      <p class="social-refresh-status" data-role="rank-refresh-status" hidden aria-live="polite">
        <span class="social-refresh-spinner" data-role="rank-refresh-spinner" hidden></span>
        <span data-role="rank-refresh-status-text"></span>
      </p>
      <div class="panel-scroll-body" data-role="rank-scroll">
        <div class="rank-board" data-role="rank-board">
          <div class="rank-viewer-bar" aria-label="我的名次与刷新时间">
            <div data-role="viewer-rank">我的名次：—</div>
            <div class="rank-last-refresh-line hidden" data-role="rank-last-refresh" aria-label="上次刷新"></div>
          </div>
          <p class="rank-snapshot-meta hidden" data-role="rank-snapshot"></p>
          <aside
            class="rank-entry-summary hidden"
            data-role="rank-entry-summary"
            aria-live="polite"
          >
            <h4>排行摘要</h4>
            <p data-role="rank-entry-summary-text"></p>
            <button type="button" data-action="dismiss-rank-summary">关闭</button>
          </aside>
          <div class="rank-table-scroll">
            <table class="rank-table">
              <thead class="rank-table-head">
                <tr><th>名次</th><th>玩家</th><th>分数</th></tr>
              </thead>
              <tbody data-role="rank-list"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  private syncPanelRefreshUi(
    panel: HTMLElement,
    key: "chat" | "rank" | "guild",
    refreshAction: string,
    opts: { busy: boolean; lastUpdatedMs?: number; error?: string | null; stale?: boolean },
  ): void {
    const clock = this.refreshClock[key];
    if (opts.lastUpdatedMs) clock.lastUpdatedMs = opts.lastUpdatedMs;
    if (opts.stale !== undefined) clock.stale = opts.stale;
    const refreshBtn = panel.querySelector<HTMLButtonElement>(`[data-action="${refreshAction}"]`);
    if (refreshBtn) refreshBtn.disabled = opts.busy;
    const meta = formatPanelRefreshMeta({
      busy: opts.busy,
      lastUpdatedMs: clock.lastUpdatedMs,
      error: opts.error ?? null,
      stale: clock.stale,
    });
    const status = panel.querySelector(`[data-role="${key}-refresh-status"]`);
    const spinner = panel.querySelector(`[data-role="${key}-refresh-spinner"]`);
    const text = panel.querySelector(`[data-role="${key}-refresh-status-text"]`);
    const retry = panel.querySelector(`[data-role="${key}-refresh-retry"]`);
    if (text) text.textContent = meta.statusText;
    if (spinner) spinner.hidden = !meta.spinnerVisible;
    if (status) {
      status.hidden = meta.statusHidden;
      status.classList.toggle("social-refresh-error", meta.isError);
      status.classList.toggle("social-refresh-stale", meta.isStale && !meta.isError);
    }
    if (retry) retry.classList.toggle("hidden", !meta.retryVisible);
  }

  private async refreshChat(): Promise<void> {
    const sid = this.serverId();
    const ch = this.selectedChatChannel();
    if (ch === CHAT_CHANNEL_GUILD && this.guildId <= 0) {
      this.chatListError = "";
      this.renderChatLog([], ch);
      return;
    }
    return this.chatListInflight.run(async () => {
      this.syncPanelRefreshUi(this.chatPanel, "chat", "refresh-chat", { busy: true });
      this.onStatus("拉取聊天…");
      try {
        const res = (await this.gateway.listChatMessages(sid, ch, {
          ...this.chatListOpts(ch),
          limit: 30,
        })) as { messages?: ChatMessageRow[] };
        this.chatListError = "";
        const messages = res.messages ?? [];
        this.renderChatLog(messages, ch);
        this.pushChatSnapshot(ch, messages);
        const refreshedAt = Date.now();
        writeSocialPanelLastRefreshMs(CHAT_PANEL_LAST_REFRESH_SESSION_KEY, refreshedAt);
        this.syncPanelRefreshUi(this.chatPanel, "chat", "refresh-chat", {
          busy: false,
          lastUpdatedMs: refreshedAt,
          error: null,
        });
        this.onStatus("聊天已刷新");
      } catch (e) {
        const msg = formatSocialGatewayError(e);
        this.chatListError = msg;
        this.renderChatLog([], ch);
        this.syncPanelRefreshUi(this.chatPanel, "chat", "refresh-chat", {
          busy: false,
          error: gatewayErrorMessage(e),
        });
        this.onStatus(msg);
      }
    });
  }

  private renderChatLog(messages: ChatMessageRow[], channel = this.selectedChatChannel()): void {
    const ul = this.chatPanel.querySelector('[data-role="chat-log"]');
    if (!ul) return;
    this.lastRenderedChatMessages = messages;
    ul.innerHTML = "";
    if (channel === CHAT_CHANNEL_GUILD && this.guildId <= 0) {
      const li = document.createElement("li");
      li.className = socialChatEmptyListClass();
      li.textContent = formatSocialGuildNotJoinedReadonlyMessage();
      const nav = document.createElement("button");
      nav.type = "button";
      nav.className = "social-guild-nav";
      nav.setAttribute("data-action", "navigate-guild-panel");
      nav.textContent = formatSocialGuildTabNavigateLabel();
      li.appendChild(document.createElement("br"));
      li.appendChild(nav);
      ul.appendChild(li);
      return;
    }
    const groups = groupChatMessagesByLocalDay(messages);
    if (groups.length === 0) {
      const li = document.createElement("li");
      li.className = socialChatEmptyListClass();
      li.textContent = this.chatListError
        ? formatSocialPanelListRefreshHint()
        : formatSocialChatEmptyMessage();
      ul.appendChild(li);
      return;
    }
    for (const g of groups) {
      const head = document.createElement("li");
      head.className = "chat-day-header";
      head.textContent = g.title;
      ul.appendChild(head);
      for (const m of g.messages) {
        ul.appendChild(this.buildChatMessageRow(m));
      }
    }
    queueMicrotask(() => this.maybeMarkChatChannelRead());
  }

  private isGuildRoleGroupExpanded(roleKey: number): boolean {
    const stored = this.guildRoleGroupExpanded.get(roleKey);
    if (stored !== undefined) return stored;
    return guildRoleGroupDefaultExpanded(roleKey);
  }

  private renderGuildMembersList(members: GuildMemberRow[]): void {
    const ul = this.guildPanel.querySelector('[data-role="guild-members"]');
    if (!ul) return;
    ul.innerHTML = "";
    if (!this.guildId) {
      this.guildMembersCache = [];
      const li = document.createElement("li");
      li.className = socialGuildMembersEmptyListClass();
      li.textContent = `${formatSocialGuildNotJoinedReadonlyMessage()}可在本面板下方创建或加入军团。`;
      ul.appendChild(li);
      return;
    }
    if (!members.length) {
      this.guildMembersCache = [];
      const li = document.createElement("li");
      li.className = socialGuildMembersEmptyListClass();
      li.textContent = this.guildListError
        ? formatSocialPanelListRefreshHint()
        : formatSocialGuildMembersEmptyMessage();
      ul.appendChild(li);
      return;
    }
    this.guildMembersCache = members;
    for (const group of groupGuildMembersByRole(members)) {
      const expanded = this.isGuildRoleGroupExpanded(group.roleKey);
      const head = document.createElement("li");
      head.className = "guild-role-group-header";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "guild-role-group-toggle";
      toggle.setAttribute("data-action", "toggle-guild-role-group");
      toggle.setAttribute("data-role-key", String(group.roleKey));
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = `${expanded ? "▼" : "▶"} ${group.label}（${group.members.length}）`;
      head.appendChild(toggle);
      ul.appendChild(head);
      if (!expanded) continue;
      for (const m of group.members) {
        ul.appendChild(this.buildGuildMemberRow(m));
      }
    }
  }

  private buildGuildMemberRow(m: GuildMemberRow): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "guild-member-row";
    li.setAttribute("data-guild-role-key", String(m.role ?? 0));
    const primary = document.createElement("div");
    primary.className = "guild-member-primary";
    primary.setAttribute("data-role", "guild-member-primary");
    const nick = document.createElement("span");
    nick.className = "guild-member-nick";
    nick.textContent = formatGuildMemberPrimaryNick(m);
    const chip = document.createElement("span");
    chip.className = guildRoleChipClass(m.role);
    chip.setAttribute("data-role", "guild-role-chip");
    chip.textContent = guildRoleLabel(m.role);
    primary.append(nick, chip);
    const secondary = document.createElement("span");
    secondary.className = "guild-member-secondary";
    secondary.textContent = formatGuildMemberSecondaryLine(m);
    const mention = document.createElement("button");
    mention.type = "button";
    mention.className = "guild-member-mention";
    mention.setAttribute("data-action", "guild-mention");
    mention.setAttribute("data-display-name", m.display_name ?? "");
    mention.textContent = "提到";
    li.append(primary, secondary, mention);
    return li;
  }

  private hydrateChatRefreshClockFromSession(): void {
    const fromSession = readSocialPanelLastRefreshMs(CHAT_PANEL_LAST_REFRESH_SESSION_KEY);
    if (fromSession > 0) {
      this.refreshClock.chat.lastUpdatedMs = fromSession;
      this.syncPanelRefreshUi(this.chatPanel, "chat", "refresh-chat", { busy: false });
    }
  }

  private hydrateGuildRefreshClockFromSession(): void {
    const fromSession = readSocialPanelLastRefreshMs(GUILD_PANEL_LAST_REFRESH_SESSION_KEY);
    if (fromSession > 0) {
      this.refreshClock.guild.lastUpdatedMs = fromSession;
      this.syncPanelRefreshUi(this.guildPanel, "guild", "refresh-members", { busy: false });
    }
  }

  /** 打开聊天面板、切到军团频道并填入 @ 草稿（不发送、不额外 RPC）。 */
  private openChatWithGuildMentionDraft(displayName: string): void {
    this.guildPanel.classList.add("hidden");
    this.rankPanel.classList.add("hidden");
    this.chatPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.chatPanel);
    const channel = this.chatPanel.querySelector('[data-field="channel"]') as HTMLSelectElement;
    if (channel) channel.value = String(CHAT_CHANNEL_GUILD);
    this.syncChatChannelUi(CHAT_CHANNEL_GUILD);
    this.syncChatChannelTabUi(CHAT_CHANNEL_GUILD);
    const input = this.chatPanel.querySelector('[data-field="chat-content"]') as HTMLInputElement;
    if (input) {
      input.value = formatGuildMentionDraft(displayName);
      input.focus();
    }
  }

  private buildChatMessageRow(msg: ChatMessageRow): HTMLLIElement {
    const li = document.createElement("li");
    const ch = msg.channel ?? CHAT_CHANNEL_WORLD;
    li.className = "chat-msg";
    if (ch === CHAT_CHANNEL_WORLD) li.classList.add("chat-msg-world");
    const meta = document.createElement("span");
    meta.className = "chat-meta";
    meta.textContent = `[${chatChannelLabel(ch)}] ${formatTimeMs(msg.sent_at_ms)} · `;
    const sender = document.createElement("span");
    sender.className = "chat-sender";
    sender.textContent = formatSenderLabel(msg.sender_display_name, msg.sender_player_id);
    const body = document.createElement("span");
    body.className = "chat-body";
    body.textContent = `: ${msg.content ?? ""}`;
    li.append(meta, sender, body);
    return li;
  }

  private async sendChat(): Promise<void> {
    const sid = this.serverId();
    const ch = this.selectedChatChannel();
    const content = (this.chatPanel.querySelector('[data-field="chat-content"]') as HTMLInputElement)?.value?.trim();
    if (!content) {
      this.onStatus("消息不能为空");
      return;
    }
    if (!this.ensureGuildChatReady(ch)) return;
    this.onStatus("发送中…");
    try {
      await this.gateway.sendChatMessage(sid, ch, content, this.chatSendOpts(ch));
      (this.chatPanel.querySelector('[data-field="chat-content"]') as HTMLInputElement).value = "";
      await this.refreshChat();
      this.onStatus("已发送");
    } catch (e) {
      this.onStatus(formatSocialGatewayError(e));
    }
  }

  private async createGuild(): Promise<void> {
    const sid = this.serverId();
    const name = (this.guildPanel.querySelector('[data-field="guild-name"]') as HTMLInputElement)?.value?.trim();
    if (!name) {
      this.onStatus("请输入军团名");
      return;
    }
    this.onStatus("创建军团…");
    try {
      const res = (await this.gateway.createGuild(sid, name)) as {
        guild?: { guild_id?: number; name?: string };
      };
      this.guildId = res.guild?.guild_id ?? 0;
      this.guildName = res.guild?.name ?? name;
      this.syncGuildSummary();
      await this.refreshMembers();
      this.onStatus(`已创建「${this.guildName}」`);
    } catch (e) {
      this.onStatus(formatSocialGatewayError(e));
    }
  }

  private async joinGuild(): Promise<void> {
    const sid = this.serverId();
    const gid = Number((this.guildPanel.querySelector('[data-field="join-guild-id"]') as HTMLInputElement)?.value);
    if (!gid) {
      this.onStatus("请输入军团 ID");
      return;
    }
    this.onStatus("加入军团…");
    try {
      const res = (await this.gateway.joinGuild(sid, gid)) as {
        guild?: { guild_id?: number; name?: string };
      };
      this.guildId = res.guild?.guild_id ?? gid;
      this.guildName = res.guild?.name ?? `军团#${gid}`;
      this.syncGuildSummary();
      await this.refreshMembers();
      this.onStatus(`已加入「${this.guildName}」`);
    } catch (e) {
      this.onStatus(formatSocialGatewayError(e));
    }
  }

  private syncGuildSummary(): void {
    const p = this.guildPanel.querySelector('[data-role="guild-summary"]');
    if (p) p.textContent = formatGuildSummaryText(this.guildId, this.guildName);
  }

  private async refreshMembers(): Promise<void> {
    if (!this.guildId) {
      this.guildListError = "";
      this.renderGuildMembersList([]);
      this.onStatus("请先创建或加入军团");
      return;
    }
    const sid = this.serverId();
    return this.guildListInflight.run(async () => {
      this.syncPanelRefreshUi(this.guildPanel, "guild", "refresh-members", { busy: true });
      this.onStatus("拉取成员…");
      try {
        const res = (await this.gateway.listGuildMembers(sid, this.guildId, 1)) as {
          guild?: { name?: string };
          members?: {
            player_id?: number;
            display_name?: string;
            role?: number;
            power?: number;
            joined_at_ms?: number;
          }[];
        };
        if (res.guild?.name) this.guildName = res.guild.name;
        this.syncGuildSummary();
        this.guildListError = "";
        this.renderGuildMembersList(res.members ?? []);
        const refreshedAt = Date.now();
        writeSocialPanelLastRefreshMs(GUILD_PANEL_LAST_REFRESH_SESSION_KEY, refreshedAt);
        this.syncPanelRefreshUi(this.guildPanel, "guild", "refresh-members", {
          busy: false,
          lastUpdatedMs: refreshedAt,
          error: null,
        });
        this.onStatus(`成员 ${res.members?.length ?? 0} 人`);
      } catch (e) {
        const msg = formatSocialGatewayError(e);
        this.guildListError = msg;
        this.renderGuildMembersList([]);
        this.syncPanelRefreshUi(this.guildPanel, "guild", "refresh-members", {
          busy: false,
          error: gatewayErrorMessage(e),
        });
        this.onStatus(msg);
      }
    });
  }

  private hydrateRankRefreshClockFromSession(): void {
    const boardType = this.selectedLeaderboardType();
    const fromSession = readRankLastRefreshMs(boardType);
    if (fromSession > 0) {
      this.refreshClock.rank.lastUpdatedMs = fromSession;
      this.syncRankLastRefreshBar(boardType);
      this.syncPanelRefreshUi(this.rankPanel, "rank", "refresh-rank", { busy: false });
    }
  }

  private syncRankLastRefreshBar(boardType: number): void {
    const el = this.rankPanel.querySelector('[data-role="rank-last-refresh"]');
    if (!el) return;
    const atMs = this.refreshClock.rank.lastUpdatedMs || readRankLastRefreshMs(boardType);
    const line = formatRankLastRefreshLine(atMs);
    el.textContent = line;
    el.classList.toggle("hidden", !line);
  }

  renderLeaderboardPage(res: LeaderboardPagePayload, boardType: number): void {
    const myEl = this.rankPanel.querySelector('[data-role="viewer-rank"]');
    if (myEl) {
      myEl.textContent = formatViewerRankSummary(
        boardType,
        res.my_rank,
        res.my_score,
        viewerScoreFallback(this.getSession(), boardType),
      );
    }
    this.syncRankLastRefreshBar(boardType);
    const snapEl = this.rankPanel.querySelector('[data-role="rank-snapshot"]');
    if (snapEl) {
      const meta = formatLeaderboardSnapshotMeta(res);
      snapEl.textContent = meta ?? "";
      snapEl.classList.toggle("hidden", !meta);
    }
    const tbody = this.rankPanel.querySelector('[data-role="rank-list"]');
    if (tbody) {
      tbody.innerHTML = "";
      const fallbackScore = viewerScoreFallback(this.getSession(), boardType);
      const pinLine = formatMyRankPinLine(
        res.my_rank,
        res.my_score ?? fallbackScore,
        boardType,
      );
      if (pinLine) {
        const tr = document.createElement("tr");
        tr.className = "rank-pin-row";
        tr.setAttribute("aria-label", "我的排名钉选");
        const td = document.createElement("td");
        td.colSpan = 3;
        const primary = document.createElement("div");
        primary.className = "rank-pin-primary";
        primary.textContent = pinLine;
        td.appendChild(primary);
        const refreshMs = this.refreshClock.rank.lastUpdatedMs || readRankLastRefreshMs(boardType);
        const secondary = formatMyRankPinSecondaryLine(refreshMs);
        if (secondary) {
          const sub = document.createElement("div");
          sub.className = "rank-pin-secondary rank-last-refresh-line";
          sub.textContent = secondary;
          td.appendChild(sub);
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
        if (this.pendingRankPinPulse) {
          scheduleRankMyRankChangedPulse(tr);
        }
      }
      const entries = res.entries ?? [];
      if (entries.length === 0) {
        if (!pinLine) {
          const tr = document.createElement("tr");
          tr.className = socialRankEmptyRowClass();
          const td = document.createElement("td");
          td.colSpan = 3;
          td.textContent = formatSocialRankEmptyMessage();
          tr.appendChild(td);
          tbody.appendChild(tr);
        }
      } else {
        entries.forEach((e, index) => {
          const tr = document.createElement("tr");
          tr.className = "rank-data-row";
          tr.setAttribute("data-rank-entry-index", String(index));
          const entityId = e.entity_id ?? 0;
          if (entityId > 0) {
            tr.id = leaderboardRowDomId(entityId);
            tr.setAttribute("data-entity-id", String(entityId));
            tr.dataset.entityId = String(entityId);
          }
          if (entityId > 0 && entityId === this.rankHighlightEntityId) {
            tr.classList.add("rank-row-highlight");
          }
          const rank = e.rank ?? "?";
          const name =
            e.display_name?.trim() || (e.entity_id ? `玩家#${e.entity_id}` : "?");
          tr.innerHTML = `<td class="rank-col-rank">${rank}</td><td class="rank-col-name">${name}</td><td class="rank-col-score">${e.score ?? 0}</td>`;
          tbody.appendChild(tr);
        });
      }
    }
    this.hideRankEntrySummary();
  }

  private hideRankEntrySummary(): void {
    const box = this.rankPanel.querySelector('[data-role="rank-entry-summary"]');
    box?.classList.add("hidden");
  }

  private showRankEntrySummary(boardType: number, entry: LeaderboardEntryRow): void {
    const box = this.rankPanel.querySelector('[data-role="rank-entry-summary"]');
    const text = this.rankPanel.querySelector('[data-role="rank-entry-summary-text"]');
    if (!box || !text) return;
    text.textContent = formatRankReadonlySummary(boardType, entry);
    box.classList.remove("hidden");
  }

  private viewerPlayerId(): number {
    const s = this.getSession();
    return s?.player?.player_id ?? 0;
  }

  private rankEntryFromRow(tr: HTMLElement): LeaderboardEntryRow | null {
    const index = Number(tr.getAttribute("data-rank-entry-index"));
    if (!Number.isFinite(index) || index < 0) return null;
    const boardType = this.selectedLeaderboardType();
    const page = this.rankSnapshotByType.get(boardType);
    const entry = page?.entries?.[index];
    return entry ?? null;
  }

  private async dispatchRankRowDeepLink(link: RankRowDeepLink, entry: LeaderboardEntryRow): Promise<void> {
    const boardType = this.selectedLeaderboardType();
    switch (link.kind) {
      case "hero": {
        const handler = this.rankDeepLink.onOpenHeroDetail;
        if (!handler) {
          this.onStatus("将领面板未就绪");
          return;
        }
        let heroId = link.heroId;
        if (heroId <= 0) {
          const ids = await this.rankDeepLink.getViewerHeroIds?.();
          heroId = ids?.find((id) => id > 0) ?? 0;
        }
        await handler(heroId);
        return;
      }
      case "world-grid": {
        this.rankDeepLink.onOpenWorldAtGrid?.(link.gridX, link.gridY);
        return;
      }
      case "world-viewer": {
        this.rankDeepLink.onOpenWorldViewer?.();
        return;
      }
      case "summary": {
        this.showRankEntrySummary(boardType, entry);
        return;
      }
      case "toast": {
        this.onStatus(link.message);
        return;
      }
      default:
        return;
    }
  }

  private async onRankRowActivate(tr: HTMLElement): Promise<void> {
    const entry = this.rankEntryFromRow(tr);
    if (!entry) return;
    const boardType = this.selectedLeaderboardType();
    const viewerId = this.viewerPlayerId();
    const heroIds = await this.rankDeepLink.getViewerHeroIds?.();
    const link = resolveRankRowDeepLink(boardType, entry, viewerId, heroIds ?? []);
    await this.dispatchRankRowDeepLink(link, entry);
  }

  private async refreshRank(): Promise<void> {
    const sid = this.serverId();
    const boardType = this.selectedLeaderboardType();
    return this.rankListInflight.run(async () => {
      this.syncPanelRefreshUi(this.rankPanel, "rank", "refresh-rank", { busy: true });
      this.onStatus("拉取排行榜…");
      try {
        const prevSnapshot = this.rankSnapshotByType.get(boardType);
        const res = (await this.gateway.getLeaderboard(sid, boardType, 1, 20)) as LeaderboardPagePayload;
        this.pendingRankPinPulse = detectLeaderboardMyRankChange(prevSnapshot?.my_rank, res.my_rank);
        this.rankSnapshotByType.set(boardType, res);
        const refreshedAt = Date.now();
        writeRankLastRefreshMs(boardType, refreshedAt);
        this.renderLeaderboardPage(res, boardType);
        this.pendingRankPinPulse = false;
        this.syncPanelRefreshUi(this.rankPanel, "rank", "refresh-rank", {
          busy: false,
          lastUpdatedMs: refreshedAt,
          error: null,
          stale: false,
        });
        this.onStatus("排行榜已刷新");
      } catch (e) {
        const msg = formatSocialGatewayError(e);
        const refreshErr = gatewayErrorMessage(e);
        const cached = this.rankSnapshotByType.get(boardType);
        if (cached) {
          this.renderLeaderboardPage(cached, boardType);
          this.syncPanelRefreshUi(this.rankPanel, "rank", "refresh-rank", {
            busy: false,
            error: refreshErr,
            stale: true,
          });
        } else {
          this.syncPanelRefreshUi(this.rankPanel, "rank", "refresh-rank", {
            busy: false,
            error: refreshErr,
            stale: false,
          });
        }
        this.onStatus(msg);
      }
    });
  }

  private onChatClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "send-chat") void this.sendChat();
    if (a === "refresh-chat" || a === "retry-refresh-chat") void this.refreshChat();
    if (a === "navigate-guild-panel") this.openGuildPanel();
    if (a === "pick-chat-channel") {
      const ch = Number(btn.getAttribute("data-chat-channel") ?? CHAT_CHANNEL_WORLD);
      const sel = this.chatPanel.querySelector('[data-field="channel"]') as HTMLSelectElement | null;
      if (sel) {
        sel.value = String(ch);
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        this.syncChatChannelUi(ch);
        this.syncChatChannelTabUi(ch);
        if (!this.chatPanel.classList.contains("hidden")) void this.refreshChat();
      }
    }
  }

  private onGuildClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "create-guild") void this.createGuild();
    if (a === "join-guild") void this.joinGuild();
    if (a === "refresh-members" || a === "retry-refresh-members") void this.refreshMembers();
    if (a === "guild-mention") {
      const name = btn.getAttribute("data-display-name") ?? "";
      this.openChatWithGuildMentionDraft(name);
    }
    if (a === "toggle-guild-role-group") {
      const roleKey = Number(btn.getAttribute("data-role-key"));
      if (!Number.isFinite(roleKey)) return;
      const next = !this.isGuildRoleGroupExpanded(roleKey);
      this.guildRoleGroupExpanded.set(roleKey, next);
      this.renderGuildMembersList(this.guildMembersCache);
    }
    if (a === "open-guild-chat-channel") this.openGuildChatChannel();
  }

  private onRankClick(ev: Event): void {
    const row = (ev.target as HTMLElement).closest("tr.rank-data-row");
    if (row) {
      void this.onRankRowActivate(row as HTMLElement);
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-rank" || a === "retry-refresh-rank") void this.refreshRank();
    if (a === "dismiss-rank-summary") this.hideRankEntrySummary();
  }
}
