import { afterEach, describe, expect, it, vi } from "vitest";
import { MainCityDomesticSlotStrip } from "./MainCityDomesticSlotStrip";
import * as matrix from "@/net/buildQueueMatrix";
import type { MainCitySession } from "@/net/bootstrapSession";

const roots: HTMLElement[] = [];
afterEach(() => { roots.splice(0).forEach(root => root.remove()); vi.restoreAllMocks(); });
function setup() {
  const mount = document.createElement("div"); document.body.append(mount); roots.push(mount);
  const selected = vi.fn();
  const labels = { hall: "官府", farm: "农田" };
  const session = { buildings: [{ slot_key: "hall", level: 1, upgrade_finish_at_ms: 0 }] } as MainCitySession;
  const strip = new MainCityDomesticSlotStrip(mount, labels, () => session, selected);
  strip.attach();
  return { mount, selected, labels, session, strip, buttons: () => [...mount.querySelectorAll("button")] };
}

describe("CLIENT-REPAIR-006 stable seven-slot DOM", () => {
  it("preserves all nodes, native focus, scroll and external highlight on repeated sync", () => {
    const { mount, strip, buttons } = setup();
    const initial = buttons(); const hall = initial[0]; hall.focus();
    hall.classList.add("domestic-slot-return-ring");
    const host = mount.querySelector<HTMLElement>(".main-city-slot-overlay")!; host.scrollLeft = 42;
    const mutations = vi.fn(); const observer = new MutationObserver(mutations);
    observer.observe(host, { childList: true, subtree: true });
    for (let i = 0; i < 100; i++) strip.sync();
    expect(buttons()).toEqual(initial); expect(document.activeElement).toBe(hall);
    expect(hall.classList.contains("domestic-slot-return-ring")).toBe(true);
    expect(host.scrollLeft).toBe(42); expect(observer.takeRecords()).toEqual([]); observer.disconnect();
  });
  it("updates status/labels/selection without replacing a focused or disabled button", () => {
    const { strip, buttons, session, labels, selected } = setup(); const hall = buttons()[0]; hall.focus();
    session.buildings[0].upgrade_finish_at_ms = Date.now() + 60_000; strip.sync();
    expect(hall.dataset.status).toBe("upgrading"); expect(hall.title).toBe("官府 · 升级中");
    session.buildings[0].upgrade_finish_at_ms += 30_000; strip.sync();
    labels.hall = "新官府"; strip.setSelectedSlotKey("hall");
    expect(hall.getAttribute("aria-label")).toBe("新官府 · 升级中");
    expect(hall.classList.contains("main-city-slot-overlay-cell-selected")).toBe(true);
    expect(document.activeElement).toBe(hall); expect(buttons()[0]).toBe(hall);
    hall.disabled = true; strip.sync(); hall.click(); expect(selected).not.toHaveBeenCalled();
    hall.disabled = false; hall.click(); expect(selected).toHaveBeenCalledExactlyOnceWith("hall");
    session.buildings[0].upgrade_finish_at_ms = 0; strip.sync(); expect(hall.dataset.status).not.toBe("upgrading");
    strip.setSelectedSlotKey("farm"); expect(hall.classList.contains("main-city-slot-overlay-cell-selected")).toBe(false);
  });
  it("keeps delegated listeners single across attach/sync and recreates only removed slots", () => {
    const { strip, buttons, selected } = setup(); const initial = buttons();
    strip.attach(); strip.sync(); initial[1].click(); expect(selected).toHaveBeenCalledExactlyOnceWith("farm");
    const original = matrix.buildBuildQueueSlotMatrix;
    const spy = vi.spyOn(matrix, "buildBuildQueueSlotMatrix").mockImplementation((...args) => original(...args).filter(c => c.slotKey !== "wall"));
    strip.sync(); expect(buttons()).toEqual(initial.slice(0, 6)); expect(initial[6].isConnected).toBe(false);
    spy.mockRestore(); strip.sync(); expect(buttons().slice(0, 6)).toEqual(initial.slice(0, 6)); expect(buttons()[6]).not.toBe(initial[6]);
    strip.detach(); strip.attach(); expect(buttons()).toHaveLength(7); buttons()[0].click(); expect(selected).toHaveBeenCalledTimes(2);
  });
});
