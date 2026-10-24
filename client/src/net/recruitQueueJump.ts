import {
  isRecruitQueueActive,
  pruneFinishedRecruits,
  type RecruitQueueEntry,
} from "@/net/queueState";

/** sessionStorage：募兵队列与军事互跳时高亮的 `queue_id`（CLIENT-157）。 */
export const RECRUIT_HIGHLIGHT_QUEUE_SESSION_KEY = "recruit-highlight-queue-id";

export const MILITARY_RECRUIT_SECTION_ROLE = "military-recruit-section";
export const MILITARY_RECRUIT_UNIT_FIELD = "unit";

export type RecruitQueueJumpTarget = {
  queue_id: number;
  unit_cfg_id: number;
  /** 募兵队列列表首行（最早完成）的 queue_id，用于队列面板首行互高亮。 */
  head_queue_id: number;
};

export function activeRecruitQueueSorted(
  entries: RecruitQueueEntry[] | undefined,
  nowMs = Date.now(),
): RecruitQueueEntry[] {
  return pruneFinishedRecruits(entries ?? [], nowMs)
    .filter((e) => isRecruitQueueActive(e, nowMs))
    .sort((a, b) => a.finish_at_ms - b.finish_at_ms);
}

/**
 * 从只读募兵队列快照解析互跳目标（不发 RPC）。
 * `queueId` ≤ 0 时取首行（最早完成批次）。
 */
export function resolveRecruitQueueJumpTarget(
  queueId: number,
  entries: RecruitQueueEntry[] | undefined,
  nowMs = Date.now(),
): RecruitQueueJumpTarget | null {
  const active = activeRecruitQueueSorted(entries, nowMs);
  if (!active.length) return null;
  const head = active[0];
  const targetId = queueId > 0 ? queueId : head.queue_id;
  const entry = active.find((e) => e.queue_id === targetId);
  if (!entry) return null;
  return {
    queue_id: entry.queue_id,
    unit_cfg_id: entry.unit_cfg_id,
    head_queue_id: head.queue_id,
  };
}

export function parseRecruitHighlightQueueSessionValue(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  const id = Math.trunc(Number(raw));
  return id > 0 ? id : null;
}

export function writeRecruitHighlightQueueSession(
  queueId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (queueId <= 0 || !storage) return;
  try {
    storage.setItem(RECRUIT_HIGHLIGHT_QUEUE_SESSION_KEY, String(queueId));
  } catch {
    /* quota / private mode */
  }
}

export function readRecruitHighlightQueueSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseRecruitHighlightQueueSessionValue(
      storage?.getItem(RECRUIT_HIGHLIGHT_QUEUE_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function clearRecruitHighlightQueueSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(RECRUIT_HIGHLIGHT_QUEUE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** 军事募兵区「查看队列」链：有进行中募兵时展示。 */
export function syncMilitaryRecruitViewQueueLink(
  panel: ParentNode | null | undefined,
  entries: RecruitQueueEntry[],
  highlightQueueId: number | null,
  nowMs = Date.now(),
): number | null {
  const wrap = panel?.querySelector<HTMLElement>('[data-role="recruit-view-queue-wrap"]');
  const btn = panel?.querySelector<HTMLButtonElement>('[data-action="view-recruit-queue"]');
  const target = resolveRecruitQueueJumpTarget(highlightQueueId ?? 0, entries, nowMs);
  if (!wrap || !btn) return target?.queue_id ?? null;
  if (!target) {
    wrap.classList.add("hidden");
    btn.removeAttribute("data-queue-id");
    return null;
  }
  wrap.classList.remove("hidden");
  btn.dataset.queueId = String(target.queue_id);
  return target.queue_id;
}

/** 队列行互跳军事：预选兵种并滚动募兵区（只读快照）。 */
export function applyRecruitQueueJumpToMilitaryPanel(
  panel: ParentNode | null | undefined,
  target: RecruitQueueJumpTarget,
): void {
  const unitSelect = panel?.querySelector<HTMLSelectElement>(
    `[data-field="${MILITARY_RECRUIT_UNIT_FIELD}"]`,
  );
  if (unitSelect) {
    unitSelect.value = String(target.unit_cfg_id);
  }
  const section = panel?.querySelector<HTMLElement>(`[data-role="${MILITARY_RECRUIT_SECTION_ROLE}"]`);
  section?.classList.add("military-recruit-section-jump-highlight");
  window.setTimeout(() => section?.classList.remove("military-recruit-section-jump-highlight"), 3000);
  if (section && typeof section.scrollIntoView === "function") {
    section.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
