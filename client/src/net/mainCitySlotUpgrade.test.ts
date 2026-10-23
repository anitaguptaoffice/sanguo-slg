import { describe, expect, it } from "vitest";
import {
  formatUpgradeRemainingAbbrev,
  initialUpgradeProgressAnchor,
  queueBuildRowDomId,
  syncUpgradeProgressAnchor,
  upgradeProgressRatio,
} from "@/net/mainCitySlotUpgrade";

describe("mainCitySlotUpgrade", () => {
  const now = 1_700_000_000_000;

  it("maps slot_key to queue build row dom id", () => {
    expect(queueBuildRowDomId("farm")).toBe("queue-build-row-farm");
    expect(queueBuildRowDomId("hall")).toBe("queue-build-row-hall");
  });

  it("abbreviates upgrade remaining like formatUpgradeRemaining without 剩 prefix", () => {
    expect(formatUpgradeRemainingAbbrev(now + 90_000, now)).toBe("1:30");
    expect(formatUpgradeRemainingAbbrev(now + 3_700_000, now)).toBe("1:01:40");
    expect(formatUpgradeRemainingAbbrev(now - 1, now)).toBeNull();
  });

  it("computes progress ratio from anchor", () => {
    const anchor = initialUpgradeProgressAnchor(now + 120_000, now);
    expect(upgradeProgressRatio(anchor, now)).toBeCloseTo(0.5, 5);
    expect(upgradeProgressRatio(anchor, now + 60_000)).toBeCloseTo(0.75, 5);
    expect(upgradeProgressRatio(anchor, now + 120_000)).toBe(1);
    expect(upgradeProgressRatio(anchor, now - 60_000)).toBeCloseTo(0.25, 5);
  });

  it("preserves startedAt on speedup finish change", () => {
    const finishBefore = now + 120_000;
    let anchor = syncUpgradeProgressAnchor(undefined, finishBefore, now);
    expect(anchor).toBeDefined();
    const started = anchor!.startedAtMs;
    const finishAfter = now + 60_000;
    anchor = syncUpgradeProgressAnchor(anchor, finishAfter, now + 10_000);
    expect(anchor?.startedAtMs).toBe(started);
    expect(anchor?.finishAtMs).toBe(finishAfter);
    expect(upgradeProgressRatio(anchor!, now + 10_000)).toBeGreaterThan(0.5);
  });
});
