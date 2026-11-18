import { unitLabel } from "./militaryFormat";

type CurrentRecruitJob = {
  queue_id: number;
  unit_cfg_id: number;
  count: number;
  status: 0 | 1;
  finish_at_ms: number;
};

export type CurrentRecruitQueue = {
  jobs: CurrentRecruitJob[];
  hasMore: boolean;
};

/** An absent or invalid read is unavailable; only a present empty view means zero pending. */
export function parseCurrentRecruitQueue(value: unknown): CurrentRecruitQueue | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const { jobs = [], has_more = false } = value as { jobs?: unknown; has_more?: unknown };
  if (!Array.isArray(jobs) || jobs.length > 64 || typeof has_more !== "boolean" ||
      has_more && jobs.length !== 64) return null;
  const validated: CurrentRecruitJob[] = [];
  let previous = 0;
  for (const row of jobs) {
    const { queue_id, unit_cfg_id, count, status = 0, finish_at_ms } = row ?? {};
    const expected = validated.length === 0 ? 1 : 0;
    if (!Number.isSafeInteger(queue_id) || queue_id <= previous || ![1, 2, 3, 4].includes(unit_cfg_id) ||
        !Number.isInteger(count) || count <= 0 || count > 2147483647 || status !== expected ||
        !Number.isSafeInteger(finish_at_ms) || finish_at_ms < -62135596800000 || finish_at_ms > 253402300799999) {
      return null;
    }
    validated.push({ queue_id, unit_cfg_id, count, status: expected, finish_at_ms });
    previous = queue_id;
  }
  return { jobs: validated, hasMore: has_more };
}

/** Render stored status; the clock never completes or hides a pending row. */
export function renderCurrentRecruitQueue(list: Element, queue: CurrentRecruitQueue | null): void {
  const rows = (queue?.jobs ?? []).map(job => {
    const row = document.createElement("li");
    row.className = "queue-list-row";
    row.dataset.queueId = String(job.queue_id);
    const status = job.status === 1 ? "训练中" : "等待";
    const finish = new Date(job.finish_at_ms).toLocaleString("zh-CN", { hour12: false });
    row.textContent = `${unitLabel(job.unit_cfg_id)}×${job.count} · ${status} · 预计完成 ${finish}`;
    return row;
  });
  if (!rows.length || queue?.hasMore) {
    const note = document.createElement("li");
    note.className = "queue-list-empty";
    note.textContent = queue?.hasMore ? "还有更多排队任务" : queue ? "暂无募兵" : "募兵队列待同步";
    rows.push(note);
  }
  list.classList.remove("hidden");
  list.replaceChildren(...rows);
}
