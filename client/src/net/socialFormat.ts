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
  player_id?: number;
  display_name?: string;
  role?: number;
  power?: number;
  joined_at_ms?: number;
  /** 可选：ListGuildMembers 成员在线 hint（无字段时由列表计数回退）。 */
  is_online?: boolean;
};

/** 从成员行统计在线人数（`is_online === true`）。 */
export function countGuildMembersOnline(members: GuildMemberRow[]): number {
  let n = 0;
  for (const m of members) {
    if (m.is_online === true) n += 1;
  }
  return n;
}

export type GuildMemberOnlineSummaryInput = {
  members: GuildMemberRow[];
  /** ListGuildMembersResponse.total_count；缺省为 members.length。 */
  totalCount?: number;
  /** 网关在线计数 hint；缺省为 countGuildMembersOnline(members)。 */
  onlineCount?: number;
};

/** 军团成员列表头只读在线/总数摘要（同源成员列表字段，无新 RPC）。 */
export function formatGuildMemberOnlineSummaryLine(input: GuildMemberOnlineSummaryInput): string {
  const total = Math.max(0, input.totalCount ?? input.members.length);
  const online =
    input.onlineCount !== undefined && input.onlineCount >= 0
      ? input.onlineCount
      : countGuildMembersOnline(input.members);
  return `在线 ${online} / 共 ${total} 人`;
}

/** 成员列表头 DOM class（CLIENT-217）。 */
export const GUILD_MEMBER_ONLINE_SUMMARY_CLASS = "guild-member-online-summary";

export type ChatDayGroup = {
  dayKey: string;
  title: string;
  messages: ChatMessageRow[];
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
  if (playerId && playerId > 0) return `${name} (${truncatePlayerId(playerId)})`;
  return name;
}

/** 列表行展示用：长 ID 保留末 4 位，避免撑破窄面板。 */
export function truncatePlayerId(playerId: number): string {
  if (!Number.isFinite(playerId) || playerId <= 0) return "#?";
  const s = String(Math.trunc(playerId));
  if (s.length <= 6) return `#${s}`;
  return `#…${s.slice(-4)}`;
}

/** 职务排序键：团长(1) → 官员(2) → 成员(3) → 未知(99)。 */
export function guildRoleSortKey(role?: number): number {
  if (role === 1 || role === 2 || role === 3) return role;
  return 99;
}

export function sortGuildMembers<T extends GuildMemberRow>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const dr = guildRoleSortKey(a.role) - guildRoleSortKey(b.role);
    if (dr !== 0) return dr;
    return (b.power ?? 0) - (a.power ?? 0);
  });
}

export type GuildMembersByRoleGroup<T extends GuildMemberRow = GuildMemberRow> = {
  roleKey: number;
  label: string;
  members: T[];
};

/** CLIENT-185：职务分组头主标题（人数由 DOM `guild-role-group-count` 展示）。 */
export function formatGuildRoleGroupHeaderLabel(label: string, expanded: boolean): string {
  const title = label.trim() || "—";
  return `${expanded ? "▼" : "▶"} ${title}`;
}

function guildRoleGroupMemberCount(memberCount: number): number {
  const n = Number.isFinite(memberCount) ? memberCount : 0;
  return Math.max(0, Math.trunc(n));
}

/** CLIENT-234：职务分组头扫读整行（折叠符 + 职务 + 只读人数，无新 RPC）。 */
export function formatGuildRoleGroupHeaderLine(
  label: string,
  expanded: boolean,
  memberCount: number,
): string {
  const n = guildRoleGroupMemberCount(memberCount);
  return `${formatGuildRoleGroupHeaderLabel(label, expanded)} · ${n} 人`;
}

/** CLIENT-234：`guild-role-group-count` chip 只读人数（与 `formatGuildRoleGroupHeaderLine` 同口径）。 */
export function formatGuildRoleGroupCountLabel(memberCount: number): string {
  return String(guildRoleGroupMemberCount(memberCount));
}

/** 按职务分组（组内已按 sortGuildMembers 排序）；空输入返回空数组。 */
export function groupGuildMembersByRole<T extends GuildMemberRow>(members: T[]): GuildMembersByRoleGroup<T>[] {
  const sorted = sortGuildMembers(members);
  const groups: GuildMembersByRoleGroup<T>[] = [];
  for (const m of sorted) {
    const roleKey = guildRoleSortKey(m.role);
    const last = groups[groups.length - 1];
    if (last && last.roleKey === roleKey) {
      last.members.push(m);
    } else {
      groups.push({ roleKey, label: guildRoleLabel(m.role), members: [m] });
    }
  }
  return groups;
}

/** 职务分组折叠默认：仅团长组展开（CLIENT-101）。 */
export function guildRoleGroupDefaultExpanded(roleKey: number): boolean {
  return roleKey === 1;
}

/** 成员行职务 chip 的 class（与 march-phase-chip 密度对齐）。 */
export function guildRoleChipClass(role?: number): string {
  const base = "guild-role-chip";
  switch (role) {
    case 1:
      return `${base} guild-role-chip-leader`;
    case 2:
      return `${base} guild-role-chip-officer`;
    case 3:
      return `${base} guild-role-chip-member`;
    default:
      return `${base} guild-role-chip-unknown`;
  }
}

/** 本地日历日键（YYYY-MM-DD），用于聊天分组。 */
export function localCalendarDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 分组标题：今日 / 昨日 / 其它本地日期。 */
export function formatChatDayGroupTitle(dayKey: string, nowMs = Date.now()): string {
  const todayKey = localCalendarDayKey(nowMs);
  if (dayKey === todayKey) return "今日";
  const yesterday = new Date(nowMs);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === localCalendarDayKey(yesterday.getTime())) return "昨日";
  const [y, m, d] = dayKey.split("-").map((x) => Number(x));
  if (y && m && d) return `${m}月${d}日`;
  return dayKey;
}

export function groupChatMessagesByLocalDay(
  messages: ChatMessageRow[],
  nowMs = Date.now(),
): ChatDayGroup[] {
  const sorted = [...messages].sort((a, b) => (a.sent_at_ms ?? 0) - (b.sent_at_ms ?? 0));
  const groups: ChatDayGroup[] = [];
  for (const msg of sorted) {
    const ms = msg.sent_at_ms ?? 0;
    const dayKey = ms > 0 ? localCalendarDayKey(ms) : "unknown";
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.messages.push(msg);
    } else {
      groups.push({
        dayKey,
        title: dayKey === "unknown" ? "更早" : formatChatDayGroupTitle(dayKey, nowMs),
        messages: [msg],
      });
    }
  }
  return groups;
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

/** 军团成员「提到」填入聊天框的草稿前缀（末尾留空格，不发送）。 */
export function formatGuildMentionDraft(displayName: string): string {
  const name = displayName.trim() || "?";
  return `@${name} `;
}

/** 成员行主行：昵称（CLIENT-144 职务标签由 DOM chip 展示）。 */
export function formatGuildMemberPrimaryNick(member: GuildMemberRow): string {
  return (member.display_name ?? "?").trim() || "?";
}

/** 成员行次行：玩家 id 截断、战力与加入时间。 */
export function formatGuildMemberSecondaryLine(member: GuildMemberRow): string {
  const parts: string[] = [];
  if (member.player_id && member.player_id > 0) {
    parts.push(truncatePlayerId(member.player_id));
  }
  parts.push(`战力 ${member.power ?? 0}`);
  if (member.joined_at_ms) {
    parts.push(`加入 ${formatTimeMs(member.joined_at_ms)}`);
  }
  return parts.join(" · ");
}

export function formatGuildMemberLine(member: GuildMemberRow, opts?: { includeRoleLabel?: boolean }): string {
  const name = formatGuildMemberPrimaryNick(member);
  const who =
    member.player_id && member.player_id > 0 ? `${name} ${truncatePlayerId(member.player_id)}` : name;
  const parts = [who];
  if (opts?.includeRoleLabel !== false) {
    parts.push(guildRoleLabel(member.role));
  }
  parts.push(`战力 ${member.power ?? 0}`);
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

/** 社交面板空列表行 class（排行/军团/聊天统一密度，CLIENT-053）。 */
export const SOCIAL_LIST_EMPTY_CLASS = "social-list-empty";

export function socialChatEmptyListClass(): string {
  return SOCIAL_LIST_EMPTY_CLASS;
}

export function socialGuildMembersEmptyListClass(): string {
  return SOCIAL_LIST_EMPTY_CLASS;
}

export function socialRankEmptyRowClass(): string {
  return "rank-empty-row";
}

/** 聊天真空列表（与 CLIENT-045「刷新」按钮并存）。 */
export function formatSocialChatEmptyMessage(): string {
  return "暂无消息，请点「刷新」拉取记录，或通过下方输入框发送";
}

/** 已入团但成员列表为空。 */
export function formatSocialGuildMembersEmptyMessage(): string {
  return "暂无成员，请点「刷新成员」同步列表";
}

export type GuildPanelEmptySurface = "guildMembers" | "chat";

/**
 * 军团成员 / 聊天列表 empty 文案（CLIENT-053 统一 `SOCIAL_LIST_EMPTY_CLASS` + CLIENT-200 扫读）。
 * 与网关 error 态分离：error 走 CLIENT-173 + 行内重试。
 */
export function formatGuildPanelEmptyHint(
  surface: GuildPanelEmptySurface,
  options?: { guildJoined?: boolean },
): string {
  const joined = options?.guildJoined ?? true;
  if (surface === "guildMembers") {
    if (!joined) {
      return `${formatSocialGuildNotJoinedReadonlyMessage()}可在本面板下方创建或加入军团。`;
    }
    return formatSocialGuildMembersEmptyMessage();
  }
  if (!joined) {
    return formatSocialGuildNotJoinedReadonlyMessage();
  }
  return formatSocialChatEmptyMessage();
}

/** 排行双榜空榜（含 dev 无种子提示与刷新引导）。 */
export function formatSocialRankEmptyMessage(): string {
  return "（空榜）暂无上榜数据，请点「刷新排行榜」拉取；dev 环境可能未写入排行种子，可对照 Scheduler / smoke 造数。";
}

/** 列表加载失败时行内摘要（状态栏仍用 formatSocialPanelRefreshError）。 */
export function formatSocialPanelListRefreshHint(): string {
  return "请点「刷新」重试";
}

/** 刷新失败但仍展示上次成功快照时的标注。 */
export function formatSocialPanelStaleDataLabel(): string {
  return "数据可能已过期";
}

/** 未加入军团时的只读说明。 */
export function formatSocialGuildNotJoinedReadonlyMessage(): string {
  return "尚未加入军团，军团频道与成员列表不可用。";
}

export function formatSocialGuildTabNavigateLabel(): string {
  return "前往军团";
}
