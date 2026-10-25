import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeper";

describe("formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel (CLIENT-356)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports deepest-deepest-deepest-deeper label DOM classes", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deeper-label",
    );
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_FINISH_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deeper-finish",
    );
  });

  it("consolidates day-level phase when >1d remains", () => {
    const line = formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel(
      now + 25 * 3600_000,
      now,
    );
    expect(line?.consolidate).toBe(
      "巩固再加深五层 · >1d · 五层分段阈 1d 1h · 阈内 1:00:00",
    );
    expect(line?.finishCountdown).toContain("第八行 · 完成倒计时（只读）");
    expect(line?.finishCountdown).toContain("25:00:00");
  });

  it("consolidates hour-level phase in 今日内 segment", () => {
    const line = formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel(
      now + 2 * 3600_000,
      now,
    );
    expect(line?.consolidate).toBe(
      "巩固再加深五层 · 今日内 · 五层分段阈 2h 0m · 阈内 0s",
    );
    expect(line?.finishCountdown).toContain("五层相位阈 2:00:00");
  });

  it("shows minute-level phase under one hour", () => {
    const line = formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel(
      now + 30 * 60_000,
      now,
    );
    expect(line?.consolidate).toBe(
      "巩固再加深五层 · <1h · 五层分段阈 30m 0s · 阈内 30:00",
    );
    expect(line?.finishCountdown).toContain("剩 30:00");
  });

  it("returns null when already finished", () => {
    expect(
      formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel(now - 1, now),
    ).toBeNull();
  });
});
