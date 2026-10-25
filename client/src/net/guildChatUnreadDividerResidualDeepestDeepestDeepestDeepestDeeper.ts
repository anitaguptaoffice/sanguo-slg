import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS,
  chatUnreadSeparatorResidualDeepestDeepestDeepestDeeperDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepestDeepestDeepestDeeper";

/** CLIENT-377：未读边界分隔线 wave:58 巩固再加深五层扫读 class（与 CLIENT-361 更深五层扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deepest-deepest-deepest-deeper-sweep";

/** 首条未读消息行 2.5s wave:58 巩固再加深五层扫读环（CLIENT-361 2.5s 更深五层环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-deepest-deepest-deepest-deeper-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS = 2500;

/** 在 CLIENT-361 更深五层环结束后再启动 wave:58 巩固再加深五层环。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS =
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS +
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS;

let firstUnreadMsgDeepestDeepestDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null =
  null;
let firstUnreadMsgDeepestDeepestDeepestDeepestDeeperDelayTimer: ReturnType<typeof setTimeout> | null =
  null;

/** DOM `className`：CLIENT-361 更深五层分隔线 + CLIENT-377 wave:58 巩固再加深五层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDeepestDeepestDeepestDeeperDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepestDeepestDeepestDeeperDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(
    GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  );
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestDeepestDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestDeepestDeeperSweepTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(
      GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
    );
    firstUnreadMsgDeepestDeepestDeepestDeepestDeeperSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-361 更深五层环链 + CLIENT-377 2.5s wave:58 巩固再加深五层扫读环。 */
export function scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDeepestDeepestDeepestDeeperDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeepestDeepestDeepestDeeperDelayTimer);
  }
  firstUnreadMsgDeepestDeepestDeepestDeepestDeeperDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDeepestDeepestDeepestDeeperDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_DELAY_MS);
}

/** 供单测断言 CLIENT-361 更深五层扫读 class 仍挂载于 wave:58 巩固再加深五层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
};
