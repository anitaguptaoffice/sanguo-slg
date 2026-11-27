import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARCH_DURATION_MS,
  marchInterpolatedTile,
  marchPathProgress01,
  resolveMarchTimeline,
  worldMapMarchNeedsAnimation,
} from "@/net/worldMapMarchInterp";

const base = {
  from_x: 10,
  from_y: 10,
  to_x: 30,
  to_y: 40,
  depart_at_ms: 0,
  arrive_at_ms: 100_000,
  phase: 2,
};

describe("worldMapMarchInterp", () => {
  it("interpolates outbound march at midpoint", () => {
    expect(marchPathProgress01(base, 50_000)).toBeCloseTo(0.5, 3);
    const pos = marchInterpolatedTile(base, 50_000);
    expect(pos.x).toBeCloseTo(20, 3);
    expect(pos.y).toBeCloseTo(25, 3);
    expect(pos.moving).toBe(true);
    expect(pos.remainingSec).toBe(50);
  });

  it("estimates start when depart_at_ms is missing", () => {
    const m = { ...base, depart_at_ms: undefined, arrive_at_ms: 200_000 };
    const t = resolveMarchTimeline(m, 100_000);
    expect(t.startMs).toBe(200_000 - DEFAULT_MARCH_DURATION_MS);
    expect(marchPathProgress01(m, 100_000)).toBeGreaterThan(0);
  });

  it("holds at destination for phase 3", () => {
    const m = { ...base, phase: 3 };
    const pos = marchInterpolatedTile(m, 500_000);
    expect(pos.x).toBe(30);
    expect(pos.y).toBe(40);
    expect(pos.moving).toBe(false);
  });

  it("reverses path on return phase 4", () => {
    const m = {
      ...base,
      phase: 4,
      arrive_at_ms: 100_000,
      return_finish_at_ms: 200_000,
    };
    expect(marchPathProgress01(m, 150_000)).toBeCloseTo(0.5, 3);
    const pos = marchInterpolatedTile(m, 150_000);
    expect(pos.x).toBeCloseTo(20, 3);
    expect(pos.y).toBeCloseTo(25, 3);
  });

  it("detects animation need for in-flight marches", () => {
    expect(worldMapMarchNeedsAnimation([base], 1_000)).toBe(true);
    expect(worldMapMarchNeedsAnimation([{ ...base, phase: 3 }], 1_000)).toBe(false);
  });
});