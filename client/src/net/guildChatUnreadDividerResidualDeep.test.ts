import { afterEach, describe, expect, it, vi } from "vitest";
import { GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS } from "@/net/guildChatUnreadDividerResidual";
import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS,
  chatUnreadSeparatorResidualDeepDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeep";

describe("guildChatUnreadDividerResidualDeep (CLIENT-265)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chatUnreadSeparatorResidualDeepDomClassName stacks residual and deep sweep classes", () => {
    const cn = chatUnreadSeparatorResidualDeepDomClassName();
    expect(cn).toContain("chat-unread-separator");
    expect(cn).toContain("guild-chat-unread-separator");
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS);
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS);
  });

  it("scheduleGuildChatUnreadFirstMsgDeepSweepRing applies residual and deep rings", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleGuildChatUnreadFirstMsgDeepSweepRing(row);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(true);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS - 1);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(true);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS)).toBe(false);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(
      GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS - GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS - 1,
    );
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS)).toBe(false);
  });
});
