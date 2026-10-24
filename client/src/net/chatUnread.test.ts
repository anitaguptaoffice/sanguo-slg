import { describe, expect, it } from "vitest";
import {
  CHAT_LAST_READ_TS_STORAGE_KEY,
  chatChannelStorageKey,
  findChatUnreadSeparatorIndex,
  formatChatUnreadSweepLine,
  countChatMessagesAfterTs,
  estimateChatUnread,
  estimateChatUnreadCount,
  parseChatLastReadMap,
  summarizeChatUnread,
} from "@/net/chatUnread";
import { CHAT_CHANNEL_GUILD, CHAT_CHANNEL_WORLD } from "@/net/socialFormat";

describe("chatUnread", () => {
  it("estimateChatUnread counts messages after per-channel lastRead ts", () => {
    const worldKey = chatChannelStorageKey(CHAT_CHANNEL_WORLD);
    const guildKey = chatChannelStorageKey(CHAT_CHANNEL_GUILD, 42);
    const channels = [
      {
        key: worldKey,
        channel: CHAT_CHANNEL_WORLD,
        messages: [
          { sent_at_ms: 100 },
          { sent_at_ms: 200 },
          { sent_at_ms: 300 },
        ],
      },
      {
        key: guildKey,
        channel: CHAT_CHANNEL_GUILD,
        messages: [{ sent_at_ms: 500 }, { sent_at_ms: 600 }],
      },
    ];
    const lastRead = { [worldKey]: 200, [guildKey]: 550 };
    const byChannel = estimateChatUnread(channels, lastRead);
    expect(byChannel[worldKey]).toBe(1);
    expect(byChannel[guildKey]).toBe(1);
    const summary = summarizeChatUnread(byChannel, 42);
    expect(summary.world).toBe(1);
    expect(summary.guild).toBe(1);
    expect(summary.total).toBe(2);
  });

  it("treats missing lastRead as zero baseline", () => {
    const worldKey = chatChannelStorageKey(CHAT_CHANNEL_WORLD);
    const byChannel = estimateChatUnread(
      [{ key: worldKey, channel: CHAT_CHANNEL_WORLD, messages: [{ sent_at_ms: 1 }] }],
      {},
    );
    expect(byChannel[worldKey]).toBe(1);
  });

  it("countChatMessagesAfterTs ignores messages at or before baseline", () => {
    expect(
      countChatMessagesAfterTs(
        [{ sent_at_ms: 10 }, { sent_at_ms: 11 }, { sent_at_ms: 9 }],
        10,
      ),
    ).toBe(1);
  });

  it("estimateChatUnreadCount matches countChatMessagesAfterTs (CLIENT-161)", () => {
    const messages = [{ sent_at_ms: 5 }, { sent_at_ms: 15 }, { sent_at_ms: 10 }];
    expect(estimateChatUnreadCount(messages, 9)).toBe(2);
    expect(estimateChatUnreadCount(messages, 20)).toBe(0);
  });

  it("findChatUnreadSeparatorIndex points at first unread in chronological order (CLIENT-185)", () => {
    const messages = [
      { sent_at_ms: 100 },
      { sent_at_ms: 300 },
      { sent_at_ms: 200 },
      { sent_at_ms: 400 },
    ];
    expect(findChatUnreadSeparatorIndex(messages, 150)).toBe(1);
    expect(findChatUnreadSeparatorIndex(messages, 400)).toBe(-1);
    expect(findChatUnreadSeparatorIndex([], 0)).toBe(-1);
  });

  it("formatChatUnreadSweepLine summarizes unread count for separator (CLIENT-185)", () => {
    expect(formatChatUnreadSweepLine(3)).toBe("3 条未读");
    expect(formatChatUnreadSweepLine(1)).toBe("1 条未读");
    expect(formatChatUnreadSweepLine(0)).toBe("以下未读");
    expect(formatChatUnreadSweepLine(-1)).toBe("以下未读");
  });

  it("parses chat-last-read-ts storage map", () => {
    expect(parseChatLastReadMap(null)).toEqual({});
    expect(parseChatLastReadMap('{"world":100,"guild:1":200}')).toEqual({
      world: 100,
      "guild:1": 200,
    });
    expect(CHAT_LAST_READ_TS_STORAGE_KEY).toBe("chat-last-read-ts");
  });
});
