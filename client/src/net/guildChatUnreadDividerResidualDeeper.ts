import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS,
  chatUnreadSeparatorResidualDeepDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeep";

/** CLIENT-281：未读边界分隔线更深扫读 class（与 CLIENT-265 深扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deeper-sweep";

/** 首条未读消息行 2s 更深扫读环（CLIENT-265 1.5s 深环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deeper-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS = 2000;

let firstUnreadMsgDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-265 深分隔线 + CLIENT-281 更深扫读 class。 */
export function chatUnreadSeparatorResidualDeeperDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeeperSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeeperSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeeperSweepTimer);
  }
  firstUnreadMsgDeeperSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_CLASS);
    firstUnreadMsgDeeperSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-265 深环链 + CLIENT-281 2s 更深扫读环。 */
export function scheduleGuildChatUnreadFirstMsgDeeperSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepSweepRing(row, windowObj);
  scheduleGuildChatUnreadFirstMsgDeeperSweepRingOnly(row, windowObj);
}

/** 供单测断言 CLIENT-265 深扫读 class 仍挂载于更深扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEP_SWEEP_RING_CLASS,
};
