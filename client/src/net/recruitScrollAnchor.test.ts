import { describe, expect, it, vi } from "vitest";
import {
  RECRUIT_SCROLL_ANCHOR_SESSION_KEY,
  applyRecruitScrollAnchorSession,
  parseRecruitScrollAnchorSessionValue,
  scrollToRecruitTemplateRow,
  writeRecruitScrollAnchorSession,
} from "@/net/recruitScrollAnchor";

describe("recruit scroll anchor session", () => {
  it("round-trips template_cfg_id via recruit-scroll-anchor-v1", () => {
    const storage = new Map<string, string>();
    const mock: Storage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    writeRecruitScrollAnchorSession(1002, mock);
    expect(storage.get(RECRUIT_SCROLL_ANCHOR_SESSION_KEY)).toBe("1002");
    expect(parseRecruitScrollAnchorSessionValue("1002")).toBe(1002);
  });

  it("applyRecruitScrollAnchorSession scrolls matching row and clears key", () => {
    const storage = new Map<string, string>([[RECRUIT_SCROLL_ANCHOR_SESSION_KEY, "1001"]]);
    const mock: Storage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    };
    const panel = document.createElement("div");
    panel.innerHTML = `<ul data-role="template-list"><li data-template-id="1001"></li></ul>`;
    const row = panel.querySelector("li")!;
    row.scrollIntoView = vi.fn();
    expect(applyRecruitScrollAnchorSession(panel, mock)).toBe(true);
    expect(row.scrollIntoView).toHaveBeenCalled();
    expect(storage.has(RECRUIT_SCROLL_ANCHOR_SESSION_KEY)).toBe(false);
  });

  it("scrollToRecruitTemplateRow returns false when row missing", () => {
    expect(scrollToRecruitTemplateRow(document.createElement("div"), 999)).toBe(false);
  });
});
