import {
  detectMarchCompletions,
  detectNewMarchArrivalReminders,
  type MarchArrivalReminder,
} from "@/net/marchArrival";
import { marchNeedsPoll, MARCH_LIST_POLL_MS, type MarchSummary } from "@/net/militaryFormat";

export type MarchArrivalPollOptions = {
  listMarches: (cityId: number | undefined) => Promise<MarchSummary[]>;
  getCityId: () => number | undefined;
  onCompletions: (reminders: MarchArrivalReminder[]) => void;
  pollIntervalMs?: number;
};

/** 出征后在主城后台轮询 ListMarches，检测行军结束。 */
export class MarchArrivalPoll {
  private accumSec = 0;
  private lastMarches: MarchSummary[] = [];
  private readonly pendingIds = new Set<number>();
  private readonly intervalSec: number;

  constructor(private readonly opts: MarchArrivalPollOptions) {
    this.intervalSec = (opts.pollIntervalMs ?? MARCH_LIST_POLL_MS) / 1000;
  }

  reset(): void {
    this.accumSec = 0;
    this.lastMarches = [];
    this.pendingIds.clear();
  }

  trackMarch(marchId: number | undefined, seed?: MarchSummary): void {
    if (!marchId) return;
    this.pendingIds.add(marchId);
    if (seed?.march_id === marchId) {
      this.lastMarches = upsertMarch(this.lastMarches, seed);
    }
  }

  needsPoll(): boolean {
    return this.pendingIds.size > 0 || marchNeedsPoll(this.lastMarches);
  }

  tick(dtSec: number): void {
    if (!this.needsPoll()) return;
    this.accumSec += dtSec;
    if (this.accumSec < this.intervalSec) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  async pollOnce(): Promise<void> {
    const cityId = this.opts.getCityId();
    let next: MarchSummary[];
    try {
      next = await this.opts.listMarches(cityId);
    } catch {
      return;
    }
    const prev = this.lastMarches;
    const reminders = detectNewMarchArrivalReminders(prev, next, this.pendingIds);
    for (const ev of detectMarchCompletions(prev, next, this.pendingIds)) {
      this.pendingIds.delete(ev.marchId);
    }
    this.lastMarches = next;
    if (reminders.length) this.opts.onCompletions(reminders);
  }
}

function upsertMarch(list: MarchSummary[], row: MarchSummary): MarchSummary[] {
  const id = row.march_id ?? 0;
  if (!id) return list;
  const idx = list.findIndex((m) => m.march_id === id);
  if (idx < 0) return [...list, row];
  const next = [...list];
  next[idx] = { ...next[idx], ...row };
  return next;
}
