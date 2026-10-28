// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  panelStateChromeMessage,
  renderHeroDetailStateErrorMarkup,
  renderHeroDetailStateLoadingMarkup,
} from "@/net/panelStateChrome";

describe("panelStateChrome", () => {
  it("renders hero detail loading markup", () => {
    const html = renderHeroDetailStateLoadingMarkup();
    expect(html).toContain("详情加载中");
    expect(html).toContain("panel-state-loading");
    expect(html).toContain('role="status"');
  });

  it("renders hero detail error with CLIENT-067 style message", () => {
    const html = renderHeroDetailStateErrorMarkup("道具不足 [10001]");
    expect(html).toContain("道具不足");
    expect(html).toContain("panel-state-error");
    expect(html).toContain('role="alert"');
  });

  it("panelStateChromeMessage uses custom text when provided", () => {
    expect(panelStateChromeMessage("empty", "尚无将领")).toBe("尚无将领");
  });
});
