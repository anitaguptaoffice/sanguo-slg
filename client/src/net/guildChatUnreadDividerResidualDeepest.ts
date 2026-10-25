import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS,
  chatUnreadSeparatorResidualDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeeper";

/** CLIENT-297：未读边界分隔线更深一层扫读 class（与 CLIENT-281 更深扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-sweep";

/** 首条未读消息行 2s 更深一层扫读环（CLIENT-281 2s 更深环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS = 2000;

let firstUnreadMsgDeepestSweepTimer: ReturnType<typeof setTimeout> | null = null;
let firstUnreadMsgDeepestDelayTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-281 更深分隔线 + CLIENT-297 更深一层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeeperDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestSweepTimer);
  }
  firstUnreadMsgDeepestSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS);
    firstUnreadMsgDeepestSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-281 更深环链 + CLIENT-297 2s 更深一层扫读环（在更深环结束后启动，避免同刻 2s 定时器叠消）。 */
export function scheduleGuildChatUnreadFirstMsgDeepestSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeeperSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDelayTimer);
  }
  firstUnreadMsgDeepestDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS);
}

/** 供单测断言 CLIENT-281 更深扫读 class 仍挂载于更深一层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS,
};
