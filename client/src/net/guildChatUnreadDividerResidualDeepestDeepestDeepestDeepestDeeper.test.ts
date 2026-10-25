import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeeper";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeepest";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeepestDeeper";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeeper";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_DELAY_MS,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeepest";
import {
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeepestDeeper";
import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS,
  chatUnreadSeparatorResidualDeepestDeepestDeepestDeepestDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeepestDeepestDeeper";

describe("guildChatUnreadDividerResidualDeepestDeepestDeepestDeepestDeeper (CLIENT-377)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chatUnreadSeparatorResidualDeepestDeepestDeepestDeepestDeeperDomClassName stacks deepest-deepest-deepest-deeper and deepest-deepest-deepest-deepest-deeper sweep classes", () => {
    const cn = chatUnreadSeparatorResidualDeepestDeepestDeepestDeepestDeeperDomClassName();
    expect(cn).toContain("chat-unread-separator");
    expect(cn).toContain("guild-chat-unread-separator");
    expect(cn).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
    expect(cn).toContain(
      GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
    );
  });

  it("scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRing adds deepest-deepest-deepest-deepest-deeper ring atop deepest-deepest-deepest-deeper chain", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRing(row);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS);
    expect(
      row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
    expect(
      row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(false);
    expect(
      row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
    expect(
      row.classList.contains(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(false);
    expect(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS).toBe(
      GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS +
        GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
    );
  });
});
