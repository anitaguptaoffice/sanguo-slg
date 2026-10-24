import {
  CHAT_CHANNEL_GUILD,
  CHAT_CHANNEL_WORLD,
  type ChatMessageRow,
} from "@/net/socialFormat";

/** localStorage：各聊天频道已读上界 sent_at_ms（CLIENT-102，无服务端 read cursor）。 */
export const CHAT_LAST_READ_TS_STORAGE_KEY = "chat-last-read-ts";

export type ChatLastReadMap = Record<string, number>;

export type ChatChannelSnapshot = {
  key: string;
  channel: number;
  messages: readonly ChatMessageRow[];
};

export type ChatUnreadSummary = {
  world: number;
  guild: number;
  total: number;
  byChannel: Record<string, number>;
};

export function chatChannelStorageKey(channel: number, guildId = 0): string {
  if (channel === CHAT_CHANNEL_GUILD) return `guild:${Math.max(0, guildId)}`;
  if (channel === CHAT_CHANNEL_WORLD) return "world";
  return `channel:${channel}`;
}

export function parseChatLastReadMap(raw: string | null | undefined): ChatLastReadMap {
  if (raw == null || raw === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ChatLastReadMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (k && Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function readChatLastReadMap(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): ChatLastReadMap {
  try {
    return parseChatLastReadMap(storage?.getItem(CHAT_LAST_READ_TS_STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
}

export function writeChatLastReadMap(
  map: ChatLastReadMap,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): void {
  try {
    storage?.setItem(CHAT_LAST_READ_TS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode
  }
}

export function countChatMessagesAfterTs(
  messages: readonly ChatMessageRow[],
  lastReadMs: number,
): number {
  let n = 0;
  for (const m of messages) {
    const t = m.sent_at_ms ?? 0;
    if (t > lastReadMs) n++;
  }
  return n;
}

/** CLIENT-161：单频道未读条数（与角标 `estimateChatUnread` 同口径）。 */
export function estimateChatUnreadCount(
  messages: readonly ChatMessageRow[],
  lastReadMs: number,
): number {
  return countChatMessagesAfterTs(messages, lastReadMs);
}

export function sortChatMessagesChronological(
  messages: readonly ChatMessageRow[],
): ChatMessageRow[] {
  return [...messages].sort((a, b) => (a.sent_at_ms ?? 0) - (b.sent_at_ms ?? 0));
}

/**
 * CLIENT-161：按时间升序消息列表中，未读分隔线应插在的首条未读下标；无未读返回 -1。
 */
export function chatUnreadDividerFlatIndex(
  messages: readonly ChatMessageRow[],
  lastReadMs: number,
): number {
  const sorted = sortChatMessagesChronological(messages);
  for (let i = 0; i < sorted.length; i++) {
    if ((sorted[i].sent_at_ms ?? 0) > lastReadMs) return i;
  }
  return -1;
}

/** 用户是否已向下滚过 `chat-unread-divider`（分隔线完全离开滚动区顶部以上）。 */
export function isChatUnreadDividerScrolledPast(
  scrollContainer: HTMLElement,
  divider: HTMLElement,
  slackPx = 4,
): boolean {
  const containerTop = scrollContainer.getBoundingClientRect().top;
  const dividerBottom = divider.getBoundingClientRect().bottom;
  return dividerBottom <= containerTop + slackPx;
}

export function maxChatMessageSentAtMs(messages: readonly ChatMessageRow[]): number {
  let max = 0;
  for (const m of messages) {
    const t = m.sent_at_ms ?? 0;
    if (t > max) max = t;
  }
  return max;
}

/** 基于 ListChatMessages 快照与本地 lastRead 估算每频道未读条数。 */
export function estimateChatUnread(
  channels: readonly ChatChannelSnapshot[],
  lastRead: ChatLastReadMap,
): Record<string, number> {
  const byChannel: Record<string, number> = {};
  for (const snap of channels) {
    const baseline = lastRead[snap.key] ?? 0;
    byChannel[snap.key] = countChatMessagesAfterTs(snap.messages, baseline);
  }
  return byChannel;
}

export function summarizeChatUnread(
  byChannel: Record<string, number>,
  guildId: number,
): ChatUnreadSummary {
  const worldKey = chatChannelStorageKey(CHAT_CHANNEL_WORLD);
  const guildKey = chatChannelStorageKey(CHAT_CHANNEL_GUILD, guildId);
  const world = byChannel[worldKey] ?? 0;
  const guild = byChannel[guildKey] ?? 0;
  return {
    world,
    guild,
    total: world + guild,
    byChannel,
  };
}

export function isElementScrolledToBottom(el: HTMLElement, slackPx = 8): boolean {
  if (el.scrollHeight <= el.clientHeight) return true;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - slackPx;
}

/** 聊天未读快照：轮询与面板刷新共用。 */
export class ChatUnreadTracker {
  private snapshots: ChatChannelSnapshot[] = [];
  private lastRead: ChatLastReadMap;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | null;
  onCounts?: () => void;

  constructor(
    storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
      ? localStorage
      : null,
  ) {
    this.storage = storage;
    this.lastRead = readChatLastReadMap(storage);
  }

  replaceSnapshot(snapshot: ChatChannelSnapshot): void {
    const idx = this.snapshots.findIndex((s) => s.key === snapshot.key);
    if (idx >= 0) this.snapshots[idx] = snapshot;
    else this.snapshots.push(snapshot);
    this.emit();
  }

  removeSnapshotsForGuild(guildId: number): void {
    const key = chatChannelStorageKey(CHAT_CHANNEL_GUILD, guildId);
    this.snapshots = this.snapshots.filter((s) => s.key !== key);
    this.emit();
  }

  markChannelRead(key: string, readThroughMs: number): void {
    const prev = this.lastRead[key] ?? 0;
    const next = Math.max(prev, readThroughMs);
    if (next <= prev) return;
    this.lastRead = { ...this.lastRead, [key]: next };
    writeChatLastReadMap(this.lastRead, this.storage);
    this.emit();
  }

  getLastReadMs(key: string): number {
    return this.lastRead[key] ?? 0;
  }

  getSummary(guildId: number): ChatUnreadSummary {
    const byChannel = estimateChatUnread(this.snapshots, this.lastRead);
    return summarizeChatUnread(byChannel, guildId);
  }

  private emit(): void {
    this.onCounts?.();
  }
}
