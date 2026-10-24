import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOMESTIC_SLOT_RETURN_RING_CLASS,
  DOMESTIC_SLOT_RETURN_RING_MS,
  DOMESTIC_SLOT_SCROLL_SESSION_KEY,
  DOMESTIC_SLOT_STRIP_CELL_CLASS,
  captureDomesticSlotScrollAnchor,
  parseDomesticSlotScrollAnchor,
  resetDomesticSlotReturnRingTimerForTests,
  restoreDomesticSlotScrollAnchor,
  scheduleDomesticSlotReturnRing,
  serializeDomesticSlotScrollAnchor,
  writeDomesticSlotScrollAnchor,
} from "@/net/domesticSlotScrollAnchor";

describe("domesticSlotScrollAnchor (CLIENT-229)", () => {
  afterEach(() => {
    resetDomesticSlotReturnRingTimerForTests();
    sessionStorage.clear();
  });

  it("serializeDomesticSlotScrollAnchor round-trips slotIndex + scrollLeft", () => {
    const raw = serializeDomesticSlotScrollAnchor({ slotIndex: 2, scrollLeft: 48 });
    expect(parseDomesticSlotScrollAnchor(raw)).toEqual({ slotIndex: 2, scrollLeft: 48 });
    expect(sessionStorage.getItem(DOMESTIC_SLOT_SCROLL_SESSION_KEY)).toBeNull();
    writeDomesticSlotScrollAnchor({ slotIndex: 1, scrollLeft: 0 });
    expect(sessionStorage.getItem(DOMESTIC_SLOT_SCROLL_SESSION_KEY)).toBe(
      serializeDomesticSlotScrollAnchor({ slotIndex: 1, scrollLeft: 0 }),
    );
  });

  it("rejects invalid slot index", () => {
    expect(parseDomesticSlotScrollAnchor('{"slotIndex":99,"scrollLeft":0}')).toBeNull();
    expect(parseDomesticSlotScrollAnchor('{"slotIndex":-1,"scrollLeft":0}')).toBeNull();
  });

  it("scheduleDomesticSlotReturnRing applies class for 1.2s", () => {
    const cell = document.createElement("button");
    cell.className = DOMESTIC_SLOT_STRIP_CELL_CLASS;
    const timers = vi.useFakeTimers();
    scheduleDomesticSlotReturnRing([cell]);
    expect(cell.classList.contains(DOMESTIC_SLOT_RETURN_RING_CLASS)).toBe(true);
    timers.advanceTimersByTime(DOMESTIC_SLOT_RETURN_RING_MS - 1);
    expect(cell.classList.contains(DOMESTIC_SLOT_RETURN_RING_CLASS)).toBe(true);
    timers.advanceTimersByTime(1);
    expect(cell.classList.contains(DOMESTIC_SLOT_RETURN_RING_CLASS)).toBe(false);
    timers.useRealTimers();
  });

  it("restoreDomesticSlotScrollAnchor scrolls strip cell and rings overlay tag", () => {
    captureDomesticSlotScrollAnchor(document.body, "farm");
    const strip = document.createElement("div");
    strip.className = "main-city-slot-overlay";
    strip.scrollLeft = 0;
    const cell = document.createElement("button");
    cell.className = DOMESTIC_SLOT_STRIP_CELL_CLASS;
    cell.dataset.slotIndex = "1";
    cell.dataset.slotKey = "farm";
    strip.appendChild(cell);
    document.body.appendChild(strip);

    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);

    const timers = vi.useFakeTimers();
    expect(restoreDomesticSlotScrollAnchor(strip, layer)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_SLOT_RETURN_RING_CLASS)).toBe(true);
    timers.advanceTimersByTime(DOMESTIC_SLOT_RETURN_RING_MS);
    expect(tag.classList.contains(DOMESTIC_SLOT_RETURN_RING_CLASS)).toBe(false);
    timers.useRealTimers();
    strip.remove();
  });
});
