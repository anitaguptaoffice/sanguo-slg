import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  CITY_SLOT_COMPLETE_FOCUS_RING_MS,
  collectCitySlotKeysForQueueCompleteFocus,
  QUEUE_COMPLETE_FOCUS_RING_SESSION_KEY,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_MS,
  QUEUE_ROW_COMPLETE_READONLY_CLASS,
  resetQueueCompleteFocusRingTimersForTests,
  scheduleCitySlotCompleteFocusRing,
  scheduleQueueRowCompletePulse,
  shouldRingCitySlotOnQueueComplete,
} from "@/net/queueCompleteFocusRing";

afterEach(() => {
  resetQueueCompleteFocusRingTimersForTests();
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

describe("queueCompleteFocusRing", () => {
  it("shouldRingCitySlotOnQueueComplete dedupes via sessionStorage", () => {
    const storage = memoryStorage();
    expect(shouldRingCitySlotOnQueueComplete("build:farm", storage)).toBe(true);
    expect(shouldRingCitySlotOnQueueComplete("build:farm", storage)).toBe(false);
    expect(shouldRingCitySlotOnQueueComplete("recruit:2", storage)).toBe(true);
    expect(storage.getItem(QUEUE_COMPLETE_FOCUS_RING_SESSION_KEY)).toContain("build:farm");
  });

  it("collectCitySlotKeysForQueueCompleteFocus maps recruit to barracks", () => {
    const storage = memoryStorage();
    const keys = collectCitySlotKeysForQueueCompleteFocus(
      [{ kind: "build", slotKey: "farm" }, { kind: "recruit", queueId: 3 }],
      storage,
    );
    expect(keys).toEqual(["farm", "barracks"]);
  });

  it("scheduleCitySlotCompleteFocusRing applies focus ring for 2s", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(CITY_SLOT_COMPLETE_FOCUS_RING_MS);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    expect(scheduleCitySlotCompleteFocusRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(CITY_SLOT_COMPLETE_FOCUS_RING_CLASS)).toBe(true);
    timeouts[0]?.();
    expect(tag.classList.contains(CITY_SLOT_COMPLETE_FOCUS_RING_CLASS)).toBe(false);
  });

  it("scheduleQueueRowCompletePulse toggles queue-row-complete-pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleQueueRowCompletePulse(row);
    expect(row.classList.contains(QUEUE_ROW_COMPLETE_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(QUEUE_ROW_COMPLETE_PULSE_MS);
    expect(row.classList.contains(QUEUE_ROW_COMPLETE_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("exports readonly class constant for queue render", () => {
    expect(QUEUE_ROW_COMPLETE_READONLY_CLASS).toBe("queue-row-complete-readonly");
  });
});
