import type { CityBuilding, ResourceWallet } from "@/net/bootstrapSession";
import { formatTimeMs } from "@/net/militaryFormat";

function trimTrailingZero(s: string): string {
  return s.replace(/\.0$/, "");
}

/** HUD / 画布资源数值：万/亿缩写，否则 zh-CN 千分位（与面板内 raw 数字的 contentFormat 区分）。 */
export function formatResourceAmount(value: number | undefined): string {
  const n = value ?? 0;
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e8) {
    const scaled = abs / 1e8;
    const text = scaled >= 100 ? String(Math.round(scaled)) : trimTrailingZero(scaled.toFixed(1));
    return `${sign}${text}亿`;
  }
  if (abs >= 1e4) {
    const scaled = abs / 1e4;
    const text = scaled >= 100 ? String(Math.round(scaled)) : trimTrailingZero(scaled.toFixed(1));
    return `${sign}${text}万`;
  }
  return sign + Math.round(abs).toLocaleString("zh-CN");
}

const RESOURCE_KEYS: { key: keyof ResourceWallet; label: string }[] = [
  { key: "food", label: "粮" },
  { key: "wood", label: "木" },
  { key: "iron", label: "铁" },
  { key: "stone", label: "石" },
  { key: "gold", label: "币" },
];

export function formatResourceHudGroup(wallet: ResourceWallet | undefined): string {
  const w = wallet ?? {};
  return RESOURCE_KEYS.map(({ key, label }) => `${label} ${formatResourceAmount(w[key])}`).join(" · ");
}

export function formatUpgradeRemaining(finishAtMs: number | undefined, nowMs = Date.now()): string | null {
  if (!finishAtMs || finishAtMs <= nowMs) return null;
  const sec = Math.max(0, Math.ceil((finishAtMs - nowMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `剩 ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `剩 ${m}:${String(s).padStart(2, "0")}`;
}

/** 升级摘要：优先剩余时间，否则给出完成时刻。 */
export function formatUpgradeSummary(finishAtMs: number | undefined, nowMs = Date.now()): string {
  const rem = formatUpgradeRemaining(finishAtMs, nowMs);
  if (rem) return rem;
  if (finishAtMs && finishAtMs > nowMs) return `完成 ${formatTimeMs(finishAtMs)}`;
  return "";
}

export function buildingBySlot(buildings: CityBuilding[] | undefined, slotKey: string): CityBuilding | undefined {
  return buildings?.find((b) => b.slot_key === slotKey);
}

export function formatKeyBuildingHudLine(
  buildings: CityBuilding[] | undefined,
  slotLabels: Record<string, string>,
  slotKeys: string[],
  nowMs = Date.now(),
): string {
  return slotKeys
    .map((key) => {
      const b = buildingBySlot(buildings, key);
      const name = slotLabels[key] ?? key;
      const lv = b?.level ?? 0;
      const up = formatUpgradeSummary(b?.upgrade_finish_at_ms, nowMs);
      return up ? `${name} Lv${lv} · ${up}` : `${name} Lv${lv}`;
    })
    .join(" · ");
}

export function hasActiveBuildingUpgrade(buildings: CityBuilding[] | undefined, nowMs = Date.now()): boolean {
  return (buildings ?? []).some((b) => (b.upgrade_finish_at_ms ?? 0) > nowMs);
}

export type SlotBuildingCaption = {
  title: string;
  levelLine: string;
  upgradeLine: string | null;
};

export function formatSlotBuildingCaption(
  _slotKey: string,
  slotLabel: string,
  building: CityBuilding | undefined,
  nowMs = Date.now(),
): SlotBuildingCaption {
  const lv = building?.level ?? 0;
  const title = `${slotLabel} Lv${lv}`;
  const levelLine = `Lv${lv}`;
  const rem = formatUpgradeRemaining(building?.upgrade_finish_at_ms, nowMs);
  const upgradeLine = rem ?? (building?.upgrade_finish_at_ms && building.upgrade_finish_at_ms > nowMs
    ? formatUpgradeSummary(building.upgrade_finish_at_ms, nowMs)
    : null);
  return { title, levelLine, upgradeLine };
}

/** 画布上需强调等级的槽位（CLIENT-011：至少农田 + 城主府）。 */
export const KEY_BUILDING_SLOTS = new Set(["farm", "hall"]);
