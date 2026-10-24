import { describe, expect, it } from "vitest";
import {
  canOfferBattleReportIntelJump,
  openMinimapForBattleCoords,
  readBattleReportReplaySession,
  resolveBattleReportIdForMarchReplay,
  resolveIntelRowNearCoords,
  writeBattleReportReplaySession,
  BATTLE_REPORT_REPLAY_SESSION_KEY,
} from "@/net/battleReportIntelReplayJump";
import { computeMinimapWorldBounds, type MinimapView } from "@/ui/worldMinimap";

describe("battleReportIntelReplayJump (CLIENT-191)", () => {
  const view: MinimapView = { panX: 0, panY: 0, zoom: 1 };
  const bounds = computeMinimapWorldBounds(0, 0, [], null);

  it("openMinimapForBattleCoords expands minimap and frames battle coords", () => {
    const storage = new Map<string, string>();
    const session = {
      setItem: (k: string, v: string) => storage.set(k, v),
      getItem: (k: string) => storage.get(k) ?? null,
    };
    const result = openMinimapForBattleCoords({
      location: { x: 12, y: 34 },
      bounds,
      currentView: view,
      minimapCollapsed: true,
      storage,
    });
    expect(result.minimapCollapsed).toBe(false);
    expect(result.didExpandMinimap).toBe(true);
    expect(result.focus.replay).toEqual({ wx: 12, wy: 34 });
    expect(result.focus.status).toContain("(12,34)");
    expect(result.didExpandMinimap).toBe(true);
  });

  it("resolveIntelRowNearCoords prefers same dest cell then nearest by Manhattan", () => {
    const marches = [
      { march_id: 1, to_x: 5, to_y: 5, arrive_at_ms: 100 },
      { march_id: 2, to_x: 5, to_y: 5, arrive_at_ms: 200 },
      { march_id: 3, to_x: 7, to_y: 5, arrive_at_ms: 300 },
    ];
    const exact = resolveIntelRowNearCoords(marches, 5, 5);
    expect(exact?.marchId).toBe(2);
    expect(exact?.gridDistance).toBe(0);

    const near = resolveIntelRowNearCoords(
      [{ march_id: 9, to_x: 8, to_y: 5, arrive_at_ms: 1 }],
      5,
      5,
    );
    expect(near?.marchId).toBe(9);
    expect(near?.gridDistance).toBe(3);
  });

  it("persists battle-report-replay-v1 and resolves march replay report_id", () => {
    const storage = new Map<string, string>();
    const sessionStore = {
      setItem: (k: string, v: string) => storage.set(k, v),
      getItem: (k: string) => storage.get(k) ?? null,
    };
    writeBattleReportReplaySession({ reportId: 42, wx: 8, wy: 9 }, sessionStore);
    expect(storage.get(BATTLE_REPORT_REPLAY_SESSION_KEY)).toContain("42");
    expect(readBattleReportReplaySession(sessionStore)?.reportId).toBe(42);

    expect(
      resolveBattleReportIdForMarchReplay({ march_id: 1, report_id: 77, to_x: 1, to_y: 1 }, null),
    ).toBe(77);
    expect(
      resolveBattleReportIdForMarchReplay(
        { march_id: 2, to_x: 8, to_y: 9 },
        readBattleReportReplaySession(sessionStore),
      ),
    ).toBe(42);
    expect(
      resolveBattleReportIdForMarchReplay({ march_id: 3, to_x: 0, to_y: 0 }, null),
    ).toBeNull();
  });

  it("canOfferBattleReportIntelJump mirrors resolveIntelRowNearCoords", () => {
    const marches = [{ march_id: 1, to_x: 3, to_y: 4 }];
    expect(canOfferBattleReportIntelJump(marches, { location_x: 3, location_y: 4 })).toBe(true);
    expect(canOfferBattleReportIntelJump(marches, { location_x: 99, location_y: 4 })).toBe(true);
    expect(canOfferBattleReportIntelJump([], { location_x: 3, location_y: 4 })).toBe(false);
    expect(canOfferBattleReportIntelJump(marches, {})).toBe(false);
  });
});
