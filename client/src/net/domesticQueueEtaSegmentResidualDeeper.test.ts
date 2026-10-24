import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeeper";

describe("formatDomesticQueueEtaSegmentResidualDeeperLabel (CLIENT-276)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports deeper label DOM classes", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deeper-label",
    );
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS).toBe(
      "domestic-queue-eta-segment-residual-deeper-finish",
    );
  });

  it("consolidates day-level threshold when >1d remains", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeeperLabel(now + 25 * 3600_000, now);
    expect(deeper?.consolidate).toBe("巩固再加深 · >1d · 天级阈剩 1d 1:00:00");
    expect(deeper?.finishCountdown).toContain("第四行 · 完成倒计时（只读）");
    expect(deeper?.finishCountdown).toContain("25:00:00");
  });

  it("consolidates hour-level threshold in 今日内 segment", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeeperLabel(now + 2 * 3600_000, now);
    expect(deeper?.consolidate).toBe("巩固再加深 · 今日内 · 小时级阈剩 2h 0s");
    expect(deeper?.finishCountdown).toContain("阈内 2:00:00");
  });

  it("shows second-level threshold under one hour", () => {
    const deeper = formatDomesticQueueEtaSegmentResidualDeeperLabel(now + 30 * 60_000, now);
    expect(deeper?.consolidate).toBe("巩固再加深 · <1h · 秒级阈剩 30:00");
    expect(deeper?.finishCountdown).toContain("剩 30:00");
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentResidualDeeperLabel(now - 1, now)).toBeNull();
  });
});
