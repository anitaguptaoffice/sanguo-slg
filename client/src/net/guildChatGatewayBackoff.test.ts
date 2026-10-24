import { describe, expect, it } from "vitest";
import { GUILD_CHAT_RETRY_INLINE_CLASS } from "@/net/panelGatewayError";
import {
  formatGuildChatGatewayBackoffErrorLine,
  formatGuildChatGatewayBackoffHint,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  guildChatBackoffRetryButtonClass,
  guildChatGatewayBackoffSeconds,
  renderGuildChatBackoffGatewayErrorListRow,
} from "@/net/guildChatGatewayBackoff";

describe("guildChatGatewayBackoffSeconds (CLIENT-217)", () => {
  it("uses exponential backoff capped at 32s", () => {
    expect(guildChatGatewayBackoffSeconds(0)).toBe(0);
    expect(guildChatGatewayBackoffSeconds(1)).toBe(2);
    expect(guildChatGatewayBackoffSeconds(2)).toBe(4);
    expect(guildChatGatewayBackoffSeconds(3)).toBe(8);
    expect(guildChatGatewayBackoffSeconds(4)).toBe(16);
    expect(guildChatGatewayBackoffSeconds(5)).toBe(32);
    expect(guildChatGatewayBackoffSeconds(10)).toBe(32);
  });
});

describe("formatGuildChatGatewayBackoff copy", () => {
  it("appends backoff hint to gateway error line", () => {
    expect(formatGuildChatGatewayBackoffHint(8)).toBe("建议 8 秒后重试");
    expect(formatGuildChatGatewayBackoffErrorLine("聊天：network", 8)).toBe(
      "聊天：network · 建议 8 秒后重试",
    );
  });
});

describe("guild-chat-backoff-retry class wiring", () => {
  it("renders retry button with inline + backoff classes and data-backoff-seconds", () => {
    expect(guildChatBackoffRetryButtonClass()).toContain(GUILD_CHAT_RETRY_INLINE_CLASS);
    expect(guildChatBackoffRetryButtonClass()).toContain(GUILD_CHAT_BACKOFF_RETRY_CLASS);
    const ul = document.createElement("ul");
    renderGuildChatBackoffGatewayErrorListRow(ul, "聊天：fail · 建议 4 秒后重试", {
      retryAction: "retry-refresh-chat",
      backoffSeconds: 4,
    });
    const btn = ul.querySelector<HTMLButtonElement>(`button.${GUILD_CHAT_BACKOFF_RETRY_CLASS}`);
    expect(btn?.classList.contains(GUILD_CHAT_RETRY_INLINE_CLASS)).toBe(true);
    expect(btn?.getAttribute("data-action")).toBe("retry-refresh-chat");
    expect(btn?.getAttribute("data-backoff-seconds")).toBe("4");
    expect(btn?.textContent).toBe("重试 (4s)");
  });
});
