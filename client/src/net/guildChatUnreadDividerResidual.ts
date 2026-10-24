import { chatUnreadSeparatorDomClassName } from "@/net/chatUnread";

/** CLIENT-249：未读边界分隔线残余扫读 class（与 CLIENT-185/234 基础分隔线并存）。 */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-sweep";

/** 首条未读消息行 1.2s 扫读环。 */
export const GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS =
  "guild-chat-unread-first-msg-sweep-ring";

export const GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS = 1200;

let firstUnreadMsgSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** DOM `className`：CLIENT-234 分隔线 + CLIENT-249 残余扫读 class。 */
export function chatUnreadSeparatorResidualDomClassName(): string {
  return `${chatUnreadSeparatorDomClassName()} ${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS}`;
}

/** 首条未读行附加 `guild-chat-unread-first-msg-sweep-ring` 1.2s（CLIENT-161 标为已读可见性不退化）。 */
export function scheduleGuildChatUnreadFirstMsgSweepRing(
  row: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!row) return;
  row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS);
  if (firstUnreadMsgSweepTimer != null) {
    windowObj.clearTimeout(firstUnreadMsgSweepTimer);
  }
  firstUnreadMsgSweepTimer = windowObj.setTimeout(() => {
    row.classList.remove(GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_CLASS);
    firstUnreadMsgSweepTimer = null;
  }, GUILD_CHAT_UNREAD_FIRST_MSG_SWEEP_RING_MS);
}
