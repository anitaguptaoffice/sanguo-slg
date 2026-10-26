import type { CityBuilding } from "@/net/bootstrapSession";

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
  // First construction has the same additional thresholds as the existing server.
  const requiredLevel = targetLevel === 1 && buildingCfgId === 6 ? 2
    : targetLevel === 1 && buildingCfgId === 7 ? 3 : targetLevel;
  return hallLevel < requiredLevel
    ? `需城主府达到 Lv${requiredLevel}（当前 Lv${hallLevel}）；请先升级城主府`
    : null;
}
