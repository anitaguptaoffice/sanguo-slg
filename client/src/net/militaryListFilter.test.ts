import { describe, expect, it, beforeEach } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  applyMilitaryListClientFilters,
  DEFAULT_MILITARY_LIST_FILTER,
  MILITARY_LIST_FILTER_SESSION_KEY,
  marchMatchesMilitaryListPhaseFilter,
  parseMilitaryListFilterSessionValue,
  readMilitaryListFilterSession,
  sortMarchesForMilitaryList,
  writeMilitaryListFilterSession,
} from "@/net/militaryListFilter";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const marches: MarchSummary[] = [
  { march_id: 1, phase: 2, arrive_at_ms: 3000 },
  { march_id: 2, phase: 4, arrive_at_ms: 500, return_finish_at_ms: 1000 },
  { march_id: 3, phase: 3, arrive_at_ms: 5000 },
  { march_id: 4, phase: 1, arrive_at_ms: 2000 },
];

describe("militaryListFilter", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("filters marches by phase chip mapping", () => {
    expect(marchMatchesMilitaryListPhaseFilter(marches[0], "outbound")).toBe(true);
    expect(marchMatchesMilitaryListPhaseFilter(marches[1], "return")).toBe(true);
    expect(marchMatchesMilitaryListPhaseFilter(marches[0], "return")).toBe(false);
    const filtered = applyMilitaryListClientFilters(
      marches,
      { phase: "return", etaSort: "default" },
      0,
    );
    expect(filtered.map((m) => m.march_id)).toEqual([2]);
  });

  it("treats default eta sort as earliest arrival (eta_asc)", () => {
    const byDefault = sortMarchesForMilitaryList(marches, "default", 0);
    const byAsc = sortMarchesForMilitaryList(marches, "eta_asc", 0);
    expect(byDefault.map((m) => m.march_id)).toEqual(byAsc.map((m) => m.march_id));
  });

  it("sorts marches by ETA ascending for outbound/return phases", () => {
    const sorted = sortMarchesForMilitaryList(
      marches.filter((m) => (m.phase ?? 0) === 2 || (m.phase ?? 0) === 4),
      "eta_asc",
      0,
    );
    expect(sorted.map((m) => m.march_id)).toEqual([2, 1]);
  });

  it("persists filter JSON in sessionStorage key military-list-filter-v1", () => {
    const state = { phase: "outbound" as const, etaSort: "eta_desc" as const };
    writeMilitaryListFilterSession(state, storage);
    expect(storage.getItem(MILITARY_LIST_FILTER_SESSION_KEY)).toBe(JSON.stringify(state));
    expect(readMilitaryListFilterSession(storage)).toEqual(state);
  });

  it("parseMilitaryListFilterSessionValue rejects invalid payloads", () => {
    expect(parseMilitaryListFilterSessionValue(null)).toBeNull();
    expect(parseMilitaryListFilterSessionValue('{"phase":"all"}')).toBeNull();
    expect(parseMilitaryListFilterSessionValue('{"phase":"nope","etaSort":"default"}')).toBeNull();
    expect(
      parseMilitaryListFilterSessionValue(
        JSON.stringify({ phase: "all", etaSort: "eta_asc" }),
      ),
    ).toEqual({ phase: "all", etaSort: "eta_asc" });
  });

  it("falls back to default when session missing", () => {
    expect(readMilitaryListFilterSession(storage)).toEqual(DEFAULT_MILITARY_LIST_FILTER);
    expect(DEFAULT_MILITARY_LIST_FILTER.etaSort).toBe("eta_asc");
  });
});
