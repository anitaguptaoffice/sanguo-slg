/** 与 internal/military/march DefaultUnitCatalog / cfg_unit 1–4 对齐（客户端只读预览，非 spec 真源）。 */
export type TroopRecruitResourceCost = {
  food: number;
  wood: number;
  stone: number;
  iron: number;
};

export type TroopRecruitSpec = {
  unitCfgId: number;
  recruitCostPerUnit: TroopRecruitResourceCost;
  secPerUnit: number;
};

export const TROOP_RECRUIT_SPECS: Record<number, TroopRecruitSpec> = {
  1: {
    unitCfgId: 1,
    recruitCostPerUnit: { food: 40, wood: 20, stone: 0, iron: 0 },
    secPerUnit: 30,
  },
  2: {
    unitCfgId: 2,
    recruitCostPerUnit: { food: 80, wood: 40, stone: 0, iron: 20 },
    secPerUnit: 45,
  },
  3: {
    unitCfgId: 3,
    recruitCostPerUnit: { food: 50, wood: 60, stone: 0, iron: 0 },
    secPerUnit: 35,
  },
  4: {
    unitCfgId: 4,
    recruitCostPerUnit: { food: 100, wood: 80, stone: 40, iron: 30 },
    secPerUnit: 60,
  },
};

export function troopRecruitSpecForCfgId(cfgId: number): TroopRecruitSpec | undefined {
  return TROOP_RECRUIT_SPECS[cfgId];
}

export function scaleTroopRecruitCost(
  perUnit: TroopRecruitResourceCost,
  count: number,
): TroopRecruitResourceCost {
  const qty = Math.max(0, Math.floor(count));
  return {
    food: perUnit.food * qty,
    wood: perUnit.wood * qty,
    stone: perUnit.stone * qty,
    iron: perUnit.iron * qty,
  };
}
