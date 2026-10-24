import { describe, expect, it, vi } from "vitest";
import {
  BAG_ROW_RETURN_HIGHLIGHT_CLASS,
  BAG_ROW_RETURN_HIGHLIGHT_MS,
  BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY,
  consumeBagShopReturnHighlight,
  parseBagShopReturnHighlight,
  scheduleBagRowReturnHighlight,
  serializeBagShopReturnHighlight,
  writeBagShopReturnHighlight,
} from "@/net/bagShopReturnHighlight";

describe("bagShopReturnHighlight (CLIENT-210)", () => {
  it("serializeBagShopReturnHighlight round-trips item_cfg_id", () => {
    const raw = serializeBagShopReturnHighlight(2017);
    expect(parseBagShopReturnHighlight(raw)).toBe(2017);
    expect(parseBagShopReturnHighlight("invalid")).toBeNull();
  });

  it("consumeBagShopReturnHighlight reads once then clears session", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
    };
    writeBagShopReturnHighlight(2001, mock);
    expect(storage.get(BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY)).toBeTruthy();
    expect(consumeBagShopReturnHighlight(mock)).toBe(2001);
    expect(consumeBagShopReturnHighlight(mock)).toBeNull();
  });

  it("scheduleBagRowReturnHighlight adds class for 2s", () => {
    const panel = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-item-cfg-id", "2003");
    panel.appendChild(li);
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        timeouts.push({ fn, ms });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(scheduleBagRowReturnHighlight(panel, 2003, win)).toBe(true);
    expect(li.classList.contains(BAG_ROW_RETURN_HIGHLIGHT_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(BAG_ROW_RETURN_HIGHLIGHT_MS);
    timeouts[0]?.fn();
    expect(li.classList.contains(BAG_ROW_RETURN_HIGHLIGHT_CLASS)).toBe(false);
  });
});
