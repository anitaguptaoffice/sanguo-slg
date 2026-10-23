import { describe, expect, it } from "vitest";
import {
  countDailyQuestsByState,
  dailyQuestMatchesListFilter,
  dailyQuestRowsForList,
  DAILY_QUEST_FILTER_SESSION_KEY,
  filterDailyQuestRows,
  orderDailyQuestRowsForDisplay,
  parseDailyQuestListFilterSessionValue,
  readDailyQuestListFilterSession,
  writeDailyQuestListFilterSession,
} from "@/net/dailyQuestListFilter";
import type { DailyQuestRow } from "@/net/dailyQuestState";

const sample: DailyQuestRow[] = [
  { quest_cfg_id: 1, state: 1 },
  { quest_cfg_id: 2, state: 2 },
  { quest_cfg_id: 3, state: 3 },
  { quest_cfg_id: 4, state: 4 },
  { quest_cfg_id: 5, state: 2 },
];

describe("dailyQuestListFilter", () => {
  it("parses and persists session filter key daily-quest-filter", () => {
    expect(DAILY_QUEST_FILTER_SESSION_KEY).toBe("daily-quest-filter");
    expect(parseDailyQuestListFilterSessionValue("in_progress")).toBe("in_progress");
    expect(parseDailyQuestListFilterSessionValue("bogus")).toBeNull();
    const storage = {
      data: {} as Record<string, string>,
      getItem(k: string) {
        return this.data[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.data[k] = v;
      },
    };
    writeDailyQuestListFilterSession("claimable", storage);
    expect(readDailyQuestListFilterSession(storage)).toBe("claimable");
  });

  it("filters rows by state", () => {
    expect(filterDailyQuestRows(sample, "all")).toHaveLength(5);
    expect(filterDailyQuestRows(sample, "in_progress").map((q) => q.quest_cfg_id)).toEqual([
      2, 5,
    ]);
    expect(filterDailyQuestRows(sample, "claimable").map((q) => q.quest_cfg_id)).toEqual([3]);
    expect(filterDailyQuestRows(sample, "completed").map((q) => q.quest_cfg_id)).toEqual([4]);
    expect(dailyQuestMatchesListFilter({ state: 1 }, "claimable")).toBe(false);
  });

  it("counts state buckets for summary chips", () => {
    expect(countDailyQuestsByState(sample)).toEqual({
      acceptable: 1,
      inProgress: 2,
      claimable: 1,
      completed: 1,
    });
  });

  it("pins completed rows to bottom when enabled", () => {
    const ordered = orderDailyQuestRowsForDisplay(
      [
        { quest_cfg_id: 10, state: 4 },
        { quest_cfg_id: 11, state: 2 },
        { quest_cfg_id: 12, state: 4 },
      ],
      true,
    );
    expect(ordered.map((q) => q.quest_cfg_id)).toEqual([11, 10, 12]);
    const rows = dailyQuestRowsForList(
      [
        { quest_cfg_id: 20, state: 4 },
        { quest_cfg_id: 21, state: 3 },
      ],
      "all",
      true,
    );
    expect(rows.map((q) => q.quest_cfg_id)).toEqual([21, 20]);
  });
});
