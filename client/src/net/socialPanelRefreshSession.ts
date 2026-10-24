/** sessionStorage：聊天/军团面板手动刷新成功时刻（CLIENT-144，不新 RPC）。 */
export const CHAT_PANEL_LAST_REFRESH_SESSION_KEY = "chat-panel-last-refresh-ms";
export const GUILD_PANEL_LAST_REFRESH_SESSION_KEY = "guild-panel-last-refresh-ms";

export function readSocialPanelLastRefreshMs(
  key: string,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  try {
    const raw = storage?.getItem(key);
    const n = raw != null && raw !== "" ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

export function writeSocialPanelLastRefreshMs(
  key: string,
  atMs: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(atMs) || atMs <= 0) return;
  try {
    storage?.setItem(key, String(Math.trunc(atMs)));
  } catch {
    /* quota / private mode */
  }
}
