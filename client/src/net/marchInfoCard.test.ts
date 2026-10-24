import { describe, expect, it } from "vitest";
import {
  formatMarchEtaLine,
  formatMarchForceSummary,
  formatMarchInfoCardPrimary,
  formatMarchInfoCardSecondary,
  MARCH_INFO_FORCE_HINT,
} from "@/net/marchInfoCard";
import type { MarchSummary } from "@/net/militaryFormat";

describe("marchInfoCard formatters", () => {
  const now = Date.UTC(2024, 0, 1, 8, 0, 0);

  it("formatMarchInfoCardPrimary shows phase and route", () => {
    const m: MarchSummary = {
      march_id: 3,
      phase: 2,
      from_x: 1,
      from_y: 2,
      to_x: 9,
      to_y: 8,
    };
    expect(formatMarchInfoCardPrimary(m)).toBe("行军中 · (1,2) → (9,8)");
  });

  it("formatMarchEtaLine uses remaining time for marching phase", () => {
    const m: MarchSummary = {
      phase: 2,
      arrive_at_ms: now + 120_000,
    };
    expect(formatMarchEtaLine(m, now)).toBe("ETA 剩余 2m");
  });

  it("formatMarchInfoCardSecondary includes troops and hero or hint", () => {
    const full: MarchSummary = {
      phase: 3,
      troops: [{ unit_cfg_id: 1, count: 100 }],
      hero_template_name: "青龙偃月帅",
    };
    expect(formatMarchInfoCardSecondary(full, now)).toContain("ETA 已到达");
    expect(formatMarchInfoCardSecondary(full, now)).toContain("步兵×100");
    expect(formatMarchInfoCardSecondary(full, now)).toContain("将领 青龙偃月帅");

    const empty: MarchSummary = { phase: 1 };
    expect(formatMarchInfoCardSecondary(empty, now)).toContain(MARCH_INFO_FORCE_HINT);
    expect(formatMarchForceSummary(empty)).toBeNull();
  });
});
