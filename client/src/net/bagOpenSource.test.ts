import { describe, expect, it } from "vitest";
import {
  BAG_OPEN_SOURCE_QUERY_KEY,
  BAG_OPEN_SOURCE_SESSION_KEY,
  appendBagOpenSourceQuery,
  clearBagOpenSourceSession,
  formatBagOpenSourceTagLabel,
  parseBagOpenSource,
  readBagOpenSourceSession,
  writeBagOpenSourceSession,
} from "@/net/bagOpenSource";

describe("bagOpenSource (CLIENT-175)", () => {
  it("parseBagOpenSource accepts daily/hero/shop", () => {
    expect(parseBagOpenSource("daily")).toBe("daily");
    expect(parseBagOpenSource("hero")).toBe("hero");
    expect(parseBagOpenSource("shop")).toBe("shop");
    expect(parseBagOpenSource("mail")).toBeNull();
  });

  it("persists source in sessionStorage bag-open-source-v1", () => {
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
    writeBagOpenSourceSession("hero", mock);
    expect(storage.get(BAG_OPEN_SOURCE_SESSION_KEY)).toBe("hero");
    expect(readBagOpenSourceSession(mock)).toBe("hero");
    clearBagOpenSourceSession(mock);
    expect(readBagOpenSourceSession(mock)).toBeNull();
  });

  it("appendBagOpenSourceQuery sets bagOpenSource param", () => {
    const params = new URLSearchParams();
    appendBagOpenSourceQuery(params, "daily");
    expect(params.get(BAG_OPEN_SOURCE_QUERY_KEY)).toBe("daily");
    expect(formatBagOpenSourceTagLabel("daily")).toBe("来源：日常");
  });
});
