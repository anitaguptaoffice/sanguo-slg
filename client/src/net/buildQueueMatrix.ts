import type { CityBuilding, ResourceWallet } from "@/net/bootstrapSession";
import { buildingBySlot } from "@/net/hudFormat";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";

/** 队列七槽矩阵列序（与 `docs/art/maincity-slots.md` 一致）。 */
export const MAIN_CITY_BUILD_QUEUE_SLOT_KEYS = [
  "hall",
  "farm",
  "lumber",
  "quarry",
  "iron",
  "barracks",
  "wall",
] as const;

export type MainCityBuildQueueSlotKey = (typeof MAIN_CITY_BUILD_QUEUE_SLOT_KEYS)[number];

export type BuildQueueSlotMatrixStatus = "idle" | "upgrading" | "upgradable";

export type BuildQueueSlotMatrixCell = {
  slotKey: string;
  matrixIndex: number;
  status: BuildQueueSlotMatrixStatus;
  abbrev: string;
  title: string;
};

const SLOT_MATRIX_ABBREV: Record<string, string> = {
  hall: "官",
  farm: "农",
  lumber: "木",
  quarry: "石",
  iron: "铁",
  barracks: "兵",
  wall: "城",
};

const STATUS_LABEL: Record<BuildQueueSlotMatrixStatus, string> = {
  idle: "空闲",
  upgrading: "升级中",
  upgradable: "可升级",
};

/** 进行中建造行：最早完成优先。 */
export function sortBuildQueueRows(
  buildings: readonly CityBuilding[],
  nowMs = Date.now(),
): CityBuilding[] {
  return buildings
    .filter((b) => (b.upgrade_finish_at_ms ?? 0) > nowMs)
    .sort((a, b) => (a.upgrade_finish_at_ms ?? 0) - (b.upgrade_finish_at_ms ?? 0));
}

export function buildQueueMatrixIndexForSlot(slotKey: string): number | null {
  const key = slotKey.trim();
  const idx = (MAIN_CITY_BUILD_QUEUE_SLOT_KEYS as readonly string[]).indexOf(key);
  return idx >= 0 ? idx : null;
}

export function resolveBuildQueueSlotMatrixStatus(
  slotKey: string,
  building: CityBuilding | undefined,
  wallet: ResourceWallet | undefined,
  nowMs = Date.now(),
): BuildQueueSlotMatrixStatus {
  if ((building?.upgrade_finish_at_ms ?? 0) > nowMs) return "upgrading";
  const level = building?.level ?? 0;
  const preview = previewUpgradeCost(slotKey, level, wallet);
  if (preview?.canAfford) return "upgradable";
  return "idle";
}

export function buildBuildQueueSlotMatrix(
  buildings: CityBuilding[] | undefined,
  wallet: ResourceWallet | undefined,
  slotLabels: Record<string, string>,
  nowMs = Date.now(),
): BuildQueueSlotMatrixCell[] {
  return MAIN_CITY_BUILD_QUEUE_SLOT_KEYS.map((slotKey, matrixIndex) => {
    const building = buildingBySlot(buildings, slotKey);
    const status = resolveBuildQueueSlotMatrixStatus(slotKey, building, wallet, nowMs);
    const name = slotLabels[slotKey] ?? building?.slot_key ?? slotKey;
    const abbrev = SLOT_MATRIX_ABBREV[slotKey] ?? name.slice(0, 1);
    return {
      slotKey,
      matrixIndex,
      status,
      abbrev,
      title: `${name} · ${STATUS_LABEL[status]}`,
    };
  });
}
