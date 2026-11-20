import type { CityBuilding } from "@/net/bootstrapSession";
import { BUILDING_UNLOCK_HALL } from "@/net/buildingUpgradeCatalog";

/** Read-only mirror of domestic.ValidateUpgrade's hall prerequisites, not server authority. */
export function buildUpgradePrerequisiteHint(
  buildingCfgId: number,
  targetLevel: number,
  buildings: readonly CityBuilding[],
): string | null {
  if (buildingCfgId === 1) {
    const highestOtherLevel = buildings.reduce(
      (max, b) => b.building_cfg_id === 1 ? max : Math.max(max, b.level ?? 0), 0,
    );
    return highestOtherLevel > targetLevel
      ? `城主府目标等级不能低于其他建筑（当前最高 Lv${highestOtherLevel}）`
      : null;
  }
  const hallLevel = buildings.find((b) => b.building_cfg_id === 1)?.level ?? 0;
  // Placement uses the per-building unlock table; upgrades follow the level.
  const requiredLevel = targetLevel === 1
    ? Math.max(BUILDING_UNLOCK_HALL[buildingCfgId] ?? 1, 1)
    : targetLevel;
  return hallLevel < requiredLevel
    ? `需城主府达到 Lv${requiredLevel}（当前 Lv${hallLevel}）；请先升级城主府`
    : null;
}
