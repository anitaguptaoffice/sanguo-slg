import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS,
  chatUnreadSeparatorResidualDeepestDeepestDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeeper";

/** CLIENT-345：未读边界分隔线巩固再加深四层扫读 class（与 CLIENT-329 更深三层扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deepest-deepest-sweep";

/** 首条未读消息行 2.5s 巩固再加深四层扫读环（CLIENT-329 2.5s 更深三层环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-deepest-deepest-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS = 2500;

/** 在 CLIENT-329 更深三层环结束后再启动巩固再加深四层环（更深三层延迟 + 更深三层环时长）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_DELAY_MS =
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS +
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS;

let firstUnreadMsgDeepestDeepestDeepestSweepTimer: ReturnType<typeof setTimeout> | null = null;
let firstUnreadMsgDeepestDeepestDeepestDelayTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-329 更深三层分隔线 + CLIENT-345 巩固再加深四层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDeepestDeepestDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepestDeepestDeeperDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestDeepestDeepestSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestSweepTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS);
    firstUnreadMsgDeepestDeepestDeepestSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-329 更深三层环链 + CLIENT-345 2.5s 巩固再加深四层扫读环（在更深三层环结束后启动，避免同刻定时器叠消）。 */
export function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDeepestDeepestDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestDelayTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDeepestDeepestDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_DELAY_MS);
}

/** 供单测断言 CLIENT-329 更深三层扫读 class 仍挂载于巩固再加深四层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
};
