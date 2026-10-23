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

  it("formats last-updated label in zh-CN local time", () => {
    vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2026/1/15 18:30:00");
    expect(formatSocialPanelLastUpdated(Date.UTC(2026, 0, 15, 10, 30, 0))).toBe(
      "上次更新：2026/1/15 18:30:00",
    );
  });

  it("prefixes gateway error for panel display", () => {
    expect(formatSocialPanelRefreshError("网关超时")).toBe("刷新失败：网关超时");
  });

  it("appends stale label when snapshot may be outdated", () => {
    vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2026/1/15 18:30:00");
    expect(formatSocialPanelLastUpdatedLine(Date.UTC(2026, 0, 15, 10, 30, 0), true)).toContain(
      "数据可能已过期",
    );
    expect(formatSocialPanelLastUpdatedLine(Date.UTC(2026, 0, 15, 10, 30, 0), false)).not.toContain(
      "数据可能已过期",
    );
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

    it("shows last updated after success", () => {
      vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2026/1/15 18:30:00");
      const meta = formatPanelRefreshMeta({
        busy: false,
        lastUpdatedMs: Date.UTC(2026, 0, 15, 10, 30, 0),
        error: null,
      });
      expect(meta.statusText).toContain("上次更新");
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
