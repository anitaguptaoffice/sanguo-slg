import {
  isRecruitQueueActive,
  type RecruitQueueEntry,
} from "@/net/queueState";

/** 募兵队列与七槽矩阵互跳锚点（兵营槽）。 */
export const RECRUIT_QUEUE_MATRIX_SLOT_KEY = "barracks";

export const QUEUE_RECRUIT_COMPLETE_PULSE_CLASS = "queue-recruit-complete-pulse";
export const QUEUE_RECRUIT_COMPLETE_PULSE_MS = 3000;

/** 募兵队列行与兵营矩阵格互高亮（CLIENT-149）。 */
export const QUEUE_RECRUIT_SLOT_MUTUAL_HIGHLIGHT_CLASS = "queue-recruit-slot-mutual-highlight";

function recruitById(entries: RecruitQueueEntry[] | undefined): Map<number, RecruitQueueEntry> {
  const map = new Map<number, RecruitQueueEntry>();
  for (const e of entries ?? []) {
    if ((e.queue_id ?? 0) > 0) map.set(e.queue_id, e);
  }
  return map;
}

/**
 * 募兵队列快照前后对比：某批次 `finish_at_ms` 由进行中变为已完成（或从列表移除）。
 */
export function detectRecruitQueueJustCompleted(
  prev: RecruitQueueEntry[] | undefined,
  next: RecruitQueueEntry[] | undefined,
  nowMs = Date.now(),
): number[] {
  const nextMap = recruitById(next);
  const completed: number[] = [];
  for (const entry of prev ?? []) {
    if (!isRecruitQueueActive(entry, nowMs)) continue;
    const updated = nextMap.get(entry.queue_id);
    if (!updated || !isRecruitQueueActive(updated, nowMs)) {
      completed.push(entry.queue_id);
    }
  }
  return completed.sort((a, b) => a - b);
}

export function scheduleQueueRecruitCompletePulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(QUEUE_RECRUIT_COMPLETE_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEUE_RECRUIT_COMPLETE_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(QUEUE_RECRUIT_COMPLETE_PULSE_CLASS),
    QUEUE_RECRUIT_COMPLETE_PULSE_MS,
  );
}
