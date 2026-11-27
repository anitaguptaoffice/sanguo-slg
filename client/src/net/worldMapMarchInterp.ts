/** 世界大地图行军路径插值（纯函数，供 WorldMapScene 与单测）。 */

export type WorldMapMarchDrawInput = {
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  phase?: number;
  depart_at_ms?: number;
  arrive_at_ms?: number;
  return_finish_at_ms?: number;
};

export const DEFAULT_MARCH_DURATION_MS = 15 * 60_000;

export type MarchTimeline = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startMs: number;
  endMs: number;
  moving: boolean;
  remainingSec: number | null;
};

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** 按 phase 与到达/返程时间解析当前路段与进度窗口。 */
export function resolveMarchTimeline(march: WorldMapMarchDrawInput, nowMs: number): MarchTimeline {
  const phase = march.phase ?? 0;
  const fromX = march.from_x;
  const fromY = march.from_y;
  const toX = march.to_x;
  const toY = march.to_y;
  const arrive = march.arrive_at_ms ?? 0;
  const depart = march.depart_at_ms;
  const returnFinish = march.return_finish_at_ms ?? 0;

  if (phase === 1 || phase === 5) {
    return {
      fromX,
      fromY,
      toX: fromX,
      toY: fromY,
      startMs: nowMs,
      endMs: nowMs,
      moving: false,
      remainingSec: null,
    };
  }
  if (phase === 3) {
    return {
      fromX: toX,
      fromY: toY,
      toX,
      toY,
      startMs: nowMs,
      endMs: nowMs,
      moving: false,
      remainingSec: null,
    };
  }
  if (phase === 4 && arrive > 0 && returnFinish > arrive) {
    const moving = nowMs < returnFinish;
    const progress = moving ? clamp01((nowMs - arrive) / (returnFinish - arrive)) : 1;
    return {
      fromX: toX,
      fromY: toY,
      toX: fromX,
      toY: fromY,
      startMs: arrive,
      endMs: returnFinish,
      moving,
      remainingSec: moving ? Math.max(0, Math.ceil((returnFinish - nowMs) / 1000)) : null,
    };
  }
  // phase 2 / 0 / 未知：去程
  const endMs = arrive > 0 ? arrive : nowMs + DEFAULT_MARCH_DURATION_MS;
  let startMs =
    depart == null || depart >= endMs ? endMs - DEFAULT_MARCH_DURATION_MS : depart;
  const moving = phase === 2 || (arrive > nowMs && phase !== 3 && phase !== 5);
  const progress =
    endMs > startMs ? clamp01((nowMs - startMs) / (endMs - startMs)) : phase === 2 ? 0.35 : 1;
  const activeMove = moving && progress < 1;
  return {
    fromX,
    fromY,
    toX,
    toY,
    startMs,
    endMs,
    moving: activeMove,
    remainingSec: activeMove ? Math.max(0, Math.ceil((endMs - nowMs) / 1000)) : null,
  };
}

export function marchPathProgress01(march: WorldMapMarchDrawInput, nowMs: number): number {
  const t = resolveMarchTimeline(march, nowMs);
  if (!t.moving && t.startMs === t.endMs) {
    if ((march.phase ?? 0) === 3) return 1;
    if ((march.phase ?? 0) === 1 || (march.phase ?? 0) === 5) return 0;
    return (march.phase ?? 0) === 4 ? 1 : 0;
  }
  if (t.endMs <= t.startMs) return 0;
  return clamp01((nowMs - t.startMs) / (t.endMs - t.startMs));
}

export function marchInterpolatedTile(
  march: WorldMapMarchDrawInput,
  nowMs: number,
): { x: number; y: number; progress: number; remainingSec: number | null; moving: boolean } {
  const t = resolveMarchTimeline(march, nowMs);
  const progress = marchPathProgress01(march, nowMs);
  const x = t.fromX + (t.toX - t.fromX) * progress;
  const y = t.fromY + (t.toY - t.fromY) * progress;
  return { x, y, progress, remainingSec: t.remainingSec, moving: t.moving };
}

/** 地图上是否仍有需逐帧刷新的行进中路线。 */
export function worldMapMarchNeedsAnimation(marches: WorldMapMarchDrawInput[], nowMs: number): boolean {
  return marches.some((m) => {
    const p = m.phase ?? 0;
    if (p !== 2 && p !== 4) return false;
    const t = resolveMarchTimeline(m, nowMs);
    return t.moving;
  });
}