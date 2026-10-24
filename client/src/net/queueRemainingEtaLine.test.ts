import { describe, expect, it } from "vitest";
import {
  computeQueueRowProgressBarWidthPercent,
  formatQueueRemainingEtaLine,
} from "@/net/queueRemainingEtaLine";

describe("formatQueueRemainingEtaLine (CLIENT-196)", () => {
  it("combines remaining seconds, m:ss countdown, and finish_at summary", () => {
    const now = 1_000_000;
    const finish = now + 90_000;
    const line = formatQueueRemainingEtaLine(finish, now);
    expect(line).toContain("剩 90s");
    expect(line).toContain("剩 1:30");
    expect(line).toContain("完成 ");
  });

  it("returns null when upgrade already finished", () => {
    const now = 1_000_000;
    expect(formatQueueRemainingEtaLine(now - 1, now)).toBeNull();
    expect(formatQueueRemainingEtaLine(0, now)).toBeNull();
  });
});

describe("computeQueueRowProgressBarWidthPercent (CLIENT-196)", () => {
  it("computes width from started_at and finish_at", () => {
    const now = 1_000_000;
    const started = now - 30_000;
    const finish = now + 30_000;
    expect(computeQueueRowProgressBarWidthPercent(finish, now, started)).toBe(50);
  });

  it("returns null without a valid started interval", () => {
    const now = 1_000_000;
    const finish = now + 60_000;
    expect(computeQueueRowProgressBarWidthPercent(finish, now)).toBeNull();
    expect(computeQueueRowProgressBarWidthPercent(finish, now, finish)).toBeNull();
  });

  it("clamps to 0–100", () => {
    const started = 10_000;
    const finish = 110_000;
    expect(computeQueueRowProgressBarWidthPercent(finish, 150_000, started)).toBeNull();
    expect(computeQueueRowProgressBarWidthPercent(finish, 60_000, started)).toBe(50);
    expect(computeQueueRowProgressBarWidthPercent(finish, started, started)).toBe(0);
  });
});
