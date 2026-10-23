import type { CityBuilding } from "@/net/bootstrapSession";
import { activeBuildingUpgrades } from "@/net/queueState";

/** 建造从「进行中」变为非进行中后记入待办，直至玩家打开队列深链确认。 */
export class BuildCompleteTodoTracker {
  private pending = new Set<string>();
  private lastActive = new Set<string>();

  reset(): void {
    this.pending.clear();
    this.lastActive.clear();
  }

  onCityBuildings(buildings: CityBuilding[] | undefined, nowMs = Date.now()): void {
    const active = new Set(
      activeBuildingUpgrades(buildings, nowMs)
        .map((b) => b.slot_key)
        .filter((k): k is string => !!k),
    );
    for (const key of this.lastActive) {
      if (!active.has(key)) this.pending.add(key);
    }
    this.lastActive = active;
  }

  /** 打开队列面板或深链滚到建造完成行后扫读确认。 */
  acknowledgeAll(): void {
    this.pending.clear();
  }

  dismissSlot(slotKey: string): void {
    if (slotKey) this.pending.delete(slotKey);
  }

  pendingSlotKeys(): string[] {
    return [...this.pending].sort();
  }

  pendingCount(): number {
    return this.pending.size;
  }
}
