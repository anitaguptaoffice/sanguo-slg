// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAG_USE_CAPABILITIES, canUseBagItem } from "./bagUseCapability";
import { validateBagUseConsumable, validateUseConsumable } from "./contentFormValidation";
import { isBatchUseEligibleItem } from "./bagBatchUse";

describe("readonly bag capability catalog alignment", () => {
  it("covers the server catalog exactly, including DATA-002 alternate IDs", () => {
    const catalog = JSON.parse(readFileSync(new URL("../../../internal/content/seed/catalog.json", import.meta.url), "utf8"));
    const expected = Object.fromEntries(catalog.items.map((item: { item_cfg_id: number; item_type: number; meta: { grants?: Record<string, number>; applies_to?: string[] } }) => {
      const kind = item.item_type === 3 ? "recruit" : item.item_type === 4 ? "train"
        : item.item_type === 2 && item.meta.applies_to?.includes("build") ? "build-speedup"
        : item.item_type === 1 && item.meta.grants && Object.keys(item.meta.grants).length > 0 &&
          Object.keys(item.meta.grants).every(k => ["food", "wood", "iron", "stone"].includes(k)) ? "resource" : "unsupported";
      return [item.item_cfg_id, kind];
    }));
    expect(BAG_USE_CAPABILITIES).toEqual(expected);
    expect(Object.isFrozen(BAG_USE_CAPABILITIES)).toBe(true);
  });
  it("does not change dedicated hero-flow validation", () => {
    expect(validateUseConsumable({ itemCfgId: 2017, count: 1, bag: [{ item_cfg_id: 2017, quantity: 1 }] }).ok).toBe(true);
  });
  it.each([...Object.keys(BAG_USE_CAPABILITIES).map(Number), 0, -1, 9999])("single and batch agree on #%i", id => {
    expect(isBatchUseEligibleItem(id)).toBe(canUseBagItem(id));
    expect(validateBagUseConsumable({ itemCfgId: id, count: 1, bag: [{ item_cfg_id: id, quantity: 1 }] }).ok).toBe(canUseBagItem(id));
  });
});
