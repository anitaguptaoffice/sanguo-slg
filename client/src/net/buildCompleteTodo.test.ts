import { describe, expect, it } from "vitest";
import { BuildCompleteTodoTracker } from "@/net/buildCompleteTodo";

describe("BuildCompleteTodoTracker", () => {
  it("records slot when active upgrade disappears", () => {
    const tracker = new BuildCompleteTodoTracker();
    const now = 1_000_000;
    tracker.onCityBuildings(
      [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 60_000 }],
      now,
    );
    tracker.onCityBuildings([{ slot_key: "farm", level: 3, upgrade_finish_at_ms: 0 }], now + 120_000);
    expect(tracker.pendingSlotKeys()).toEqual(["farm"]);
    expect(tracker.pendingCount()).toBe(1);
    tracker.dismissSlot("farm");
    expect(tracker.pendingCount()).toBe(0);
  });
});
