import { describe, expect, it } from "vitest";
import {
  loadRemindedMarchIds,
  MARCH_PHASE_REMINDER_SESSION_KEY,
  takeUnremindedMarchIds,
} from "@/net/marchPhaseReminderSession";

describe("marchPhaseReminderSession", () => {
  it("round-trips reminded march ids in sessionStorage", () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
    };
    expect(takeUnremindedMarchIds([3, 5], storage)).toEqual([3, 5]);
    expect(takeUnremindedMarchIds([3, 7], storage)).toEqual([7]);
    expect(loadRemindedMarchIds(storage)).toEqual(new Set([3, 5, 7]));
    expect(storage.data.get(MARCH_PHASE_REMINDER_SESSION_KEY)).toContain("3");
  });
});
