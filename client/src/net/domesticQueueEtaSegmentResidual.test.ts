import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualLabel,
} from "@/net/domesticQueueEtaSegmentResidual";

describe("formatDomesticQueueEtaSegmentResidualLabel (CLIENT-244)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports residual label DOM class", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS).toBe(
      "domestic-queue-eta-segment-residual-label",
    );
  });

  it("hints next bucket when >1d remains", () => {
    expect(formatDomesticQueueEtaSegmentResidualLabel(now + 25 * 3600_000, now)).toBe(
      "下一档 今日内 · 剩 1:00:01",
    );
  });

  it("hints <1h bucket when in 今日内 segment", () => {
    expect(formatDomesticQueueEtaSegmentResidualLabel(now + 2 * 3600_000, now)).toBe(
      "下一档 <1h · 剩 1:00:01",
    );
  });

  it("hints completion when under one hour", () => {
    expect(formatDomesticQueueEtaSegmentResidualLabel(now + 30 * 60_000, now)).toBe(
      "下一档 完成 · 剩 30:00",
    );
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentResidualLabel(now - 1, now)).toBeNull();
  });
});
