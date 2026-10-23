import { describe, expect, it } from "vitest";
import {
  MARCH_HIGHLIGHT_SESSION_KEY,
  writeMarchHighlightSession,
} from "@/net/marchHighlight";
import {
  clearMarchHighlightPreservesMinimapFocus,
  clearMinimapMarchFocusSession,
  marchFocusAndHighlightSessionsCoexist,
  MINIMAP_MARCH_FOCUS_SESSION_KEY,
  parseMinimapMarchFocusId,
  readMinimapMarchFocusSession,
  syncMinimapMarchFocusSession,
  writeMinimapFocusPreservesMarchHighlight,
  writeMinimapMarchFocusSession,
} from "@/net/minimapMarchFocus";

describe("minimapMarchFocus", () => {
  const storage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  };

  it("parses focus march id", () => {
    expect(parseMinimapMarchFocusId(null)).toBeNull();
    expect(parseMinimapMarchFocusId("")).toBeNull();
    expect(parseMinimapMarchFocusId("12")).toBe(12);
    expect(parseMinimapMarchFocusId("0")).toBeNull();
  });

  it("writes and reads focus session", () => {
    const s = storage();
    writeMinimapMarchFocusSession(42, s);
    expect(s.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY)).toBe("42");
    expect(readMinimapMarchFocusSession(s)).toBe(42);
    clearMinimapMarchFocusSession(s);
    expect(readMinimapMarchFocusSession(s)).toBeNull();
  });

  it("sync clears focus when march id is null", () => {
    const s = storage();
    syncMinimapMarchFocusSession(7, s);
    syncMinimapMarchFocusSession(null, s);
    expect(readMinimapMarchFocusSession(s)).toBeNull();
  });

  it("coexistence: focus and highlight keys are independent", () => {
    const s = storage();
    writeMarchHighlightSession(9, 1000, s);
    expect(writeMinimapFocusPreservesMarchHighlight(5, s)).toBe(true);
    expect(s.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toContain("9");
    expect(s.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY)).toBe("5");

    writeMinimapMarchFocusSession(11, s);
    expect(clearMarchHighlightPreservesMinimapFocus(s)).toBe(true);
    expect(s.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY)).toBe("11");
    expect(s.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toBeNull();
  });

  it("marchFocusAndHighlightSessionsCoexist describes both keys", () => {
    const out = marchFocusAndHighlightSessionsCoexist(3, {
      march_id: 8,
      highlighted_at_ms: 1,
    });
    expect(out.focusKey).toBe("3");
    expect(out.highlightKey).toContain("8");
    expect(marchFocusAndHighlightSessionsCoexist(null, null)).toEqual({
      focusKey: null,
      highlightKey: null,
    });
  });
});
