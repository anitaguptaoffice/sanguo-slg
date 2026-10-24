import {
  GUILD_CHAT_RETRY_INLINE_CLASS,
  renderPanelGatewayErrorListRow,
  type PanelGatewayErrorRowOptions,
} from "@/net/panelGatewayError";

/** 聊天列表网关失败退避重试钮（CLIENT-217；与 CLIENT-200 `guild-chat-retry-inline` 并存）。 */
export const GUILD_CHAT_BACKOFF_RETRY_CLASS = "guild-chat-backoff-retry";

const BACKOFF_BASE_SEC = 2;
const BACKOFF_MAX_SEC = 32;

/** 第 n 次连续失败后的建议退避秒数（1-based；首败 2s，封顶 32s）。 */
export function guildChatGatewayBackoffSeconds(failureCount: number): number {
  if (failureCount <= 0) return 0;
  const exp = Math.min(failureCount - 1, 4);
  return Math.min(BACKOFF_MAX_SEC, BACKOFF_BASE_SEC * 2 ** exp);
}

export function formatGuildChatGatewayBackoffHint(backoffSeconds: number): string {
  if (backoffSeconds <= 0) return "";
  return `建议 ${backoffSeconds} 秒后重试`;
}

/** 网关错误文案 + 退避 hint（仅聊天列表 error 行）。 */
export function formatGuildChatGatewayBackoffErrorLine(
  gatewayError: string,
  backoffSeconds: number,
): string {
  const hint = formatGuildChatGatewayBackoffHint(backoffSeconds);
  return hint ? `${gatewayError} · ${hint}` : gatewayError;
}

export function guildChatBackoffRetryButtonClass(): string {
  return `${GUILD_CHAT_RETRY_INLINE_CLASS} ${GUILD_CHAT_BACKOFF_RETRY_CLASS}`;
}

export type GuildChatBackoffErrorRowOptions = PanelGatewayErrorRowOptions & {
  backoffSeconds: number;
};

/** `data-panel-state=error` + CLIENT-200 行内重试 + CLIENT-217 退避秒数。 */
export function renderGuildChatBackoffGatewayErrorListRow(
  ul: HTMLElement,
  message: string,
  options: GuildChatBackoffErrorRowOptions,
): HTMLLIElement {
  const li = renderPanelGatewayErrorListRow(ul, message, {
    ...options,
    retryClass: guildChatBackoffRetryButtonClass(),
  });
  const btn = li.querySelector<HTMLButtonElement>(`button.${GUILD_CHAT_BACKOFF_RETRY_CLASS}`);
  if (btn && options.backoffSeconds > 0) {
    btn.setAttribute("data-backoff-seconds", String(options.backoffSeconds));
    btn.textContent = `重试 (${options.backoffSeconds}s)`;
  }
  return li;
}
