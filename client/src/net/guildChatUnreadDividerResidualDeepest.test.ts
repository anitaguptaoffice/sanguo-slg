import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeeper";
import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS,
  chatUnreadSeparatorResidualDeepestDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepest";

describe("guildChatUnreadDividerResidualDeepest (CLIENT-297)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chatUnreadSeparatorResidualDeepestDomClassName stacks deeper and deepest sweep classes", () => {
    const cn = chatUnreadSeparatorResidualDeepestDomClassName();
    expect(cn).toContain("chat-unread-separator");
    expect(cn).toContain("guild-chat-unread-separator");
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS);
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS);
  });

  it("scheduleGuildChatUnreadFirstMsgDeepestSweepRing adds deepest ring atop deeper chain", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleGuildChatUnreadFirstMsgDeepestSweepRing(row);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS)).toBe(true);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS)).toBe(false);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS)).toBe(false);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS)).toBe(false);
  });
});
