import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatPanelRefreshMeta,
  formatSocialPanelLastUpdated,
  formatSocialPanelLastUpdatedLine,
  formatSocialPanelRefreshError,
  formatSocialPanelRefreshFailure,
  SOCIAL_PANEL_REFRESH_BUSY_LABEL,
} from "@/net/socialRefreshFormat";

describe("socialRefreshFormat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats last refresh stamp with relative time (CLIENT-144)", () => {
    const now = 1_700_000_000_000;
    expect(formatSocialPanelLastUpdated(now - 30_000, now)).toBe("上次刷新：刚刚");
  });

  it("prefixes gateway error for panel display", () => {
    expect(formatSocialPanelRefreshError("网关超时")).toBe("刷新失败：网关超时");
  });

  it("appends stale label when snapshot may be outdated", () => {
    const now = 1_700_000_000_000;
    expect(formatSocialPanelLastUpdatedLine(now - 60_000, true, now)).toContain("数据可能已过期");
    expect(formatSocialPanelLastUpdatedLine(now - 60_000, false, now)).not.toContain("数据可能已过期");
  });

  it("wraps gateway errors with [code] for refresh failure (CLIENT-076)", () => {
    const err = Object.assign(new Error("timeout"), { code: 500 });
    expect(formatSocialPanelRefreshFailure(err)).toBe("刷新失败：[500] timeout");
  });

  describe("formatPanelRefreshMeta", () => {
    it("shows spinner label while busy", () => {
      const meta = formatPanelRefreshMeta({
        busy: true,
        lastUpdatedMs: 1,
        error: null,
      });
      expect(meta.statusText).toBe(SOCIAL_PANEL_REFRESH_BUSY_LABEL);
      expect(meta.spinnerVisible).toBe(true);
      expect(meta.retryVisible).toBe(false);
      expect(meta.statusHidden).toBe(false);
    });

    it("shows last refresh stamp after success", () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      const meta = formatPanelRefreshMeta({
        busy: false,
        lastUpdatedMs: now - 120_000,
        error: null,
      });
      expect(meta.statusText).toContain("上次刷新");
      expect(meta.spinnerVisible).toBe(false);
      expect(meta.statusHidden).toBe(false);
    });

    it("shows retry on error and keeps stale suffix", () => {
      const meta = formatPanelRefreshMeta({
        busy: false,
        lastUpdatedMs: 100,
        error: "[500] timeout",
        stale: true,
      });
      expect(meta.statusText).toContain("刷新失败：[500] timeout");
      expect(meta.statusText).toContain("数据可能已过期");
      expect(meta.isError).toBe(true);
      expect(meta.retryVisible).toBe(true);
    });

    it("hides status when idle without timestamp", () => {
      const meta = formatPanelRefreshMeta({
        busy: false,
        lastUpdatedMs: 0,
        error: null,
      });
      expect(meta.statusHidden).toBe(true);
    });
  });
});
