import type { BagClientCategory } from "@/net/bagCategory";

const CATEGORY_VALUES: readonly BagClientCategory[] = ["all", "consumable", "cultivation"];

export function parseBagCategoryTabSessionValue(
  raw: string | null | undefined,
): BagClientCategory | null {
  if (raw == null || raw === "") return null;
  if ((CATEGORY_VALUES as readonly string[]).includes(raw)) {
    return raw as BagClientCategory;
  }
  return null;
}
