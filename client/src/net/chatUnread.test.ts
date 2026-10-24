import { describe, expect, it } from "vitest";
import {
  CHAT_LAST_READ_TS_STORAGE_KEY,
  chatChannelStorageKey,
  chatUnreadDividerFlatIndex,
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

  it("chatUnreadDividerFlatIndex points at first unread in chronological order", () => {
    const messages = [
      { sent_at_ms: 100 },
      { sent_at_ms: 300 },
      { sent_at_ms: 200 },
      { sent_at_ms: 400 },
    ];
    expect(chatUnreadDividerFlatIndex(messages, 150)).toBe(1);
    expect(chatUnreadDividerFlatIndex(messages, 400)).toBe(-1);
    expect(chatUnreadDividerFlatIndex([], 0)).toBe(-1);
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
