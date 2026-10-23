import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { guildRoleLabel, leaderboardTypeLabel } from "@/net/socialFormat";

const CH_WORLD = 1;
const CH_PRIVATE = 2;
const CH_GUILD = 3;
const LB_PLAYER_POWER = 1;

type ChatLine = {
  sender_display_name?: string;
  content?: string;
  sent_at_ms?: number;
};

export class SocialPanels {
  private chatPanel!: HTMLElement;
  private guildPanel!: HTMLElement;
  private rankPanel!: HTMLElement;
  private guildId = 0;
  private guildName = "";

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
      (this.chatPanel.querySelector('[data-field="channel"]') as HTMLSelectElement)?.value ?? CH_WORLD,
    );
  }

  private syncChatChannelUi(ch: number): void {
    this.chatPanel.querySelector(".private-target")?.classList.toggle("hidden", ch !== CH_PRIVATE);
    this.chatPanel.querySelector('[data-role="guild-chat-hint"]')?.classList.toggle("hidden", ch !== CH_GUILD);
  }

  private chatListOpts(ch: number): { peerPlayerId?: number; guildId?: number } {
    if (ch === CH_PRIVATE) {
      const peer = Number((this.chatPanel.querySelector('[data-field="peer-id"]') as HTMLInputElement)?.value ?? 0);
      return { peerPlayerId: peer };
    }
    if (ch === CH_GUILD) {
      return { guildId: this.guildId };
    }
    return {};
  }

  private chatSendOpts(ch: number): { recipientPlayerId?: number; guildId?: number } {
    if (ch === CH_PRIVATE) {
      const peer = Number((this.chatPanel.querySelector('[data-field="peer-id"]') as HTMLInputElement)?.value ?? 0);
      return { recipientPlayerId: peer };
    }
    if (ch === CH_GUILD) {
      return { guildId: this.guildId };
    }
    return {};
  }

  private ensureGuildChatReady(ch: number): boolean {
    if (ch !== CH_GUILD) return true;
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

  private buildRankPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "social-panel hidden";
    el.innerHTML = `
      <h3>排行榜</h3>
      <p data-role="my-rank">我的名次：—</p>
      <button type="button" data-action="refresh-rank">刷新战力榜</button>
      <ol class="rank-list" data-role="rank-list"></ol>
    `;
    return el;
  }

  private async refreshChat(): Promise<void> {
    const sid = this.serverId();
    const ch = this.selectedChatChannel();
    if (!this.ensureGuildChatReady(ch)) return;
    this.onStatus("拉取聊天…");
    try {
      const res = (await this.gateway.listChatMessages(sid, ch, {
        ...this.chatListOpts(ch),
        limit: 30,
      })) as { messages?: ChatLine[] };
      this.renderChatLog(res.messages ?? []);
      this.onStatus("聊天已刷新");
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private renderChatLog(messages: ChatLine[]): void {
    const ul = this.chatPanel.querySelector('[data-role="chat-log"]');
    if (!ul) return;
    ul.innerHTML = "";
    const sorted = [...messages].sort((a, b) => (a.sent_at_ms ?? 0) - (b.sent_at_ms ?? 0));
    for (const m of sorted) {
      const li = document.createElement("li");
      const who = m.sender_display_name ?? "未知";
      li.textContent = `${who}: ${m.content ?? ""}`;
      ul.appendChild(li);
    }
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
      this.onStatus((e as Error).message);
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
      this.onStatus((e as Error).message);
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
      this.onStatus((e as Error).message);
    }
  }

  private syncGuildSummary(): void {
    const p = this.guildPanel.querySelector('[data-role="guild-summary"]');
    if (p) {
      p.textContent = this.guildId
        ? `当前军团：${this.guildName} (#${this.guildId})`
        : "尚未加入军团";
    }
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
        members?: { display_name?: string; role?: number; power?: number }[];
      };
      if (res.guild?.name) this.guildName = res.guild.name;
      this.syncGuildSummary();
      const ul = this.guildPanel.querySelector('[data-role="guild-members"]');
      if (ul) {
        ul.innerHTML = "";
        for (const m of res.members ?? []) {
          const li = document.createElement("li");
          li.textContent = `${m.display_name ?? "?"} · ${guildRoleLabel(m.role)} · 战力 ${m.power ?? 0}`;
          ul.appendChild(li);
        }
      }
      this.onStatus(`成员 ${res.members?.length ?? 0} 人`);
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async refreshRank(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取排行榜…");
    try {
      const res = (await this.gateway.getLeaderboard(sid, LB_PLAYER_POWER, 1, 20)) as {
        entries?: { rank?: number; display_name?: string; score?: number }[];
        my_rank?: number;
        my_score?: number;
      };
      const myEl = this.rankPanel.querySelector('[data-role="my-rank"]');
      if (myEl) {
        const me = this.getSession()?.player;
        myEl.textContent =
          res.my_rank && res.my_rank > 0
            ? `我的名次：第 ${res.my_rank} 名 · 战力 ${res.my_score ?? me?.power ?? 0}（${leaderboardTypeLabel(LB_PLAYER_POWER)}）`
            : `未上榜 · 战力 ${res.my_score ?? me?.power ?? 0}`;
      }
      const ol = this.rankPanel.querySelector('[data-role="rank-list"]');
      if (ol) {
        ol.innerHTML = "";
        for (const e of res.entries ?? []) {
          const li = document.createElement("li");
          li.textContent = `${e.rank ?? "?"}. ${e.display_name ?? "?"} · ${e.score ?? 0}`;
          ol.appendChild(li);
        }
      }
      this.onStatus("排行榜已刷新");
    } catch (e) {
      this.onStatus((e as Error).message);
    }
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
