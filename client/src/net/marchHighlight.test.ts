import { describe, expect, it, vi } from "vitest";
import {
  clearMarchHighlightSession,
  isMarchHighlightActive,
  MARCH_HIGHLIGHT_SESSION_KEY,
  MARCH_HIGHLIGHT_TTL_MS,
  marchRowShouldBeRecent,
  parseMarchHighlightSessionValue,
  readMarchHighlightSession,
  remainingMarchHighlightMs,
  resolveMarchHighlightOnRowSelect,
  writeMarchHighlightSession,
} from "@/net/marchHighlight";

describe("marchHighlight", () => {
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

  it("parses session JSON", () => {
    expect(parseMarchHighlightSessionValue(null)).toBeNull();
    expect(parseMarchHighlightSessionValue('{"march_id":9,"highlighted_at_ms":1000}')).toEqual({
      march_id: 9,
      highlighted_at_ms: 1000,
    });
  });

  it("writes and reads active highlight", () => {
    const s = storage();
    const now = 50_000;
    writeMarchHighlightSession(12, now, s);
    expect(s.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toContain("12");
    expect(readMarchHighlightSession(now + 1000, s)).toEqual({
      march_id: 12,
      highlighted_at_ms: now,
    });
  });

  it("expires after TTL and removes session", () => {
    const s = storage();
    const at = 1_000;
    writeMarchHighlightSession(3, at, s);
    const expiredAt = at + MARCH_HIGHLIGHT_TTL_MS;
    expect(readMarchHighlightSession(expiredAt, s)).toBeNull();
    expect(s.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toBeNull();
  });

  it("marchRowShouldBeRecent matches id and TTL", () => {
    const state = { march_id: 5, highlighted_at_ms: 0 };
    expect(marchRowShouldBeRecent(5, state, MARCH_HIGHLIGHT_TTL_MS - 1)).toBe(true);
    expect(marchRowShouldBeRecent(6, state, 100)).toBe(false);
    expect(marchRowShouldBeRecent(5, state, MARCH_HIGHLIGHT_TTL_MS)).toBe(false);
  });

  it("clears highlight when selecting another row", () => {
    const state = { march_id: 7, highlighted_at_ms: 100 };
    expect(resolveMarchHighlightOnRowSelect(7, state, 200)).toEqual(state);
    expect(resolveMarchHighlightOnRowSelect(8, state, 200)).toBeNull();
    expect(resolveMarchHighlightOnRowSelect(null, state, 200)).toEqual(state);
  });

  it("remainingMarchHighlightMs counts down", () => {
    const state = { march_id: 1, highlighted_at_ms: 1000 };
    expect(remainingMarchHighlightMs(state, 1010)).toBe(MARCH_HIGHLIGHT_TTL_MS - 10);
    expect(remainingMarchHighlightMs(state, 1000 + MARCH_HIGHLIGHT_TTL_MS)).toBe(0);
  });

  it("clearMarchHighlightSession removes key", () => {
    const s = storage();
    writeMarchHighlightSession(1, 0, s);
    clearMarchHighlightSession(s);
    expect(s.getItem(MARCH_HIGHLIGHT_SESSION_KEY)).toBeNull();
  });

  it("isMarchHighlightActive boundary", () => {
    const state = { march_id: 1, highlighted_at_ms: 0 };
    expect(isMarchHighlightActive(state, MARCH_HIGHLIGHT_TTL_MS - 1)).toBe(true);
    expect(isMarchHighlightActive(state, MARCH_HIGHLIGHT_TTL_MS)).toBe(false);
  });
});
