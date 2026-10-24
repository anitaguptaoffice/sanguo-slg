import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CITY_SLOT_PULSE_CLASS,
  highlightQueueRowForSlot,
  QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
  resetCitySlotQueueLinkTimersForTests,
  resolveQueueRowDomIdForSlot,
  scrollCitySlotIntoView,
} from "@/net/citySlotQueueLink";
import { queueBuildRowDomId } from "@/net/mainCitySlotUpgrade";
import { RECRUIT_QUEUE_MATRIX_SLOT_KEY } from "@/net/recruitQueueComplete";
import { queueRecruitRowDomId } from "@/net/recruitTroopSubmitFeedback";

afterEach(() => {
  resetCitySlotQueueLinkTimersForTests();
});

describe("resolveQueueRowDomIdForSlot", () => {
  const now = 1_700_000_000_000;

  it("resolves build row for upgrading slot", () => {
    const id = resolveQueueRowDomIdForSlot("farm", {
      buildings: [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 60_000 }],
      recruits: [],
      nowMs: now,
    });
    expect(id).toBe(queueBuildRowDomId("farm"));
  });

  it("resolves recruit row for barracks when recruit active and barracks not upgrading", () => {
    const id = resolveQueueRowDomIdForSlot(RECRUIT_QUEUE_MATRIX_SLOT_KEY, {
      buildings: [{ slot_key: RECRUIT_QUEUE_MATRIX_SLOT_KEY, level: 1, upgrade_finish_at_ms: 0 }],
      recruits: [{ queue_id: 9, unit_cfg_id: 1, count: 5, finish_at_ms: now + 90_000 }],
      nowMs: now,
    });
    expect(id).toBe(queueRecruitRowDomId(9));
  });

  it("prefers build row when barracks is upgrading", () => {
    const id = resolveQueueRowDomIdForSlot(RECRUIT_QUEUE_MATRIX_SLOT_KEY, {
      buildings: [
        {
          slot_key: RECRUIT_QUEUE_MATRIX_SLOT_KEY,
          level: 2,
          upgrade_finish_at_ms: now + 120_000,
        },
      ],
      recruits: [{ queue_id: 9, unit_cfg_id: 1, count: 5, finish_at_ms: now + 90_000 }],
      nowMs: now,
    });
    expect(id).toBe(queueBuildRowDomId(RECRUIT_QUEUE_MATRIX_SLOT_KEY));
  });
});

describe("highlightQueueRowForSlot", () => {
  it("applies queue-row-slot-highlight for 2s and scrolls row", () => {
    const now = Date.now();
    const panel = document.createElement("div");
    const row = document.createElement("li");
    row.id = queueBuildRowDomId("farm");
    row.scrollIntoView = vi.fn();
    panel.appendChild(row);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(2000);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    const ok = highlightQueueRowForSlot(
      panel,
      "farm",
      {
        buildings: [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 60_000 }],
        recruits: [],
        nowMs: now,
      },
      win,
    );
    expect(ok).toBe(true);
    expect(row.classList.contains(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS)).toBe(true);
    expect(row.scrollIntoView).toHaveBeenCalled();
    timeouts[0]?.();
    expect(row.classList.contains(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS)).toBe(false);
  });
});

describe("scrollCitySlotIntoView", () => {
  it("pulses city-slot-pulse on overlay tag", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    tag.scrollIntoView = vi.fn();
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(2000);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    expect(scrollCitySlotIntoView(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(CITY_SLOT_PULSE_CLASS)).toBe(true);
    expect(tag.scrollIntoView).toHaveBeenCalled();
    timeouts[0]?.();
    expect(tag.classList.contains(CITY_SLOT_PULSE_CLASS)).toBe(false);
  });
});
