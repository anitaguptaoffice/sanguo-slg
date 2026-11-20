/** 与 internal/domestic DefaultCatalog + params.yml domestic.build 对齐（客户端只读预览，非 spec 真源）。 */
export const BUILDING_UPGRADE_COST_GROWTH = 1.6;
export const BUILDING_UPGRADE_TIME_GROWTH = 1.5;

export type BuildingUpgradeResourceCost = {
  food: number;
  wood: number;
  stone: number;
  iron: number;
};

export type BuildingUpgradeSpec = {
  buildingCfgId: number;
  baseTimeSec: number;
  baseCost: BuildingUpgradeResourceCost;
};

/** building_cfg_id → 升级曲线参数（R2-S1 二十种建筑）。 */
export const BUILDING_UPGRADE_SPECS: Record<number, BuildingUpgradeSpec> = {
  1: { buildingCfgId: 1, baseTimeSec: 60, baseCost: { food: 200, wood: 200, stone: 100, iron: 50 } },
  2: { buildingCfgId: 2, baseTimeSec: 45, baseCost: { food: 50, wood: 150, stone: 30, iron: 0 } },
  3: { buildingCfgId: 3, baseTimeSec: 45, baseCost: { food: 50, wood: 100, stone: 50, iron: 0 } },
  4: { buildingCfgId: 4, baseTimeSec: 50, baseCost: { food: 80, wood: 80, stone: 100, iron: 0 } },
  5: { buildingCfgId: 5, baseTimeSec: 55, baseCost: { food: 100, wood: 80, stone: 80, iron: 50 } },
  6: { buildingCfgId: 6, baseTimeSec: 90, baseCost: { food: 150, wood: 200, stone: 150, iron: 100 } },
  7: { buildingCfgId: 7, baseTimeSec: 120, baseCost: { food: 100, wood: 100, stone: 300, iron: 150 } },
  8: { buildingCfgId: 8, baseTimeSec: 100, baseCost: { food: 120, wood: 180, stone: 80, iron: 40 } },
  9: { buildingCfgId: 9, baseTimeSec: 95, baseCost: { food: 160, wood: 160, stone: 120, iron: 80 } },
  10: { buildingCfgId: 10, baseTimeSec: 70, baseCost: { food: 100, wood: 120, stone: 60, iron: 20 } },
  11: { buildingCfgId: 11, baseTimeSec: 85, baseCost: { food: 140, wood: 160, stone: 90, iron: 40 } },
  12: { buildingCfgId: 12, baseTimeSec: 80, baseCost: { food: 120, wood: 150, stone: 100, iron: 30 } },
  13: { buildingCfgId: 13, baseTimeSec: 110, baseCost: { food: 100, wood: 140, stone: 180, iron: 160 } },
  14: { buildingCfgId: 14, baseTimeSec: 105, baseCost: { food: 110, wood: 170, stone: 140, iron: 110 } },
  15: { buildingCfgId: 15, baseTimeSec: 115, baseCost: { food: 150, wood: 180, stone: 100, iron: 90 } },
  16: { buildingCfgId: 16, baseTimeSec: 75, baseCost: { food: 90, wood: 200, stone: 120, iron: 50 } },
  17: { buildingCfgId: 17, baseTimeSec: 130, baseCost: { food: 160, wood: 150, stone: 120, iron: 60 } },
  18: { buildingCfgId: 18, baseTimeSec: 100, baseCost: { food: 120, wood: 140, stone: 90, iron: 40 } },
  19: { buildingCfgId: 19, baseTimeSec: 90, baseCost: { food: 100, wood: 120, stone: 220, iron: 60 } },
  20: { buildingCfgId: 20, baseTimeSec: 40, baseCost: { food: 60, wood: 80, stone: 40, iron: 0 } },
};

/** 放置建筑所需的最低官府等级（R2-S1）。 */
export const BUILDING_UNLOCK_HALL: Record<number, number> = {
  1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 3, 8: 3, 9: 4, 10: 2,
  11: 3, 12: 4, 13: 5, 14: 5, 15: 6, 16: 4, 17: 7, 18: 5, 19: 6, 20: 1,
};

export function buildingUpgradeSpecForCfgId(cfgId: number): BuildingUpgradeSpec | undefined {
  return BUILDING_UPGRADE_SPECS[cfgId];
}
