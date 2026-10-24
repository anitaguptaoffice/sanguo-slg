import { LAYOUT_FRAME, MAIN_CITY_SLOTS, type MainCitySlotDef } from "@/engine/mainCitySlots";
import type { CityBuilding } from "@/net/bootstrapSession";
import { buildingBySlot } from "@/net/hudFormat";
import { QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS } from "@/net/buildQueueComplete";
import {
  formatSlotOverlayLabel,
  syncUpgradeProgressAnchor,
  type UpgradeProgressAnchor,
  upgradeProgressRatio,
} from "@/net/mainCitySlotUpgrade";

const LAYER_CLASS = "main-city-slot-upgrade-layer";
const TAG_CLASS = "main-city-slot-upgrade-tag";

export class MainCitySlotUpgradeOverlay {
  private layer!: HTMLElement;
  private readonly anchors = new Map<string, UpgradeProgressAnchor>();
  private mutualHighlightSlotKey: string | null = null;

  constructor(private readonly mount: HTMLElement) {}

  setMutualHighlightSlot(slotKey: string | null): void {
    this.mutualHighlightSlotKey = slotKey?.trim() || null;
    this.layer?.querySelectorAll(`.${TAG_CLASS}`).forEach((el) => {
      const key = (el as HTMLElement).dataset.slotKey ?? "";
      el.classList.toggle(
        QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS,
        !!this.mutualHighlightSlotKey && key === this.mutualHighlightSlotKey,
      );
    });
  }

  attach(): void {
    this.layer = document.createElement("div");
    this.layer.className = LAYER_CLASS;
    this.layer.setAttribute("aria-hidden", "true");
    this.mount.insertBefore(this.layer, this.mount.firstChild?.nextSibling ?? null);
  }

  detach(): void {
    this.layer?.remove();
    this.anchors.clear();
  }

  sync(buildings: CityBuilding[] | undefined, nowMs = Date.now()): void {
    if (!this.layer) return;
    const activeKeys = new Set<string>();
    for (const slot of MAIN_CITY_SLOTS) {
      const building = buildingBySlot(buildings, slot.slot_key);
      const finish = building?.upgrade_finish_at_ms ?? 0;
      if (finish <= nowMs) {
        this.anchors.delete(slot.slot_key);
        continue;
      }
      activeKeys.add(slot.slot_key);
      const prev = this.anchors.get(slot.slot_key);
      const next = syncUpgradeProgressAnchor(prev, finish, nowMs);
      if (next) this.anchors.set(slot.slot_key, next);
      else this.anchors.delete(slot.slot_key);
    }
    for (const key of [...this.anchors.keys()]) {
      if (!activeKeys.has(key)) this.anchors.delete(key);
    }

    this.layer.replaceChildren();
    for (const slot of MAIN_CITY_SLOTS) {
      const building = buildingBySlot(buildings, slot.slot_key);
      const finish = building?.upgrade_finish_at_ms ?? 0;
      const upgrading = finish > nowMs;
      const anchor = upgrading ? this.anchors.get(slot.slot_key) : undefined;
      const ratio = anchor ? upgradeProgressRatio(anchor, nowMs) : null;
      const label = formatSlotOverlayLabel(building, nowMs);
      this.layer.appendChild(this.buildTag(slot, label, ratio));
    }
    this.setMutualHighlightSlot(this.mutualHighlightSlotKey);
  }

  private buildTag(slot: MainCitySlotDef, label: string, ratio: number | null): HTMLElement {
    const el = document.createElement("div");
    el.className = TAG_CLASS;
    if (
      this.mutualHighlightSlotKey &&
      slot.slot_key === this.mutualHighlightSlotKey
    ) {
      el.classList.add(QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS);
    }
    el.dataset.slotKey = slot.slot_key;
    const { display } = slot;
    el.style.left = `${(display.x / LAYOUT_FRAME.w) * 100}%`;
    el.style.top = `${(display.y / LAYOUT_FRAME.h) * 100}%`;
    el.style.width = `${(display.w / LAYOUT_FRAME.w) * 100}%`;

    const time = document.createElement("span");
    time.className = "main-city-slot-upgrade-time";
    time.textContent = label;

    el.appendChild(time);
    if (ratio != null) {
      const bar = document.createElement("div");
      bar.className = "main-city-slot-upgrade-bar";
      const fill = document.createElement("div");
      fill.className = "main-city-slot-upgrade-bar-fill";
      fill.style.width = `${Math.round(ratio * 100)}%`;
      bar.appendChild(fill);
      el.appendChild(bar);
    }
    return el;
  }
}
