import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import {
  formatLeaderboardEmptyHint,
  formatLeaderboardSnapshotMeta,
  formatViewerRankSummary,
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  selectedLeaderboardTypeFromValue,
  viewerScoreFallback,
  type LeaderboardPagePayload,
} from "@/net/leaderboardFormat";
import {
  CHAT_CHANNEL_GUILD,
  CHAT_CHANNEL_PRIVATE,
  CHAT_CHANNEL_WORLD,
  chatChannelLabel,
  formatGuildMemberLine,
  formatGuildSummaryText,
  formatSenderLabel,
  formatSocialGatewayError,
  groupChatMessagesByLocalDay,
  sortGuildMembers,
  type ChatMessageRow,
} from "@/net/socialFormat";
import { formatTimeMs } from "@/net/militaryFormat";
import { SocialPanelInflight } from "@/net/socialPanelInflight";
import {
  formatSocialPanelLastUpdated,
  formatSocialPanelRefreshError,
} from "@/net/socialRefreshFormat";

export class SocialPanels {
  private chatPanel!: HTMLElement;
  private guildPanel!: HTMLElement;
  private rankPanel!: HTMLElement;
  private guildId = 0;
  private guildName = "";
  private readonly chatListInflight = new SocialPanelInflight<void>();
  private readonly rankListInflight = new SocialPanelInflight<void>();
  private chatLastUpdatedMs = 0;
  private rankLastUpdatedMs = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onStatus: (msg: string) => void,
  ) {}

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
    if (!this.chatPanel.classList.contains("hidden")) void this.refreshChat();
  }

  toggleGuild(): void {
    this.guildPanel.classList.toggle("hidden");
    if (!this.guildPanel.classList.contains("hidden")) this.syncGuildSummary();
  }

  toggleRank(): void {
    this.rankPanel.classList.toggle("hidden");
    if (!this.rankPanel.classList.contains("hidden")) void this.refreshRank();
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
    el.innerHTML = `
      <h3>聊天</h3>
      <label>频道
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
      <ul class="chat-log" data-role="chat-log"></ul>
      <label>内容 <input type="text" data-field="chat-content" maxlength="120" placeholder="输入消息" /></label>
      <button type="button" data-action="send-chat">发送</button>
      <button type="button" data-action="refresh-chat">刷新</button>
      <p class="social-refresh-status" data-role="chat-refresh-status" hidden></p>
    `;
    el.querySelector('[data-field="channel"]')?.addEventListener("change", (ev) => {
      this.syncChatChannelUi(Number((ev.target as HTMLSelectElement).value));
    });
    return el;
  }

  private buildGuildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "social-panel hidden";
    el.innerHTML = `
      <h3>军团</h3>
      <p data-role="guild-summary">尚未加入军团</p>
      <label>军团名称 <input type="text" data-field="guild-name" placeholder="新建军团名" /></label>
      <button type="button" data-action="create-guild">创建军团</button>
      <label>军团 ID <input type="number" data-field="join-guild-id" min="1" /></label>
      <button type="button" data-action="join-guild">加入军团</button>
      <button type="button" data-action="refresh-members">刷新成员</button>
      <ul class="guild-members" data-role="guild-members"></ul>
    `;
    return el;
  }

  selectedLeaderboardType(): number {
    const raw = (this.rankPanel.querySelector('[data-field="rank-type"]') as HTMLSelectElement)?.value ?? LB_PLAYER_POWER;
    return selectedLeaderboardTypeFromValue(raw);
  }

  private buildRankPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "social-panel hidden";
    el.innerHTML = `
      <h3>排行榜</h3>
      <label>榜单
        <select data-field="rank-type">
          <option value="${LB_PLAYER_POWER}">玩家战力</option>
          <option value="${LB_PLAYER_RESOURCE}">玩家资源总量</option>
        </select>
      </label>
      <button type="button" data-action="refresh-rank">刷新排行榜</button>
      <p class="social-refresh-status" data-role="rank-refresh-status" hidden></p>
      <div class="rank-board" data-role="rank-board">
        <div class="rank-viewer-bar" data-role="viewer-rank" aria-label="我的名次">我的名次：—</div>
        <p class="rank-snapshot-meta hidden" data-role="rank-snapshot"></p>
        <div class="rank-table-scroll">
          <table class="rank-table">
            <thead class="rank-table-head">
              <tr><th>名次</th><th>玩家</th><th>分数</th></tr>
            </thead>
            <tbody data-role="rank-list"></tbody>
          </table>
        </div>
      </div>
    `;
    return el;
  }

  private syncChatRefreshUi(opts: { busy: boolean; lastUpdatedMs?: number; error?: string | null }): void {
    const btn = this.chatPanel.querySelector<HTMLButtonElement>('[data-action="refresh-chat"]');
    if (btn) btn.disabled = opts.busy;
    const status = this.chatPanel.querySelector('[data-role="chat-refresh-status"]');
    if (!status) return;
    if (opts.lastUpdatedMs) this.chatLastUpdatedMs = opts.lastUpdatedMs;
    if (opts.error) {
      status.textContent = formatSocialPanelRefreshError(opts.error);
      status.classList.add("social-refresh-error");
      status.hidden = false;
      return;
    }
    status.classList.remove("social-refresh-error");
    if (this.chatLastUpdatedMs > 0) {
      status.textContent = formatSocialPanelLastUpdated(this.chatLastUpdatedMs);
      status.hidden = false;
    } else if (!opts.busy) {
      status.textContent = "";
      status.hidden = true;
    }
  }

  private syncRankRefreshUi(opts: { busy: boolean; lastUpdatedMs?: number; error?: string | null }): void {
    const btn = this.rankPanel.querySelector<HTMLButtonElement>('[data-action="refresh-rank"]');
    if (btn) btn.disabled = opts.busy;
    const status = this.rankPanel.querySelector('[data-role="rank-refresh-status"]');
    if (!status) return;
    if (opts.lastUpdatedMs) this.rankLastUpdatedMs = opts.lastUpdatedMs;
    if (opts.error) {
      status.textContent = formatSocialPanelRefreshError(opts.error);
      status.classList.add("social-refresh-error");
      status.hidden = false;
      return;
    }
    status.classList.remove("social-refresh-error");
    if (this.rankLastUpdatedMs > 0) {
      status.textContent = formatSocialPanelLastUpdated(this.rankLastUpdatedMs);
      status.hidden = false;
    } else if (!opts.busy) {
      status.textContent = "";
      status.hidden = true;
    }
  }

  private async refreshChat(): Promise<void> {
    const sid = this.serverId();
    const ch = this.selectedChatChannel();
    if (!this.ensureGuildChatReady(ch)) return;
    return this.chatListInflight.run(async () => {
      this.syncChatRefreshUi({ busy: true });
      this.onStatus("拉取聊天…");
      try {
        const res = (await this.gateway.listChatMessages(sid, ch, {
          ...this.chatListOpts(ch),
          limit: 30,
        })) as { messages?: ChatMessageRow[] };
        this.renderChatLog(res.messages ?? []);
        this.syncChatRefreshUi({ busy: false, lastUpdatedMs: Date.now(), error: null });
        this.onStatus("聊天已刷新");
      } catch (e) {
        const msg = formatSocialGatewayError(e);
        this.syncChatRefreshUi({ busy: false, error: msg });
        this.onStatus(msg);
      }
    });
  }

  private renderChatLog(messages: ChatMessageRow[]): void {
    const ul = this.chatPanel.querySelector('[data-role="chat-log"]');
    if (!ul) return;
    ul.innerHTML = "";
    const groups = groupChatMessagesByLocalDay(messages);
    for (const g of groups) {
      const head = document.createElement("li");
      head.className = "chat-day-header";
      head.textContent = g.title;
      ul.appendChild(head);
      for (const m of g.messages) {
        ul.appendChild(this.buildChatMessageRow(m));
      }
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
      this.onStatus("请先创建或加入军团");
      return;
    }
    const sid = this.serverId();
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
      const ul = this.guildPanel.querySelector('[data-role="guild-members"]');
      if (ul) {
        ul.innerHTML = "";
        for (const m of sortGuildMembers(res.members ?? [])) {
          const li = document.createElement("li");
          li.textContent = formatGuildMemberLine(m);
          ul.appendChild(li);
        }
      }
      this.onStatus(`成员 ${res.members?.length ?? 0} 人`);
    } catch (e) {
      this.onStatus(formatSocialGatewayError(e));
    }
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
    const snapEl = this.rankPanel.querySelector('[data-role="rank-snapshot"]');
    if (snapEl) {
      const meta = formatLeaderboardSnapshotMeta(res);
      snapEl.textContent = meta ?? "";
      snapEl.classList.toggle("hidden", !meta);
    }
    const tbody = this.rankPanel.querySelector('[data-role="rank-list"]');
    if (tbody) {
      tbody.innerHTML = "";
      const entries = res.entries ?? [];
      if (entries.length === 0) {
        const tr = document.createElement("tr");
        tr.className = "rank-empty-row";
        const td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = formatLeaderboardEmptyHint();
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        for (const e of entries) {
          const tr = document.createElement("tr");
          const rank = e.rank ?? "?";
          const name =
            e.display_name?.trim() || (e.entity_id ? `玩家#${e.entity_id}` : "?");
          tr.innerHTML = `<td class="rank-col-rank">${rank}</td><td class="rank-col-name">${name}</td><td class="rank-col-score">${e.score ?? 0}</td>`;
          tbody.appendChild(tr);
        }
      }
    }
  }

  private async refreshRank(): Promise<void> {
    const sid = this.serverId();
    const boardType = this.selectedLeaderboardType();
    return this.rankListInflight.run(async () => {
      this.syncRankRefreshUi({ busy: true });
      this.onStatus("拉取排行榜…");
      try {
        const res = (await this.gateway.getLeaderboard(sid, boardType, 1, 20)) as LeaderboardPagePayload;
        this.renderLeaderboardPage(res, boardType);
        this.syncRankRefreshUi({ busy: false, lastUpdatedMs: Date.now(), error: null });
        this.onStatus("排行榜已刷新");
      } catch (e) {
        const msg = formatSocialGatewayError(e);
        this.syncRankRefreshUi({ busy: false, error: msg });
        this.onStatus(msg);
      }
    });
  }

  private onChatClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "send-chat") void this.sendChat();
    if (a === "refresh-chat") void this.refreshChat();
  }

  private onGuildClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "create-guild") void this.createGuild();
    if (a === "join-guild") void this.joinGuild();
    if (a === "refresh-members") void this.refreshMembers();
  }

  private onRankClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "refresh-rank") void this.refreshRank();
  }
}
