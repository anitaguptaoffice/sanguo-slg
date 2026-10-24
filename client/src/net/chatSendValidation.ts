/**
 * 与网关 `chat` 模块 SendChat 内容长度校验一致（`utf8.RuneCountInString` ≈ Unicode 码点计数）。
 * 默认上限对齐 `internal/chat.DefaultSendLimits.MaxContentLength`（500）。
 */
export const CHAT_SEND_MAX_CONTENT_LENGTH = 500;

export function countChatContentRunes(content: string): number {
  return [...content].length;
}

export function formatChatInputCounter(
  content: string,
  maxLength: number = CHAT_SEND_MAX_CONTENT_LENGTH,
): string {
  const max = Math.max(1, Math.trunc(maxLength));
  const n = Math.min(countChatContentRunes(content), max);
  return `${n}/${max}`;
}

export type ChatSendValidationResult = { ok: true } | { ok: false; reason: string };

export function validateSendChatContent(
  content: string,
  maxLength: number = CHAT_SEND_MAX_CONTENT_LENGTH,
): ChatSendValidationResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, reason: "消息不能为空" };
  }
  const max = Math.max(1, Math.trunc(maxLength));
  if (countChatContentRunes(trimmed) > max) {
    return { ok: false, reason: "消息过长" };
  }
  return { ok: true };
}
