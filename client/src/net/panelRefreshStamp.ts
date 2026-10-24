/** 社交面板「上次刷新」相对时间文案（CLIENT-144；排行/军团/聊天共用）。 */

export function formatPanelRefreshRelative(atMs: number, nowMs: number): string | null {
  const delta = nowMs - atMs;
  if (delta < 0) return null;
  const min = Math.floor(delta / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} 小时前`;
  return null;
}

/** 成功刷新后的「上次刷新」戳记；48h 内为相对时间，否则回退本地绝对时间。 */
export function formatPanelRefreshStamp(atMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(atMs) || atMs <= 0) return "";
  const rel = formatPanelRefreshRelative(atMs, nowMs);
  if (rel) return `上次刷新：${rel}`;
  const d = new Date(atMs);
  return `上次刷新：${d.toLocaleString("zh-CN", { hour12: false })}`;
}
