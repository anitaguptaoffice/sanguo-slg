import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS,
  findQueueRowForDomesticFocus,
  highlightDomesticQueueRowFocusRing,
  highlightDomesticSlotForQueueRow,
  resetDomesticSlotQueueFocusRingTimersForTests,
} from "@/net/domesticSlotQueueFocusRing";
import { queueBuildRowDomId } from "@/net/mainCitySlotUpgrade";

afterEach(() => {
  resetDomesticSlotQueueFocusRingTimersForTests();
});

describe("findQueueRowForDomesticFocus (CLIENT-228)", () => {
  const now = 1_700_000_000_000;

  it("resolves build row by slot_key and building_cfg_id", () => {
    const panel = document.createElement("div");
    const row = document.createElement("li");
    row.id = queueBuildRowDomId("farm");
    row.className = "queue-list-row";
    row.setAttribute("data-building-cfg-id", "2");
    panel.appendChild(row);

    const found = findQueueRowForDomesticFocus(
      panel,
      "farm",
      {
        buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 2, upgrade_finish_at_ms: now + 60_000 }],
        recruits: [],
        nowMs: now,
      },
      { slot_key: "farm", building_cfg_id: 2, level: 2 },
    );
    expect(found).toBe(row);
  });
});

describe("highlightDomesticQueueRowFocusRing (CLIENT-228)", () => {
  it("applies domestic-slot-queue-focus-ring for 1.5s on queue row", () => {
    const now = Date.now();
    const panel = document.createElement("div");
    const row = document.createElement("li");
    row.id = queueBuildRowDomId("farm");
    row.className = "queue-list-row";
    row.scrollIntoView = vi.fn();
    panel.appendChild(row);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    const ok = highlightDomesticQueueRowFocusRing(
      panel,
      "farm",
      {
        buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 2, upgrade_finish_at_ms: now + 60_000 }],
        recruits: [],
        nowMs: now,
      },
      undefined,
      win,
    );
    expect(ok).toBe(true);
    expect(row.classList.contains(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS)).toBe(true);
    timeouts[0]?.();
    expect(row.classList.contains(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS)).toBe(false);
  });
});

describe("highlightDomesticSlotForQueueRow (CLIENT-228)", () => {
  it("applies domestic-slot-queue-focus-ring on overlay tag for 1.5s", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    tag.scrollIntoView = vi.fn();
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    expect(
      highlightDomesticSlotForQueueRow(layer, "farm", { slot_key: "farm", building_cfg_id: 2, level: 1 }, win),
    ).toBe(true);
    expect(tag.classList.contains(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS)).toBe(true);
    timeouts[0]?.();
    expect(tag.classList.contains(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS)).toBe(false);
  });
});
