import { describe, expect, it, vi } from "vitest";
import { CityStateFetch } from "@/net/cityStateFetch";

describe("CityStateFetch", () => {
  it("dedupes concurrent getCityState for the same city", async () => {
    const getCityState = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ wallet: { food: 1 } }), 20);
        }),
    );
    const fetch = new CityStateFetch({ getCityState }, () => 42);
    const a = fetch.fetch();
    const b = fetch.fetch();
    expect(getCityState).toHaveBeenCalledTimes(1);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra?.wallet?.food).toBe(1);
    expect(rb?.wallet?.food).toBe(1);
  });

  it("allows a new request after the previous completes", async () => {
    const getCityState = vi.fn().mockResolvedValue({ wallet: { gold: 5 } });
    const fetch = new CityStateFetch({ getCityState }, () => 1);
    await fetch.fetch();
    await fetch.fetch();
    expect(getCityState).toHaveBeenCalledTimes(2);
  });
});
