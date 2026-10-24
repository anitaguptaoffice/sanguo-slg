import type { MarchSummary } from "@/net/militaryFormat";

export const MARCH_PHASE_CHANGED_PULSE_CLASS = "march-phase-changed";
/** 阶段变更行内脉冲时长（CLIENT-141 / 与队列完成脉冲同为 3s）。 */
export const MARCH_PHASE_CHANGED_PULSE_MS = 3000;

/**
 * 相对上一轮 ListMarches 快照，返回 phase 发生变化的 march_id（不含新出现的行军）。
 */
export function detectMarchPhaseChanges(
  previous: readonly MarchSummary[],
  next: readonly MarchSummary[],
): number[] {
  const prevPhaseById = new Map<number, number>();
  for (const row of previous) {
    const id = row.march_id;
    if (id == null || !Number.isFinite(id)) continue;
    prevPhaseById.set(id, row.phase ?? 0);
  }
  const changed: number[] = [];
  for (const row of next) {
    const id = row.march_id;
    if (id == null || !Number.isFinite(id)) continue;
    const before = prevPhaseById.get(id);
    if (before === undefined) continue;
    const after = row.phase ?? 0;
    if (before !== after) changed.push(id);
  }
  return changed;
}

export function scheduleMarchPhaseChangedPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MARCH_PHASE_CHANGED_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MARCH_PHASE_CHANGED_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(MARCH_PHASE_CHANGED_PULSE_CLASS),
    MARCH_PHASE_CHANGED_PULSE_MS,
  );
}
