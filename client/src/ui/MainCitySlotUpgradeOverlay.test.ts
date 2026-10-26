import { afterEach, describe, expect, it } from "vitest";
import { MainCitySlotUpgradeOverlay } from "./MainCitySlotUpgradeOverlay";
import type { CityBuilding } from "@/net/bootstrapSession";
import { QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS } from "@/net/buildQueueComplete";

const roots: HTMLElement[] = [];
afterEach(() => roots.splice(0).forEach(root => root.remove()));
function setup() {
  const root = document.createElement("div"); document.body.append(root); roots.push(root);
  const overlay = new MainCitySlotUpgradeOverlay(root); overlay.attach();
  const buildings: CityBuilding[] = [{ slot_key: "hall", level: 3, upgrade_finish_at_ms: 0 }];
  const tags = () => [...root.querySelectorAll<HTMLElement>(".main-city-slot-upgrade-tag")];
  return { root, overlay, buildings, tags };
}

describe("CLT-RENDERER-LIFECYCLE-001 stable slot-upgrade DOM", () => {
  it("does not replace or mutate unchanged tags across ordinary animation frames", () => {
    const { overlay, buildings, tags } = setup(); overlay.sync(buildings, 1_000);
    const initial = tags(); const hall = initial.find(el => el.dataset.slotKey === "hall")!;
    hall.classList.add("external-completion-pulse");
    const observer = new MutationObserver(() => {});
    observer.observe(overlay.getOverlayLayer()!, { childList: true, attributes: true, characterData: true, subtree: true });
    for (let frame = 0; frame < 600; frame++) overlay.sync(buildings, 1_000 + frame * 16);
    tags().forEach((tag, index) => expect(tag).toBe(initial[index]));
    expect(hall.classList.contains("external-completion-pulse")).toBe(true);
    expect(observer.takeRecords()).toEqual([]); observer.disconnect();
  });
  it("updates countdown, progress, level and completion without replacing the tag", () => {
    const { overlay, buildings, tags } = setup(); overlay.sync(buildings, 1_000);
    const hall = tags().find(el => el.dataset.slotKey === "hall")!;
    buildings[0].upgrade_finish_at_ms = 11_000; overlay.sync(buildings, 1_000);
    const label = hall.querySelector(".main-city-slot-upgrade-time")!;
    const fill = hall.querySelector<HTMLElement>(".main-city-slot-upgrade-bar-fill")!;
    expect(label.textContent).toBe("Lv3 · 0:10"); expect(fill.style.width).toBe("50%");
    overlay.sync(buildings, 6_000);
    expect(label.textContent).toBe("Lv3 · 0:05"); expect(fill.style.width).toBe("75%");
    buildings[0].level = 4; buildings[0].upgrade_finish_at_ms = 0; overlay.sync(buildings, 11_000);
    expect(tags().find(el => el.dataset.slotKey === "hall")).toBe(hall);
    expect(label.textContent).toBe("Lv4"); expect(hall.querySelector(".main-city-slot-upgrade-bar")).toBeNull();
    overlay.sync([], 12_000); expect(label.textContent).toBe("Lv0");
  });
  it("ignores a late sync after detach and can attach a fresh layer", () => {
    const { overlay, buildings, tags } = setup(); overlay.sync(buildings, 1_000);
    const oldLayer = overlay.getOverlayLayer()!;
    const observer = new MutationObserver(() => {}); observer.observe(oldLayer, { childList: true, subtree: true });
    overlay.detach(); buildings[0].level = 4; overlay.sync(buildings, 2_000);
    expect(overlay.getOverlayLayer()).toBeUndefined(); expect(observer.takeRecords()).toEqual([]);
    observer.disconnect(); overlay.attach(); overlay.sync(buildings, 2_000);
    expect(overlay.getOverlayLayer()).not.toBe(oldLayer); expect(tags()).toHaveLength(7);
    expect(tags().find(el => el.dataset.slotKey === "hall")?.textContent).toBe("Lv4");
  });
  it("keeps highlight selection and repeated attach/detach bounded", () => {
    const { root, overlay, buildings, tags } = setup(); overlay.sync(buildings, 1_000);
    overlay.attach(); expect(root.querySelectorAll(".main-city-slot-upgrade-layer")).toHaveLength(1);
    overlay.setMutualHighlightSlot("hall"); overlay.sync(buildings, 1_001);
    expect(tags().filter(el => el.classList.contains(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS)).map(el => el.dataset.slotKey)).toEqual(["hall"]);
    const old = tags(); overlay.detach(); expect(old.every(el => !el.isConnected)).toBe(true);
    overlay.attach(); overlay.sync(buildings, 1_002); expect(tags()).toHaveLength(7);
    expect(tags()[0]).not.toBe(old[0]); overlay.setMutualHighlightSlot(null);
    expect(tags().every(el => !el.classList.contains(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS))).toBe(true);
  });
});
