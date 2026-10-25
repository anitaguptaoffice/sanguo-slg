import {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS,
  chatUnreadSeparatorResidualDeepestDomClassName,
  scheduleGuildChatUnreadFirstMsgDeepestSweepRing,
} from "@/net/guildChatUnreadDividerResidualDeepest";
import { GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS } from "@/net/guildChatUnreadDividerResidualDeeper";

/** CLIENT-313：未读边界分隔线巩固再加深二层扫读 class（与 CLIENT-297 更深一层扫读 **并存**）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deeper-sweep";

/** 首条未读消息行 2.5s 巩固再加深二层扫读环（CLIENT-297 2s 更深一层环 **不退化**）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-deepest-deeper-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS = 2500;

/** 在 CLIENT-297 更深一层环结束后再启动巩固再加深二层环（更深一层延迟 + 更深一层环时长）。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_DELAY_MS =
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPER_SWEEP_RING_MS + GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_MS;

let firstUnreadMsgDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;
let firstUnreadMsgDeepestDeeperDelayTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-297 更深一层分隔线 + CLIENT-313 巩固再加深二层扫读 class。 */
export function chatUnreadSeparatorResidualDeepestDeeperDomClassName(): string {
  return `${chatUnreadSeparatorResidualDeepestDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`;
}

function scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRingOnly(
  row: HTMLElement,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (firstUnreadMsgDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeeperSweepTimer);
  }
  firstUnreadMsgDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_CLASS);
    firstUnreadMsgDeepestDeeperSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_RING_MS);
}

/** 首条未读行：CLIENT-297 更深一层环链 + CLIENT-313 2.5s 巩固再加深二层扫读环（在更深一层环结束后启动，避免同刻定时器叠消）。 */
export function scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  scheduleGuildChatUnreadFirstMsgDeepestSweepRing(row, windowObj);
  if (firstUnreadMsgDeepestDeeperDelayTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgDeepestDeeperDelayTimer);
  }
  firstUnreadMsgDeepestDeeperDelayTimer = windowObj.setTimeout(() => {
    scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRingOnly(row, windowObj);
    firstUnreadMsgDeepestDeeperDelayTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_DEEPER_SWEEP_DELAY_MS);
}

/** 供单测断言 CLIENT-297 更深一层扫读 class 仍挂载于巩固再加深二层扫读 DOM。 */
export {
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_FIRST_MSG_DEEPEST_SWEEP_RING_CLASS,
};
