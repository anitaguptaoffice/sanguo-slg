import { describe, expect, it, vi, afterEach } from "vitest";
import { formatPanelRefreshRelative, formatPanelRefreshStamp } from "@/net/panelRefreshStamp";

describe("formatPanelRefreshStamp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows 刚刚 within one minute", () => {
    const now = 1_700_000_000_000;
    expect(formatPanelRefreshRelative(now - 30_000, now)).toBe("刚刚");
    expect(formatPanelRefreshStamp(now - 30_000, now)).toBe("上次刷新：刚刚");
  });

  it("shows minutes and hours for recent refreshes", () => {
    const now = 1_700_000_000_000;
    expect(formatPanelRefreshRelative(now - 5 * 60_000, now)).toBe("5 分钟前");
    expect(formatPanelRefreshRelative(now - 3 * 60 * 60_000, now)).toBe("3 小时前");
    expect(formatPanelRefreshStamp(now - 5 * 60_000, now)).toBe("上次刷新：5 分钟前");
  });

  it("falls back to locale datetime when older than 48h", () => {
    const at = Date.UTC(2026, 0, 15, 10, 30, 0);
    const now = at + 49 * 60 * 60_000;
    expect(formatPanelRefreshRelative(at, now)).toBeNull();
    vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2026/1/15 18:30:00");
    expect(formatPanelRefreshStamp(at, now)).toBe("上次刷新：2026/1/15 18:30:00");
  });

  it("returns empty for invalid timestamps", () => {
    expect(formatPanelRefreshStamp(0)).toBe("");
    expect(formatPanelRefreshStamp(-1)).toBe("");
  });
});
