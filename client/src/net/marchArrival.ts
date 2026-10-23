import type { MarchSummary } from "@/net/militaryFormat";

export const MARCH_PHASE_MARCHING = 2;
export const MARCH_PHASE_ARRIVED = 3;
export const MARCH_PHASE_RETURNING = 4;

export const MARCH_ARRIVAL_STATUS_TOAST = "行军结束，查看战报";

export type MarchCompletionKind = "phase" | "vanished";

export type MarchCompletionEvent = {
  kind: MarchCompletionKind;
  marchId: number;
};

/** marching(2) → arrived(3) / returning(4) */
export function marchPhaseTransitionSignalsCompletion(
  prevPhase: number | undefined,
  nextPhase: number | undefined,
): boolean {
  return (
    (prevPhase ?? 0) === MARCH_PHASE_MARCHING &&
    ((nextPhase ?? 0) === MARCH_PHASE_ARRIVED || (nextPhase ?? 0) === MARCH_PHASE_RETURNING)
  );
}

function marchById(marches: MarchSummary[]): Map<number, MarchSummary> {
  const map = new Map<number, MarchSummary>();
  for (const m of marches) {
    const id = m.march_id ?? 0;
    if (id > 0) map.set(id, m);
  }
  return map;
}

/**
 * 对比两次 ListMarches 快照：阶段行军→到达/撤回，或 pending 中的行军行消失。
 */
export function detectMarchCompletions(
  previous: MarchSummary[],
  next: MarchSummary[],
  pendingMarchIds: ReadonlySet<number>,
): MarchCompletionEvent[] {
  const prevMap = marchById(previous);
  const nextMap = marchById(next);
  const events: MarchCompletionEvent[] = [];
  const seen = new Set<number>();

  for (const [id, prevRow] of prevMap) {
    const nextRow = nextMap.get(id);
    if (nextRow) {
      if (marchPhaseTransitionSignalsCompletion(prevRow.phase, nextRow.phase)) {
        events.push({ kind: "phase", marchId: id });
        seen.add(id);
      }
    } else if (pendingMarchIds.has(id)) {
      events.push({ kind: "vanished", marchId: id });
      seen.add(id);
    }
  }

  for (const id of pendingMarchIds) {
    if (seen.has(id)) continue;
    const prevRow = prevMap.get(id);
    const nextRow = nextMap.get(id);
    if (prevRow && !nextRow) {
      events.push({ kind: "vanished", marchId: id });
      continue;
    }
    if (!prevRow && nextRow && marchPhaseTransitionSignalsCompletion(MARCH_PHASE_MARCHING, nextRow.phase)) {
      // 首次轮询即已是终态（极短行军），仍算完成
      events.push({ kind: "phase", marchId: id });
    }
  }

  return events;
}
