import { formatSocialPanelStaleDataLabel } from "@/net/socialFormat";

/** 社交面板「上次更新」本地时间戳（CLIENT-045）。 */
export function formatSocialPanelLastUpdated(atMs: number): string {
  const d = new Date(atMs);
  return `上次更新：${d.toLocaleString("zh-CN", { hour12: false })}`;
}

export function formatSocialPanelRefreshError(message: string): string {
  return `刷新失败：${message}`;
}

/** 成功刷新后的状态行；stale 时追加 CLIENT-053 陈旧标注。 */
export function formatSocialPanelLastUpdatedLine(atMs: number, stale = false): string {
  const base = formatSocialPanelLastUpdated(atMs);
  if (!stale) return base;
  return `${base} · ${formatSocialPanelStaleDataLabel()}`;
}
