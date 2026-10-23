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

/** building_cfg_id → 升级曲线参数（勿扩行；与 DATA-002 七种建筑一致）。 */
export const BUILDING_UPGRADE_SPECS: Record<number, BuildingUpgradeSpec> = {
  1: { buildingCfgId: 1, baseTimeSec: 60, baseCost: { food: 200, wood: 200, stone: 100, iron: 50 } },
  2: { buildingCfgId: 2, baseTimeSec: 45, baseCost: { food: 50, wood: 150, stone: 30, iron: 0 } },
  3: { buildingCfgId: 3, baseTimeSec: 45, baseCost: { food: 50, wood: 100, stone: 50, iron: 0 } },
  4: { buildingCfgId: 4, baseTimeSec: 50, baseCost: { food: 80, wood: 80, stone: 100, iron: 0 } },
  5: { buildingCfgId: 5, baseTimeSec: 55, baseCost: { food: 100, wood: 80, stone: 80, iron: 50 } },
  6: { buildingCfgId: 6, baseTimeSec: 90, baseCost: { food: 150, wood: 200, stone: 150, iron: 100 } },
  7: { buildingCfgId: 7, baseTimeSec: 120, baseCost: { food: 100, wood: 100, stone: 300, iron: 150 } },
};

export function buildingUpgradeSpecForCfgId(cfgId: number): BuildingUpgradeSpec | undefined {
  return BUILDING_UPGRADE_SPECS[cfgId];
}
