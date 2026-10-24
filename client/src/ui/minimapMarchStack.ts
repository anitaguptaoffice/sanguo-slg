import type { MarchSummary } from "@/net/militaryFormat";
import { formatMarchListSecondary } from "@/net/militaryFormat";
import {
  filterInProgressMarchesAtCell,
  countMarchesAtCell,
} from "@/ui/marchWorldListLink";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";

/** 与 {@link WORLD_TILE_NO_RECENT_MARCH_HINT} 同文案（避免 worldTileInfoCard ↔ 本模块循环依赖）。 */
export const WORLD_TILE_MARCH_SUMMARY_EMPTY_HINT =
  "最近行军：暂无指向此格的进行中行军（可打开军情查看历史）";

/** 小地图同格点多行军只读叠标（CLIENT-204；canvas 绘制 + 窄屏 manifest 钩子）。 */
export const MINIMAP_MARCH_STACK_BADGE_CLASS = "minimap-march-stack-badge";

/** 格点信息卡行军摘要次行（CLIENT-204）。 */
export const WORLD_TILE_MARCH_SUMMARY_LINE_CLASS = "world-tile-march-summary-line";

/** 指向格点的进行中行军条数（与 {@link countMarchesAtCell} 同口径，CLIENT-204 命名）。 */
export function countMarchesAtTile(
  marches: MarchSummary[],
  x: number,
  y: number,
): number {
  return countMarchesAtCell(marches, x, y);
}

/** 同格叠标文案；≤1 条时不展示角标。 */
export function formatMinimapMarchStackBadgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 1) return null;
  return `×${Math.trunc(count)}`;
}

/** 目的格一致且仍进行中的最近一条行军（depart_at_ms 降序，其次 march_id）。 */
export function findMostRecentInProgressMarchAtTile(
  marches: MarchSummary[],
  x: number,
  y: number,
): MarchSummary | undefined {
  const at = filterInProgressMarchesAtCell(marches, x, y);
  if (!at.length) return undefined;
  return [...at].sort((a, b) => {
    const da = a.depart_at_ms ?? 0;
    const db = b.depart_at_ms ?? 0;
    if (db !== da) return db - da;
    const ia = a.march_id ?? 0;
    const ib = b.march_id ?? 0;
    return ib - ia;
  })[0];
}

/** 格点信息卡次行：最近终点行军 phase/ETA（ListMarches 只读快照）。 */
export function formatWorldTileMarchSummaryLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  nowMs = Date.now(),
): string {
  const recent = findMostRecentInProgressMarchAtTile(marches, tile.x, tile.y);
  if (!recent) return WORLD_TILE_MARCH_SUMMARY_EMPTY_HINT;
  const id = recent.march_id ?? "?";
  const detail = formatMarchListSecondary(recent, nowMs);
  return `最近终点行军 #${id} · ${detail}`;
}

export type MinimapMarchStackBadgeLayout = {
  x: number;
  y: number;
  label: string;
};

/** 小地图目的格叠标布局（layout 坐标，供 canvas 绘制）。 */
/** 任一目的格存在叠标时，为 `#layout-frame` 挂上 manifest 钩子 class。 */
export function syncMinimapMarchStackBadgeClass(
  marches: MarchSummary[],
  layoutFrame: HTMLElement | null | undefined,
): void {
  if (!layoutFrame) return;
  let hasStack = false;
  const seen = new Set<string>();
  for (const m of marches) {
    const wx = m.to_x;
    const wy = m.to_y;
    if (wx == null || wy == null) continue;
    const key = `${wx},${wy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (countMarchesAtTile(marches, wx, wy) > 1) {
      hasStack = true;
      break;
    }
  }
  layoutFrame.classList.toggle(MINIMAP_MARCH_STACK_BADGE_CLASS, hasStack);
}

export function layoutMinimapMarchStackBadges(
  marches: MarchSummary[],
  destKeys: Iterable<{ wx: number; wy: number }>,
  worldToLayout: (wx: number, wy: number) => { x: number; y: number },
): MinimapMarchStackBadgeLayout[] {
  const out: MinimapMarchStackBadgeLayout[] = [];
  for (const { wx, wy } of destKeys) {
    const count = countMarchesAtTile(marches, wx, wy);
    const label = formatMinimapMarchStackBadgeLabel(count);
    if (!label) continue;
    const p = worldToLayout(wx, wy);
    out.push({ x: p.x + 8, y: p.y - 10, label });
  }
  return out;
}
