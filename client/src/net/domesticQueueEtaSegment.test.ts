// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  formatDomesticQueueEtaSegmentLabel,
} from "@/net/domesticQueueEtaSegment";

describe("formatDomesticQueueEtaSegmentLabel (CLIENT-212)", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("exports segment label DOM class", () => {
    expect(DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS).toBe("domestic-queue-eta-segment-label");
  });

  it("returns <1h when under one hour remains", () => {
    expect(formatDomesticQueueEtaSegmentLabel(now + 30 * 60_000, now)).toBe("<1h");
  });

  it("returns 今日内 for 1h–24h remaining", () => {
    expect(formatDomesticQueueEtaSegmentLabel(now + 2 * 3600_000, now)).toBe("今日内");
    expect(formatDomesticQueueEtaSegmentLabel(now + 23 * 3600_000, now)).toBe("今日内");
  });

  it("returns >1d when at least 24h remains", () => {
    expect(formatDomesticQueueEtaSegmentLabel(now + 25 * 3600_000, now)).toBe(">1d");
  });

  it("returns null when already finished", () => {
    expect(formatDomesticQueueEtaSegmentLabel(now - 1, now)).toBeNull();
    expect(formatDomesticQueueEtaSegmentLabel(0, now)).toBeNull();
  });
});
