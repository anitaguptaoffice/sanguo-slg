import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS,
  chatUnreadSeparatorResidualDomClassName,
  scheduleGuildChatUnreadFirstMsgSweepRing,
} from "@/net/guildChatUnreadDividerResidual";

describe("guildChatUnreadDividerResidual (CLIENT-249)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chatUnreadSeparatorResidualDomClassName pairs base and residual sweep classes", () => {
    const cn = chatUnreadSeparatorResidualDomClassName();
    expect(cn).toContain("chat-unread-separator");
    expect(cn).toContain("guild-chat-unread-separator");
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS);
  });

  it("scheduleGuildChatUnreadFirstMsgSweepRing applies ring for 1.2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleGuildChatUnreadFirstMsgSweepRing(row);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS - 1);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(false);
  });
});
