import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatSocialPanelLastUpdated,
  formatSocialPanelRefreshError,
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
});
