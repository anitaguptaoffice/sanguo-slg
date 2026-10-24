/** sessionStorage：军团「提到」与聊天输入草稿（CLIENT-160，不新 RPC）。 */
export const GUILD_CHAT_DRAFT_STORAGE_KEY = "guild-chat-draft-v1";

export function persistGuildChatDraft(
  content: string,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage) return;
  try {
    if (!content) {
      storage.removeItem(GUILD_CHAT_DRAFT_STORAGE_KEY);
      return;
    }
    storage.setItem(GUILD_CHAT_DRAFT_STORAGE_KEY, content);
  } catch {
    /* quota / private mode */
  }
}

export function restoreGuildChatDraft(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): string {
  try {
    const raw = storage?.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY);
    return raw ?? "";
  } catch {
    return "";
  }
}
