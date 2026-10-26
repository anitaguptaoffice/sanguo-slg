/** Readonly UI allowlist, not a new catalog or protocol. Mirrors existing DATA-002
 * internal/content/seed/catalog.json and generic UseConsumable's implemented effects.
 * Only food/wood/iron/stone grants and build speedups are applied there. RecruitHero
 * is a separate flow; train/recruit metadata alone does not authorize generic use.
 * bagUseCapability.test.ts detects catalog drift; unknown IDs fail closed. */
export type BagUseCapability = "resource" | "build-speedup" | "recruit" | "train" | "unsupported";
export const BAG_USE_CAPABILITIES: Readonly<Record<number, BagUseCapability>> = Object.freeze({
  2001: "resource", 2002: "resource", 2003: "build-speedup",
  2004: "recruit", 2005: "train", 2006: "train",
  2007: "resource", 2008: "resource", 2009: "resource", 2010: "unsupported",
  2011: "build-speedup", 2012: "recruit", 2013: "train", 2014: "train",
  2015: "unsupported", 2016: "unsupported", 2017: "unsupported", 2018: "resource",
  2019: "unsupported", 2020: "resource", 2021: "unsupported", 2022: "unsupported",
  2023: "resource", 2024: "resource", 2025: "resource", 2026: "unsupported",
  2027: "unsupported", 2028: "resource", 2029: "unsupported", 2030: "resource",
  2031: "resource", 2032: "resource", 2033: "resource", 2034: "unsupported",
  2035: "build-speedup", 2036: "build-speedup", 2037: "recruit", 2038: "train",
  2039: "train", 2040: "train", 2041: "train", 2042: "resource", 2043: "resource",
  2044: "resource", 2045: "resource", 2046: "resource", 2047: "unsupported",
  2048: "resource", 2049: "resource",
});

export function canUseBagItem(itemId: number): boolean {
  return ["resource", "build-speedup"].includes(BAG_USE_CAPABILITIES[itemId]);
}

export function bagUseCapabilityHint(itemId: number): string | null {
  if (canUseBagItem(itemId)) return null;
  const kind = BAG_USE_CAPABILITIES[itemId];
  const reason = kind === "recruit" ? "招募道具请前往将领的专用招募入口，背包不执行招募。"
    : kind === "train" ? "征兵道具暂未接入即时发兵，背包不执行征兵。"
    : "此道具的直接使用效果尚未支持，背包不可使用。";
  return `${reason}未提交，不会扣除道具。`;
}
