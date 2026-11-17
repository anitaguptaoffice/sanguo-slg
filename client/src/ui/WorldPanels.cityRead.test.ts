import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { WorldPanels } from "./WorldPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const cities = (name: string, x = 10) => ({ cities: [{ city_id: 2, name, x, y: 20 }] });
function setup() {
  const mount = document.createElement("div"), form = document.createElement("div"), status = vi.fn(); let generation = 1;
  form.innerHTML = '<input data-field="to-x"><input data-field="to-y">';
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation,
    listPlayerCities: vi.fn().mockResolvedValue(cities("fresh")) };
  const panels = new WorldPanels(mount, gateway as unknown as GatewayPort, () => session, { marchFormRoot: form }, status);
  panels.attach();
  const refresh = () => mount.querySelector<HTMLButtonElement>('[data-action="refresh-world"]')!.click();
  const list = () => mount.querySelector('[data-role="world-list"]')!.textContent;
  const state = () => mount.querySelector('[data-role="world-tile-info-state"]')!.getAttribute("data-panel-state");
  return { panels, mount, form, gateway, status, refresh, list, state, relogin: () => { generation++; } };
}
describe("world city read ownership", () => {
  it("newer cities survive a late old response and supply the march target", async () => {
    const { panels, gateway, refresh, list, mount, form } = setup(); const old = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never);
    panels.toggle(); refresh(); await flush(); old.resolve(cities("old", 99)); await flush();
    expect(list()).toContain("fresh"); expect(list()).not.toContain("old");
    mount.querySelector<HTMLLIElement>('[data-city-id="2"]')!.click();
    expect(form.querySelector<HTMLInputElement>('[data-field="to-x"]')!.value).toBe("10"); panels.detach();
  });
  it("old failure cannot end the newest request's loading state", async () => {
    const { panels, gateway, refresh, state, status } = setup(); const old = deferred(), fresh = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.selectGridAt(10, 20); panels.toggle(); refresh(); status.mockClear();
    old.reject(new Error("old error")); await flush();
    expect(state()).toBe("loading"); expect(status).not.toHaveBeenCalled();
    fresh.resolve(cities("fresh")); await flush(); panels.detach();
  });
  it("old success cannot end the newest request's loading state", async () => {
    const { panels, gateway, refresh, state, status, list } = setup(); const old = deferred(), fresh = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.selectGridAt(10, 20); panels.toggle(); refresh(); status.mockClear();
    old.resolve(cities("old")); await flush(); expect(state()).toBe("loading"); expect(status).not.toHaveBeenCalled(); expect(list()).not.toContain("old");
    fresh.resolve(cities("fresh")); await flush(); expect(state()).toBeNull(); panels.detach();
  });
  it.each([false, true])("old response cannot populate a remounted panel (reject=%s)", async (reject) => {
    const { panels, gateway, list, status } = setup(); const old = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never);
    panels.toggle(); panels.detach(); panels.attach(); panels.toggle(); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old error")); else old.resolve(cities("old")); await flush();
    expect(list()).toContain("fresh"); expect(list()).not.toContain("old"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it.each([false, true])("same-player relogin ignores prior read completion (reject=%s)", async (reject) => {
    const { panels, gateway, list, status, refresh, relogin } = setup(); const old = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never);
    panels.toggle(); relogin(); refresh(); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old error")); else old.resolve(cities("old")); await flush();
    expect(list()).toContain("fresh"); expect(list()).not.toContain("old"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it("new login clears cached cities before its new response", async () => {
    const { panels, gateway, list, refresh, relogin } = setup(); panels.toggle(); await flush();
    expect(list()).toContain("fresh"); relogin(); const pending = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(pending.promise as never); refresh(); expect(list()).not.toContain("fresh");
    pending.resolve(cities("new login")); await flush(); expect(list()).toContain("new login"); panels.detach();
  });
  it("current error is visible and retry preserves a valid grid selection", async () => {
    const { panels, gateway, refresh, state, list } = setup();
    panels.selectGridAt(10, 20); gateway.listPlayerCities.mockRejectedValueOnce(new Error("current failure"));
    panels.toggle(); await flush(); expect(state()).toBe("error");
    refresh(); await flush(); expect(state()).toBeNull(); expect(list()).toContain("fresh"); expect(panels.getSelectedGrid()).toEqual({ x: 10, y: 20 }); panels.detach();
  });
  it("reopening starts a fresh read without letting the first open win", async () => {
    const { panels, gateway, list } = setup(); const old = deferred();
    gateway.listPlayerCities.mockReturnValueOnce(old.promise as never);
    panels.toggle(); panels.toggle(); panels.openPanel(); await flush();
    old.resolve(cities("old open")); await flush(); expect(list()).toContain("fresh"); expect(list()).not.toContain("old open"); panels.detach();
  });

});
