import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeep";

describe("formatDomesticQueueEtaSegmentResidualDeepLabel (CLIENT-260)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports deep label DOM classes", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deep-label",
    );
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deep-finish",
    );
  });

  it("consolidates segment threshold when >1d remains", () => {
    const deep = formatDomesticQueueEtaSegmentResidualDeepLabel(now + 25 * 3600_000, now);
    expect(deep?.consolidate).toBe("巩固分段 · >1d · 今日内阈剩 1:00:01");
    expect(deep?.finishCountdown).toBe("完成倒计时 · 剩 25:00:00");
  });

  it("consolidates <1h threshold in 今日内 segment", () => {
    const deep = formatDomesticQueueEtaSegmentResidualDeepLabel(now + 2 * 3600_000, now);
    expect(deep?.consolidate).toBe("巩固分段 · 今日内 · <1h阈剩 1:00:01");
    expect(deep?.finishCountdown).toBe("完成倒计时 · 剩 2:00:00");
  });

  it("shows completion threshold under one hour", () => {
    const deep = formatDomesticQueueEtaSegmentResidualDeepLabel(now + 30 * 60_000, now);
    expect(deep?.consolidate).toBe("巩固分段 · <1h · 完成阈");
    expect(deep?.finishCountdown).toBe("完成倒计时 · 剩 30:00");
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentResidualDeepLabel(now - 1, now)).toBeNull();
  });
});
