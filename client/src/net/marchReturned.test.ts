import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { getTypes } from "./loadProto";
import {
  formatMarchEta, formatMarchHint, formatMarchListSecondary, formatMarchPhase,
  formatMarchRowMetaLine, formatMarchRowRecentEtaBrief, marchNeedsPoll,
  marchPhaseChipClass, marchPhaseChipLabel, type MarchSummary,
} from "./militaryFormat";
import { formatMarchEtaLine, formatMarchInfoCardPrimary } from "./marchInfoCard";
import { formatMarchIntelPhaseEtaStrip } from "./marchIntelPhaseEtaStrip";
import { formatMarchReadonlyLineFromMarch } from "./marchFormReadonlyStrip";
import { MarchArrivalPoll } from "./marchArrivalPoll";
import { detectNewMarchArrivalReminders } from "./marchArrival";
import { heroIdsOnActiveMarch } from "./cityChiefOffice";
import { applyMilitaryListClientFilters, DEFAULT_MILITARY_LIST_FILTER } from "./militaryListFilter";
import { countIntelInProgressMarches, findFirstIntelInProgressMarchId } from "./hudMilitaryTodoSweep";
import { buildMarchIntelRemarchPrefill } from "./marchIntelRemarch";
import { collectMinimapDestMarkers, marchHasRouteOnMinimap, minimapDestShowsEtaBadge } from "@/ui/worldMinimap";
import { countMarchesAtTile, findMostRecentInProgressMarchAtTile } from "@/ui/minimapMarchStack";
import { buildWorldInfoCardSummary } from "@/ui/worldInfoCard";
import { filterMarchesByDestination } from "@/ui/marchWorldListLink";

const now = 1_800_000_000_000;
const row: MarchSummary = {
  march_id: 7, phase: 5, from_x: 60, from_y: 60, to_x: 5, to_y: 5, purpose: 1,
  depart_at_ms: now - 120_000, arrive_at_ms: now - 60_000, return_finish_at_ms: 0,
  report_id: 9, troops: [{ unit_cfg_id: 1, count: 19, wounded: 0 }],
};
function decode(rows: MarchSummary[]): MarchSummary[] {
  const type = getTypes().ListMarchesResponse;
  const bytes = type.encode(type.create({ marches: rows, total: rows.length })).finish();
  return decodeGatewayResponse(type, bytes).marches as MarchSummary[];
}
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("returned-home numeric wire consumers", () => {
  it("decodes the regenerated Go binding fixture without enum remapping", () => {
    // Synthetic Go codec fixture from API binding ca091599; not a natural lifecycle.
    const bytes = Uint8Array.from(atob("Cg4ICxAVGB9IBVDoB1jQDwoICAwQFhgfSAEKCwgNEBcYH0gEYLgXCggIDhAYGB9IfxAE"), c => c.charCodeAt(0));
    const response = decodeGatewayResponse(getTypes().ListMarchesResponse, bytes);
    expect(response.total).toBe(4);
    expect((response.marches as MarchSummary[]).map(m => [m.march_id, m.phase, m.return_finish_at_ms]))
      .toEqual([[11, 5, 0], [12, 1, 0], [13, 4, 3000], [14, 127, 0]]);
  });
  it("decodes actual MIL settlement to API handler survivor wire", () => {
    // Engineering settlement fixture, not elapsed real-time/native acceptance.
    const bytes = Uint8Array.from(atob("CiEIARABGAcwCkABSAVQgNCV/7wxWIDJwf+8MWoFCAEQpgEQAQ=="), c => c.charCodeAt(0));
    const response = decodeGatewayResponse(getTypes().ListMarchesResponse, bytes);
    expect(response.total).toBe(1);
    expect((response.marches as MarchSummary[])[0]).toMatchObject({ march_id: 1, phase: 5,
      return_finish_at_ms: 0, depart_at_ms: 1700000000000, arrive_at_ms: 1700000720000,
      troops: [{ unit_cfg_id: 1, count: 166, wounded: 0 }] });
  });

  it("preserves history and numeric phase without clock-based reinterpretation", () => {
    const [returned, pending, unknown] = decode([row, { ...row, march_id: 8, phase: 1 }, { ...row, march_id: 9, phase: 127 }]);
    const { report_id: _optionalExtension, ...wireFields } = row;
    expect(returned).toMatchObject(wireFields);
    expect(pending.phase).toBe(1);
    expect(unknown.phase).toBe(127);
    expect(formatMarchPhase(5)).toBe("已回城");
    expect(marchPhaseChipLabel(5)).toBe("已回城");
    expect(marchPhaseChipClass(5)).toBe("march-phase-chip-returned");
    expect([0, 1, 2, 3, 4, 127].map(formatMarchPhase)).toEqual(["未知", "待发", "行军中", "已到达", "返程中", "阶段127"]);
    expect(marchNeedsPoll([returned, unknown])).toBe(false);
    expect(marchNeedsPoll([returned, pending, unknown])).toBe(true);
    const all = [returned, pending, unknown];
    expect(applyMilitaryListClientFilters(all, DEFAULT_MILITARY_LIST_FILTER, now)).toHaveLength(3);
    for (const phase of ["pending", "outbound", "stationed", "return"] as const) {
      expect(applyMilitaryListClientFilters([returned], { phase, etaSort: "default" }, now)).toEqual([]);
    }
    expect(filterMarchesByDestination(all, 5, 5)).toHaveLength(3);
    expect(buildMarchIntelRemarchPrefill(returned)).toEqual({ toX: 5, toY: 5, lastTroopsSummary: "上次兵力：步兵×19" });
  });

  it("never displays a returned countdown even with future historical timestamps", () => {
    const returned = decode([{ ...row, arrive_at_ms: now + 999_000, return_finish_at_ms: now + 999_000 }])[0];
    for (const time of [now - 10_000, now, now + 1_000_000]) {
      const displays = [formatMarchEta(returned, time), formatMarchListSecondary(returned, time),
        formatMarchRowRecentEtaBrief(returned, time), formatMarchEtaLine(returned, time),
        formatMarchIntelPhaseEtaStrip(returned, time), formatMarchReadonlyLineFromMarch(returned, time),
        formatMarchInfoCardPrimary(returned), formatMarchHint(returned), formatMarchRowMetaLine(returned, time)];
      for (const text of displays) {
        expect(text).toContain("已回城");
        expect(text).not.toMatch(/剩余|即将|剩 \d+s|预计|ETA/);
      }
    }
  });

  it("excludes returned from every shared active count but preserves genuine pending", () => {
    const [returned, pending, unknown] = decode([row, { ...row, march_id: 8, phase: 1 }, { ...row, march_id: 9, phase: 127 }]);
    const mixed = [returned, pending, unknown];
    expect(countIntelInProgressMarches(mixed)).toBe(1);
    expect(findFirstIntelInProgressMarchId(mixed)).toBe(8);
    expect(collectMinimapDestMarkers(mixed).map(m => m.marchId)).toEqual([8]);
    expect(marchHasRouteOnMinimap(returned)).toBe(false);
    expect(minimapDestShowsEtaBadge(returned)).toBe(false);
    expect(countMarchesAtTile(mixed, 5, 5)).toBe(1);
    expect(findMostRecentInProgressMarchAtTile(mixed, 5, 5)?.march_id).toBe(8);
    expect(buildWorldInfoCardSummary({ cell: { x: 5, y: 5 }, cities: [], marches: mixed }).marchCount).toBe(1);
    expect(buildWorldInfoCardSummary({ cell: { x: 5, y: 5 }, cities: [], marches: [returned] }).marchCount).toBe(0);
    expect(heroIdsOnActiveMarch([{ ...returned, hero_id: 11 }, { ...pending, leader_hero_id: 12 }, { ...unknown, hero_id: 13 }])).toEqual(new Set([12, 13]));
  });
});

describe("returned tracking cleanup is not destination arrival", () => {
  it.each([undefined, 2, 4, 5])("clears tracked ID on %s → 5, without new arrival/report reminders", async (phase) => {
    const returned = decode([row]);
    const previous = phase == null ? [] : [{ ...row, phase }];
    expect(detectNewMarchArrivalReminders(previous, returned, new Set([7]))).toEqual([]);
    const listMarches = vi.fn().mockResolvedValue(returned), onCompletions = vi.fn();
    const poll = new MarchArrivalPoll({ listMarches, getCityId: () => 1, onCompletions });
    poll.trackMarch(7, previous[0]);
    await poll.pollOnce();
    expect(poll.needsPoll()).toBe(false);
    poll.tick(30);
    expect(listMarches).toHaveBeenCalledTimes(1);
    await poll.pollOnce();
    expect(poll.needsPoll()).toBe(false);
    expect(onCompletions).not.toHaveBeenCalled();
  });

  it("does not start tracking a terminal seed; mixed pending still polls", async () => {
    const listMarches = vi.fn().mockResolvedValue(decode([row, { ...row, march_id: 8, phase: 1 }]));
    const poll = new MarchArrivalPoll({ listMarches, getCityId: () => 1, onCompletions: vi.fn() });
    poll.trackMarch(7, row);
    expect(poll.needsPoll()).toBe(false);
    await poll.pollOnce();
    expect(poll.needsPoll()).toBe(true);
    poll.reset();
    expect(poll.needsPoll()).toBe(false);
  });
});
