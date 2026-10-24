import { describe, expect, it } from "vitest";
import {
  GUILD_CHAT_DRAFT_STORAGE_KEY,
  persistGuildChatDraft,
  restoreGuildChatDraft,
} from "@/net/guildChatDraft";

describe("guildChatDraft (CLIENT-160)", () => {
  it("persistGuildChatDraft writes session key and restoreGuildChatDraft reads it", () => {
    const map = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
      getItem: (k: string) => map.get(k) ?? null,
    };
    persistGuildChatDraft("@副官乙 你好", storage);
    expect(map.get(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe("@副官乙 你好");
    expect(restoreGuildChatDraft(storage)).toBe("@副官乙 你好");
  });

  it("persistGuildChatDraft with empty content clears storage", () => {
    const map = new Map<string, string>([[GUILD_CHAT_DRAFT_STORAGE_KEY, "x"]]);
    const storage = {
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
      getItem: (k: string) => map.get(k) ?? null,
    };
    persistGuildChatDraft("", storage);
    expect(map.has(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe(false);
    expect(restoreGuildChatDraft(storage)).toBe("");
  });
});
