/** 社交面板「上次更新」本地时间戳（CLIENT-045）。 */
export function formatSocialPanelLastUpdated(atMs: number): string {
  const d = new Date(atMs);
  return `上次更新：${d.toLocaleString("zh-CN", { hour12: false })}`;
}

export function formatSocialPanelRefreshError(message: string): string {
  return `刷新失败：${message}`;
}
