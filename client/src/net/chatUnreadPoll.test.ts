import { describe, expect, it, vi } from "vitest";
import { ChatUnreadPoll } from "@/net/chatUnreadPoll";
import { ChatUnreadTracker } from "@/net/chatUnread";
import { CHAT_CHANNEL_GUILD, CHAT_CHANNEL_WORLD } from "@/net/socialFormat";

describe("ChatUnreadPoll", () => {
  it("fetches world and guild snapshots when guild joined", async () => {
    const tracker = new ChatUnreadTracker(null);
    const listChatMessages = vi
      .fn()
      .mockResolvedValueOnce({ messages: [{ sent_at_ms: 100 }] })
      .mockResolvedValueOnce({ messages: [{ sent_at_ms: 200 }] });
    const poll = new ChatUnreadPoll({
      gateway: { listChatMessages, getBoundServerId: () => 1 } as never,
      getServerId: () => 1,
      getGuildId: () => 9,
      tracker,
      isPanelVisible: () => false,
      fastIntervalSec: 1,
      slowIntervalSec: 10,
    });
    await poll.pollOnce();
    expect(listChatMessages).toHaveBeenCalledTimes(2);
    expect(listChatMessages).toHaveBeenCalledWith(1, CHAT_CHANNEL_WORLD, {
      guildId: undefined,
      limit: 30,
    });
    expect(listChatMessages).toHaveBeenCalledWith(1, CHAT_CHANNEL_GUILD, {
      guildId: 9,
      limit: 30,
    });
    const summary = tracker.getSummary(9);
    expect(summary.world).toBe(1);
    expect(summary.guild).toBe(1);
  });

  it("skips guild fetch when not in guild", async () => {
    const tracker = new ChatUnreadTracker(null);
    const listChatMessages = vi.fn().mockResolvedValue({ messages: [] });
    const poll = new ChatUnreadPoll({
      gateway: { listChatMessages, getBoundServerId: () => 1 } as never,
      getServerId: () => 1,
      getGuildId: () => 0,
      tracker,
      isPanelVisible: () => false,
    });
    await poll.pollOnce();
    expect(listChatMessages).toHaveBeenCalledTimes(1);
    expect(tracker.getSummary(0).guild).toBe(0);
  });
});
