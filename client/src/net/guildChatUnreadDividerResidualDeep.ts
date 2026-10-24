import {
  GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  chatUnreadSeparatorResidualDomClassName,
  scheduleGuildChatUnreadFirstMsgSweepRing,
} from "@/net/guildChatUnreadDividerResidual";

/** CLIENT-265：未读边界分隔线深扫读 class（与 CLIENT-249 残余 sweep **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deep-sweep";

/** 首条未读消息行 1.5s 深扫读环（CLIENT-249 1.2s 环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deep-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS = 1500;

let firstUnreadMsgDeepSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-249 残余分隔线 + CLIENT-265 深扫读 class。 */
export function chatUnreadSeparatorResidualDeepDomClassName(): string {
  return `${chatUnreadSeparatorResidualDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepSweepTimer);
  }
  firstUnreadMsgDeepSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS);
    firstUnreadMsgDeepSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-249 1.2s 环 + CLIENT-265 1.5s 深扫读环。 */
export function scheduleGuildChatUnreadFirstMsgDeepSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgSweepRing(row, windowObj);
  scheduleGuildChatUnreadFirstMsgDeepSweepRingOnly(row, windowObj);
}

/** 供单测断言 CLIENT-249 残余 class 仍挂载于深扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS,
};
