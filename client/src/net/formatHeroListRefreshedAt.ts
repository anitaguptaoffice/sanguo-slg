import { formatPanelRefreshStamp } from "@/net/panelRefreshStamp";

/** 将领列表手动刷新成功后的相对戳记（CLIENT-182；与排行/社交共用相对时间规则）。 */
export function formatHeroListRefreshedAt(atMs: number, nowMs = Date.now()): string {
  const stamp = formatPanelRefreshStamp(atMs, nowMs);
  if (!stamp) return "";
  return stamp.replace(/^上次刷新：/, "列表更新：");
}
