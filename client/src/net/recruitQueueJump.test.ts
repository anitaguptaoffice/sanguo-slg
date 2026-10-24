import { describe, expect, it } from "vitest";
import {
  activeRecruitQueueSorted,
  parseRecruitHighlightQueueSessionValue,
  readRecruitHighlightQueueSession,
  resolveRecruitQueueJumpTarget,
  writeRecruitHighlightQueueSession,
} from "@/net/recruitQueueJump";

describe("resolveRecruitQueueJumpTarget", () => {
  const now = 1_000_000;
  const entries = [
    { queue_id: 2, unit_cfg_id: 3, count: 10, finish_at_ms: now + 120_000 },
    { queue_id: 5, unit_cfg_id: 1, count: 5, finish_at_ms: now + 60_000 },
  ];

  it("resolves explicit queue id to unit_cfg_id", () => {
    expect(resolveRecruitQueueJumpTarget(2, entries, now)).toEqual({
      queue_id: 2,
      unit_cfg_id: 3,
      head_queue_id: 5,
    });
  });

  it("queue id 0 picks earliest-finish head row", () => {
    expect(resolveRecruitQueueJumpTarget(0, entries, now)).toEqual({
      queue_id: 5,
      unit_cfg_id: 1,
      head_queue_id: 5,
    });
  });

  it("returns null when queue id missing from active snapshot", () => {
    expect(resolveRecruitQueueJumpTarget(99, entries, now)).toBeNull();
  });

  it("returns null when no active recruits", () => {
    const finished = [{ queue_id: 1, unit_cfg_id: 1, count: 1, finish_at_ms: now - 1 }];
    expect(resolveRecruitQueueJumpTarget(1, finished, now)).toBeNull();
    expect(activeRecruitQueueSorted(finished, now)).toEqual([]);
  });
});

describe("recruit-highlight-queue-id session", () => {
  it("writes and reads queue id", () => {
    const storage = new Map<string, string>();
    writeRecruitHighlightQueueSession(12, {
      setItem: (k, v) => storage.set(k, v),
    });
    expect(readRecruitHighlightQueueSession({ getItem: (k) => storage.get(k) ?? null })).toBe(12);
  });

  it("parseRecruitHighlightQueueSessionValue rejects invalid", () => {
    expect(parseRecruitHighlightQueueSessionValue("")).toBeNull();
    expect(parseRecruitHighlightQueueSessionValue("0")).toBeNull();
    expect(parseRecruitHighlightQueueSessionValue("7")).toBe(7);
  });
});
