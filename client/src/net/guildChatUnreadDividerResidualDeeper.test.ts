import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeep";
import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS,
  chatUnreadSeparatorResidualDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeeper";

describe("guildChatUnreadDividerResidualDeeper (CLIENT-281)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chatUnreadSeparatorResidualDeeperDomClassName stacks deep and deeper sweep classes", () => {
    const cn = chatUnreadSeparatorResidualDeeperDomClassName();
    expect(cn).toContain("chat-unread-separator");
    expect(cn).toContain("guild-chat-unread-separator");
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS);
  });

  it("scheduleGuildChatUnreadFirstMsgDeeperSweepRing adds deeper ring atop deep chain", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleGuildChatUnreadFirstMsgDeeperSweepRing(row);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(true);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(false);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(
      GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS - GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS,
    );
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS)).toBe(false);
  });
});
