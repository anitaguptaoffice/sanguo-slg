import { formatTimeMs } from "@/net/militaryFormat";

export const CHAT_CHANNEL_WORLD = 1;
export const CHAT_CHANNEL_PRIVATE = 2;
export const CHAT_CHANNEL_GUILD = 3;

/** 网关社交域错误码 → 状态栏中文摘要（与 spec/common ErrorCode、WIRE-001 对齐）。 */
const SOCIAL_ERROR_HINT: Record<number, string> = {
  60001: "军团不存在",
  60002: "已在其他军团",
  60003: "不在该军团",
  60004: "军团名称不合法",
  60005: "军团名称已被占用",
  60006: "军团人数已满",
  60007: "军团权限不足",
  60008: "团长须先转让或解散",
  61001: "无权使用该聊天频道",
  61002: "消息过长",
  61003: "发送过于频繁",
  61004: "私聊目标不存在",
  61005: "军团频道需要先加入军团",
  61006: "已被禁言",
};

export type ChatMessageRow = {
  channel?: number;
  sender_display_name?: string;
  sender_player_id?: number;
  content?: string;
  sent_at_ms?: number;
};

export type GuildMemberRow = {
  display_name?: string;
  role?: number;
  power?: number;
  joined_at_ms?: number;
};

export type GameServerRow = {
  server_id?: number;
  display_name?: string;
  status?: number;
  online_count?: number;
  has_player?: boolean;
};

export function parseGameServerInfo(raw: {
  shard?: { server_id?: number; display_name?: string; status?: number };
  online_count?: number;
  has_player?: boolean;
}): GameServerRow {
  return {
    server_id: raw.shard?.server_id,
    display_name: raw.shard?.display_name,
    status: raw.shard?.status,
    online_count: raw.online_count,
    has_player: raw.has_player,
  };
}

export function serverStatusLabel(status?: number): string {
  switch (status) {
    case 0:
      return "维护";
    case 1:
      return "流畅";
    case 2:
      return "火爆";
    case 3:
      return "停服";
    default:
      return "未知";
  }
}

export function formatServerLine(s: GameServerRow): string {
  const id = s.server_id ?? "?";
  const name = s.display_name ?? `服${id}`;
  const role = s.has_player ? "有角色" : "无角色";
  return `${name} (#${id}) · ${serverStatusLabel(s.status)} · 在线≈${s.online_count ?? 0} · ${role}`;
}

export function chatChannelLabel(channel?: number): string {
  switch (channel) {
    case CHAT_CHANNEL_WORLD:
      return "世界";
    case CHAT_CHANNEL_PRIVATE:
      return "私聊";
    case CHAT_CHANNEL_GUILD:
      return "军团";
    default:
      return channel ? `频道${channel}` : "—";
  }
}

export function formatSenderLabel(displayName?: string, playerId?: number): string {
  const name = displayName?.trim() || "未知";
  if (playerId && playerId > 0) return `${name} (#${playerId})`;
  return name;
}

/** 聊天列表单行：频道 · 本地时间 · 发送者 · 正文。 */
export function formatChatLogLine(msg: ChatMessageRow): string {
  const ch = chatChannelLabel(msg.channel);
  const time = formatTimeMs(msg.sent_at_ms);
  const who = formatSenderLabel(msg.sender_display_name, msg.sender_player_id);
  const body = msg.content ?? "";
  return `[${ch}] ${time} · ${who}: ${body}`;
}

export function formatGuildSummaryText(guildId: number, guildName: string): string {
  if (!guildId) return "尚未加入军团";
  const name = guildName.trim() || `军团#${guildId}`;
  return `当前军团：${name} (#${guildId})`;
}

export function formatGuildMemberLine(member: GuildMemberRow): string {
  const parts = [
    member.display_name ?? "?",
    guildRoleLabel(member.role),
    `战力 ${member.power ?? 0}`,
  ];
  if (member.joined_at_ms) {
    parts.push(`加入 ${formatTimeMs(member.joined_at_ms)}`);
  }
  return parts.join(" · ");
}

export function formatSocialGatewayError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as Error & { code?: number }).code;
  const hint = code ? SOCIAL_ERROR_HINT[code] : undefined;
  if (code && hint) {
    const tail = err.message && err.message !== hint ? `：${err.message}` : "";
    return `${hint} (code=${code})${tail}`;
  }
  if (code) return `操作失败 (code=${code})：${err.message}`;
  return err.message;
}

export function guildRoleLabel(role?: number): string {
  switch (role) {
    case 1:
      return "团长";
    case 2:
      return "官员";
    case 3:
      return "成员";
    default:
      return "—";
  }
}

export function leaderboardTypeLabel(type?: number): string {
  switch (type) {
    case 1:
      return "玩家战力";
    case 2:
      return "玩家资源";
    case 3:
      return "军团战力";
    default:
      return "排行榜";
  }
}
