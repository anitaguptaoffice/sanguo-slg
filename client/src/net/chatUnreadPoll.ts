import type { ChatChannelSnapshot, ChatUnreadTracker } from "@/net/chatUnread";
import { chatChannelStorageKey } from "@/net/chatUnread";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  CHAT_CHANNEL_GUILD,
  CHAT_CHANNEL_WORLD,
  type ChatMessageRow,
} from "@/net/socialFormat";
import {
  CITY_STATE_POLL_FAST_SEC,
  CITY_STATE_POLL_SLOW_SEC,
} from "@/net/cityStatePoll";

export type ChatUnreadPollOptions = {
  gateway: GatewayPort;
  getServerId: () => number;
  getGuildId: () => number;
  tracker: ChatUnreadTracker;
  isPanelVisible: () => boolean;
  fastIntervalSec?: number;
  slowIntervalSec?: number;
};

const CHAT_LIST_LIMIT = 30;

/** 世界/军团频道 ListChatMessages 轮询，供 HUD 聊天未读估算（CLIENT-102）。 */
export class ChatUnreadPoll {
  private accumSec = 0;
  private readonly fastSec: number;
  private readonly slowSec: number;
  private inflight: Promise<void> | null = null;

  constructor(private readonly opts: ChatUnreadPollOptions) {
    this.fastSec = opts.fastIntervalSec ?? CITY_STATE_POLL_FAST_SEC;
    this.slowSec = opts.slowIntervalSec ?? CITY_STATE_POLL_SLOW_SEC;
  }

  reset(): void {
    this.accumSec = 0;
    this.inflight = null;
  }

  tick(dtSec: number): void {
    const interval = this.opts.isPanelVisible() ? this.fastSec : this.slowSec;
    this.accumSec += dtSec;
    if (this.accumSec < interval) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  pollOnce(): Promise<void> {
    if (this.inflight) return this.inflight;
    const run = async () => {
      const sid = this.opts.getServerId();
      if (sid <= 0) return;
      const guildId = this.opts.getGuildId();
      await Promise.all([
        this.fetchChannel(sid, CHAT_CHANNEL_WORLD, 0),
        guildId > 0
          ? this.fetchChannel(sid, CHAT_CHANNEL_GUILD, guildId)
          : Promise.resolve(),
      ]);
    };
    this.inflight = run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchChannel(serverId: number, channel: number, guildId: number): Promise<void> {
    try {
      const res = (await this.opts.gateway.listChatMessages(serverId, channel, {
        guildId: channel === CHAT_CHANNEL_GUILD ? guildId : undefined,
        limit: CHAT_LIST_LIMIT,
      })) as { messages?: ChatMessageRow[] };
      const key = chatChannelStorageKey(channel, guildId);
      const snap: ChatChannelSnapshot = {
        key,
        channel,
        messages: res.messages ?? [],
      };
      this.opts.tracker.replaceSnapshot(snap);
    } catch {
      // 角标估算失败时保留上次快照
    }
  }
}
