import {
  applyBattleReportMinimapFocus,
  type BattleReportLocation,
} from "@/net/battleReportMinimapFocus";
import type { BattleReportSummary, MarchSummary } from "@/net/militaryFormat";
import {
  filterMarchesByDestination,
  manhattanGridDistance,
} from "@/ui/marchWorldListLink";
import {
  openWorldMinimapExpanded,
  type MinimapView,
  type WorldBounds as MinimapWorldBounds,
} from "@/ui/worldMinimap";

export const BATTLE_REPORT_COORD_REPLAY_ACTION = "battle-report-coord-replay";
export const BATTLE_REPORT_VIEW_INTEL_ACTION = "battle-report-view-intel";
export const MARCH_INFO_REPLAY_BATTLE_REPORT_ACTION = "march-info-replay-battle-report";

export const BATTLE_REPORT_REPLAY_SESSION_KEY = "battle-report-replay-v1";

export type BattleReportReplaySessionV1 = {
  reportId: number;
  wx: number;
  wy: number;
};

export type OpenMinimapForBattleCoordsInput = {
  location: BattleReportLocation;
  bounds: MinimapWorldBounds;
  currentView: MinimapView;
  minimapCollapsed: boolean;
  storage?: Pick<Storage, "setItem"> | null;
};

export type OpenMinimapForBattleCoordsResult = {
  minimapCollapsed: false;
  didExpandMinimap: boolean;
  focus: ReturnType<typeof applyBattleReportMinimapFocus>;
};

/** 战报「坐标复盘」：展开小地图 + CLIENT-142 复盘 framing（纯函数，调用方写 scene 状态）。 */
export function openMinimapForBattleCoords(
  input: OpenMinimapForBattleCoordsInput,
): OpenMinimapForBattleCoordsResult {
  const expanded = openWorldMinimapExpanded(
    input.minimapCollapsed,
    input.storage ?? undefined,
  );
  const focus = applyBattleReportMinimapFocus(
    input.location,
    input.bounds,
    input.currentView,
  );
  return {
    minimapCollapsed: expanded.collapsed,
    didExpandMinimap: expanded.didExpand,
    focus,
  };
}

export type IntelRowNearCoordsResolution = {
  marchId: number;
  march: MarchSummary;
  /** 0 = 目的格与战报坐标一致 */
  gridDistance: number;
};

function marchRecencyKey(m: MarchSummary): number {
  const arrive = m.arrive_at_ms ?? 0;
  const depart = m.depart_at_ms ?? 0;
  const id = m.march_id ?? 0;
  return Math.max(arrive, depart, id);
}

function pickLatestMarch(candidates: MarchSummary[]): MarchSummary | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => marchRecencyKey(b) - marchRecencyKey(a))[0] ?? null;
}

/**
 * 军情只读匹配：优先同目的格行军，否则曼哈顿最近的目的格行军（无新 RPC）。
 */
export function resolveIntelRowNearCoords(
  marches: MarchSummary[],
  wx: number,
  wy: number,
): IntelRowNearCoordsResolution | null {
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;

  const exact = filterMarchesByDestination(marches, wx, wy);
  const exactPick = pickLatestMarch(exact);
  if (exactPick?.march_id != null && exactPick.march_id > 0) {
    return { marchId: exactPick.march_id, march: exactPick, gridDistance: 0 };
  }

  let best: MarchSummary | null = null;
  let bestDist: number | null = null;
  for (const m of marches) {
    const d = manhattanGridDistance(wx, wy, m.to_x, m.to_y);
    if (d == null) continue;
    if (
      best == null ||
      d < bestDist! ||
      (d === bestDist && marchRecencyKey(m) > marchRecencyKey(best))
    ) {
      best = m;
      bestDist = d;
    }
  }
  if (best?.march_id == null || best.march_id <= 0 || bestDist == null) return null;
  return { marchId: best.march_id, march: best, gridDistance: bestDist };
}

export function writeBattleReportReplaySession(
  payload: BattleReportReplaySessionV1,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (payload.reportId <= 0) return;
  try {
    storage?.setItem(BATTLE_REPORT_REPLAY_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readBattleReportReplaySession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BattleReportReplaySessionV1 | null {
  try {
    const raw = storage?.getItem(BATTLE_REPORT_REPLAY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BattleReportReplaySessionV1;
    if (
      !parsed ||
      typeof parsed.reportId !== "number" ||
      typeof parsed.wx !== "number" ||
      typeof parsed.wy !== "number"
    ) {
      return null;
    }
    if (parsed.reportId <= 0 || !Number.isFinite(parsed.wx) || !Number.isFinite(parsed.wy)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildBattleReportReplaySessionFromSummary(
  summary: BattleReportSummary,
): BattleReportReplaySessionV1 | null {
  const reportId = summary.report_id ?? 0;
  const wx = summary.location_x;
  const wy = summary.location_y;
  if (reportId <= 0 || wx == null || wy == null || !Number.isFinite(wx) || !Number.isFinite(wy)) {
    return null;
  }
  return { reportId, wx, wy };
}

/** 军情信息卡「复盘战报」：行军 report_id 优先，否则同格 session 只读匹配。 */
export function resolveBattleReportIdForMarchReplay(
  march: MarchSummary,
  session: BattleReportReplaySessionV1 | null,
): number | null {
  const fromMarch = march.report_id;
  if (fromMarch != null && fromMarch > 0) return fromMarch;
  if (!session) return null;
  const tx = march.to_x;
  const ty = march.to_y;
  if (tx == null || ty == null) return null;
  if (tx === session.wx && ty === session.wy && session.reportId > 0) return session.reportId;
  return null;
}

export function canOfferBattleReportIntelJump(
  marches: MarchSummary[],
  summary: BattleReportSummary | undefined | null,
): boolean {
  const wx = summary?.location_x;
  const wy = summary?.location_y;
  if (wx == null || wy == null || !Number.isFinite(wx) || !Number.isFinite(wy)) return false;
  return resolveIntelRowNearCoords(marches, wx, wy) != null;
}
