import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_DELAY_MS,
  chatUnreadSeparatorResidualDeepestDeepestDeepestDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeepest";

/** CLIENT-361：未读边界分隔线巩固再加深五层扫读 class（与 CLIENT-345 更深四层扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deepest-deepest-deeper-sweep";

/** 首条未读消息行 2.5s 巩固再加深五层扫读环（CLIENT-345 2.5s 更深四层环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-deepest-deepest-deeper-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS = 2500;

/** 在 CLIENT-345 更深四层环结束后再启动巩固再加深五层环（更深四层延迟 + 更深四层环时长）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS =
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_DELAY_MS +
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_MS;

let firstUnreadMsgDeepestDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null =
  null;
let firstUnreadMsgDeepestDeepestDeepestDeeperDelayTimer: ReturnType<typeof setTimeout> | null =
  null;

/** DOM `className`：CLIENT-345 更深四层分隔线 + CLIENT-361 巩固再加深五层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDeepestDeepestDeeperDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepestDeepestDeepestDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestDeeperSweepTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
    firstUnreadMsgDeepestDeepestDeepestDeeperSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-345 更深四层环链 + CLIENT-361 2.5s 巩固再加深五层扫读环（在更深四层环结束后启动，避免同刻定时器叠消）。 */
export function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDeepestDeepestDeeperDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestDeeperDelayTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestDeeperDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDeepestDeepestDeeperDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS);
}

/** 供单测断言 CLIENT-345 更深四层扫读 class 仍挂载于巩固再加深五层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_SWEEP_RING_CLASS,
};
