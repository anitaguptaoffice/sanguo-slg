import type { GatewayPort } from "./GatewayClient";
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

describe("city-state response ownership", () => {
  it.each(["city", "session", "mutation"])("drops obsolete %s response", async (change) => {
    let city = 1, session = "server1/player1";
    let resolve!: (value: object) => void;
    const getCityState = vi.fn(() => new Promise(r => { resolve = r; }));
    const fetch = new CityStateFetch({ getCityState }, () => city, () => session);
    const old = fetch.fetch();
    if (change === "city") city = 2;
    if (change === "session") session = "server2/player1";
    if (change === "mutation") fetch.clear();
    resolve({ garrison: { troops: [{ unit_cfg_id: 1, count: 10 }] } });
    expect(await old).toBeNull();
  });
  it("does not let an older completion release the newer request", async () => {
    const resolvers: ((value: object) => void)[] = [];
    const getCityState = vi.fn(() => new Promise(r => resolvers.push(r)));
    const fetch = new CityStateFetch({ getCityState }, () => 1);
    const old = fetch.fetch(); fetch.clear();
    const current = fetch.fetch();
    resolvers[0]({}); expect(await old).toBeNull();
    const deduped = fetch.fetch();
    expect(getCityState).toHaveBeenCalledTimes(2);
    resolvers[1]({ garrison: {} });
    expect(await current).toEqual({ garrison: {} });
    expect(await deduped).toEqual({ garrison: {} });
  });
});


it("rejects decoded snapshots invalidated before their consumer applies them", async () => {
  let resolve!: (value: object) => void;
  const fetch = new CityStateFetch({ getCityState: () => new Promise(r => { resolve = r; }) }, () => 1);
  const pending = fetch.fetch();
  resolve({ garrison: { troops: [{ unit_cfg_id: 1, count: 1 }] } });
  await Promise.resolve();
  fetch.clear();
  const decoded = await pending;
  expect(decoded).not.toBeNull();
  expect(fetch.isCurrent(decoded!)).toBe(false);
});

it("claim refresh invalidates older city-wallet snapshots and pending single-flight reads", async () => {
  const { beginAssetRead } = await import("./questClaimAssets");
  let resolve!: (value: object) => void;
  const gateway = { getCityState: vi.fn().mockReturnValueOnce(new Promise(r => { resolve = r; }))
    .mockResolvedValue({ wallet: { gold: 20 } }) } as unknown as GatewayPort;
  const fetcher = new CityStateFetch(gateway, () => 1);
  const pending = fetcher.fetch();
  beginAssetRead(gateway);
  const fresh = await fetcher.fetch();
  resolve({ wallet: { gold: 5 } });
  expect(await pending).toBeNull();
  expect(fresh?.wallet?.gold).toBe(20);
  expect(fetcher.isCurrent(fresh!)).toBe(true);
  beginAssetRead(gateway);
  expect(fetcher.isCurrent(fresh!)).toBe(false);
});

it("rejects decoded city snapshots after same-token same-actor re-entry", async () => {
  let generation = 1;
  const gateway = { getSessionGeneration: () => generation, getCityState: vi.fn().mockResolvedValue({ wallet: { gold: 5 } }) } as unknown as GatewayPort;
  const fetcher = new CityStateFetch(gateway, () => 1, () => "unchanged-token:server1:player1");
  const decoded = await fetcher.fetch();
  expect(fetcher.isCurrent(decoded!)).toBe(true);
  generation++;
  expect(fetcher.isCurrent(decoded!)).toBe(false);
});
