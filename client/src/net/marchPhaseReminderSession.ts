/** sessionStorage：本会话已对玩家展示过阶段到达提醒的 march_id（CLIENT-085）。 */
export const MARCH_PHASE_REMINDER_SESSION_KEY = "rxsg.client.marchPhaseReminder.ids";

export function loadRemindedMarchIds(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): Set<number> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(MARCH_PHASE_REMINDER_SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<number>();
    for (const v of parsed) {
      const id = typeof v === "number" ? v : Number(v);
      if (id > 0) out.add(id);
    }
    return out;
  } catch {
    return new Set();
  }
}

export function saveRemindedMarchIds(
  ids: ReadonlySet<number>,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(MARCH_PHASE_REMINDER_SESSION_KEY, JSON.stringify([...ids].sort((a, b) => a - b)));
  } catch {
    // quota / private mode
  }
}

/** 过滤已提醒过的 march_id，并将新 id 写入 sessionStorage。 */
export function takeUnremindedMarchIds(
  marchIds: readonly number[],
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number[] {
  const reminded = loadRemindedMarchIds(storage);
  const fresh: number[] = [];
  for (const id of marchIds) {
    if (id <= 0 || reminded.has(id)) continue;
    reminded.add(id);
    fresh.push(id);
  }
  if (fresh.length) saveRemindedMarchIds(reminded, storage);
  return fresh;
}
