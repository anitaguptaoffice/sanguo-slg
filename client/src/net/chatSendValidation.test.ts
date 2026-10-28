// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CHAT_SEND_MAX_CONTENT_LENGTH,
  countChatContentRunes,
  formatChatInputCounter,
  validateSendChatContent,
} from "@/net/chatSendValidation";

describe("chatSendValidation (CLIENT-160)", () => {
  it("formatChatInputCounter shows rune count over max", () => {
    expect(formatChatInputCounter("")).toBe(`0/${CHAT_SEND_MAX_CONTENT_LENGTH}`);
    expect(formatChatInputCounter("你好")).toBe(`2/${CHAT_SEND_MAX_CONTENT_LENGTH}`);
  });

  it("countChatContentRunes counts astral symbols as one", () => {
    expect(countChatContentRunes("😀")).toBe(1);
  });

  it("validateSendChatContent rejects empty and over-limit", () => {
    expect(validateSendChatContent("   ").ok).toBe(false);
    const long = "a".repeat(CHAT_SEND_MAX_CONTENT_LENGTH + 1);
    expect(validateSendChatContent(long).ok).toBe(false);
    expect(validateSendChatContent("ok").ok).toBe(true);
  });
});
