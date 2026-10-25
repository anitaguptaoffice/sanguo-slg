import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeeper";

describe("formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel (CLIENT-308)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports deepest-deeper label DOM classes", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-deeper-label",
    );
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-deeper-finish",
    );
  });

  it("consolidates day-level phase when >1d remains", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel(now + 25 * 3600_000, now);
    expect(deeper?.consolidate).toBe(
      "巩固再加深二层 · >1d · 二层分段阈 1d 1h · 阈内 1:00:00",
    );
    expect(deeper?.finishCountdown).toContain("第五行 · 完成倒计时（只读）");
    expect(deeper?.finishCountdown).toContain("25:00:00");
  });

  it("consolidates hour-level phase in 今日内 segment", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel(now + 2 * 3600_000, now);
    expect(deeper?.consolidate).toBe(
      "巩固再加深二层 · 今日内 · 二层分段阈 2h 0m · 阈内 0s",
    );
    expect(deeper?.finishCountdown).toContain("二层相位阈 2:00:00");
  });

  it("shows minute-level phase under one hour", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel(now + 30 * 60_000, now);
    expect(deeper?.consolidate).toBe(
      "巩固再加深二层 · <1h · 二层分段阈 30m 0s · 阈内 30:00",
    );
    expect(deeper?.finishCountdown).toContain("剩 30:00");
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel(now - 1, now)).toBeNull();
  });
});
