import { describe, expect, it, vi } from "vitest";
import {
  dispatchBattleReportListIntelJump,
  resolveBattleReportListIntelJump,
  stubIntelMinimapSyncAfterReportListJump,
} from "@/net/battleReportListIntelJump";

describe("battleReportListIntelJump (CLIENT-223)", () => {
  const summary = { report_id: 9, location_x: 5, location_y: 6 };

  it("resolveBattleReportListIntelJump prefers intel march over minimap", () => {
    const marches = [{ march_id: 3, to_x: 5, to_y: 6, arrive_at_ms: 1 }];
    expect(resolveBattleReportListIntelJump(summary, marches)).toEqual({
      mode: "intel",
      marchId: 3,
    });
  });

  it("resolveBattleReportListIntelJump falls back to minimap when no marches", () => {
    expect(resolveBattleReportListIntelJump(summary, [])).toEqual({
      mode: "minimap",
      x: 5,
      y: 6,
    });
  });

  it("dispatchBattleReportListIntelJump calls intel or minimap handlers", () => {
    const openIntelMarch = vi.fn();
    const openMinimapAtCoords = vi.fn();
    const afterStub = vi.fn();

    expect(
      dispatchBattleReportListIntelJump(
        summary,
        [{ march_id: 1, to_x: 5, to_y: 6 }],
        { openIntelMarch, openMinimapAtCoords, afterIntelJumpSyncStub: afterStub },
      ),
    ).toBe("intel");
    expect(openIntelMarch).toHaveBeenCalledWith(1);
    expect(afterStub).toHaveBeenCalledWith(1);
    expect(openMinimapAtCoords).not.toHaveBeenCalled();

    openIntelMarch.mockClear();
    afterStub.mockClear();
    expect(
      dispatchBattleReportListIntelJump(summary, [], {
        openIntelMarch,
        openMinimapAtCoords,
      }),
    ).toBe("minimap");
    expect(openMinimapAtCoords).toHaveBeenCalledWith(5, 6);
    expect(openIntelMarch).not.toHaveBeenCalled();
  });

  it("stubIntelMinimapSyncAfterReportListJump is safe no-op (CLIENT-220 soft-dep)", () => {
    expect(() => stubIntelMinimapSyncAfterReportListJump(99)).not.toThrow();
  });
});
