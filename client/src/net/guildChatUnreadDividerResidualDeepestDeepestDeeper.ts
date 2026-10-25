import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_DELAY_MS,
  chatUnreadSeparatorResidualDeepestDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepestDeeper";

/** CLIENT-329：未读边界分隔线巩固再加深三层扫读 class（与 CLIENT-313 更深二层扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deepest-deeper-sweep";

/** 首条未读消息行 2.5s 巩固再加深三层扫读环（CLIENT-313 2.5s 更深二层环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-deepest-deeper-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS = 2500;

/** 在 CLIENT-313 更深二层环结束后再启动巩固再加深三层环（更深二层延迟 + 更深二层环时长）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS =
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_DELAY_MS +
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS;

let firstUnreadMsgDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;
let firstUnreadMsgDeepestDeepestDeeperDelayTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-313 更深二层分隔线 + CLIENT-329 巩固再加深三层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDeepestDeeperDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepestDeeperDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeeperSweepTimer);
  }
  firstUnreadMsgDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
    firstUnreadMsgDeepestDeepestDeeperSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-313 更深二层环链 + CLIENT-329 2.5s 巩固再加深三层扫读环（在更深二层环结束后启动，避免同刻定时器叠消）。 */
export function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDeepestDeeperDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeeperDelayTimer);
  }
  firstUnreadMsgDeepestDeepestDeeperDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDeepestDeeperDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS);
}

/** 供单测断言 CLIENT-313 更深二层扫读 class 仍挂载于巩固再加深三层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS,
};
