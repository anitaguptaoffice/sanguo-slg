import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepest";

describe("formatDomesticQueueEtaSegmentResidualDeepestLabel (CLIENT-292)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports deepest label DOM classes", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-label",
    );
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-finish",
    );
  });

  it("consolidates day-level phase when >1d remains", () => {
    const deepest = formatDomesticQueueEtaSegmentResidualDeepestLabel(now + 25 * 3600_000, now);
    expect(deepest?.consolidate).toBe(
      "巩固再加深一层 · >1d · 分段相位 1d 1h · 阈内 1:00:00",
    );
    expect(deepest?.finishCountdown).toContain("第四行 · 完成倒计时（只读）");
    expect(deepest?.finishCountdown).toContain("25:00:00");
  });

  it("consolidates hour-level phase in 今日内 segment", () => {
    const deepest = formatDomesticQueueEtaSegmentResidualDeepestLabel(now + 2 * 3600_000, now);
    expect(deepest?.consolidate).toBe("巩固再加深一层 · 今日内 · 分段相位 2h 0m · 阈内 0s");
    expect(deepest?.finishCountdown).toContain("相位阈 2:00:00");
  });

  it("shows minute-level phase under one hour", () => {
    const deepest = formatDomesticQueueEtaSegmentResidualDeepestLabel(now + 30 * 60_000, now);
    expect(deepest?.consolidate).toBe("巩固再加深一层 · <1h · 分段相位 30m 0s · 阈内 30:00");
    expect(deepest?.finishCountdown).toContain("剩 30:00");
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentResidualDeepestLabel(now - 1, now)).toBeNull();
  });
});
