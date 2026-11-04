import { afterEach, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
afterEach(() => sessionStorage.clear());
function setup() {
  let token = "a", generation = 1, nextMarch = 9;
  const root = document.createElement("div"); root.dataset.centerPanel = "military";
  root.innerHTML = '<input data-field="to-x" value="10"><input data-field="to-y" value="20"><input data-field="march-count" value="5"><select data-field="march-hero"><option value="7">hero</option></select><button data-action="march"></button><p data-role="march-form-error"></p>';
  const gateway = { getSessionId: () => token, getSessionGeneration: () => generation, getBoundServerId: () => 1,
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 1 }] })),
    startMarch: vi.fn(async () => ({ march: { march_id: nextMarch++, phase: 2 }, city_troops: [{ unit_cfg_id: 1, count: 30 }] })) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { serverId: 1, player: { player_id: 1 }, cityId: 1, cityX: 60, cityY: 60, garrisonStatus: "ready", cityTroops: [{ unit_cfg_id: 1, count: 40 }] }, gateway, militaryPanel: root,
    marchFormHeroes: [{ hero_id: 7, level: 1 }], cityStateFetch: { clear: vi.fn() }, renderHud: vi.fn(),
    marchArrivalPoll: { trackMarch: vi.fn(), reset: vi.fn() }, marchList: { notifyMarchStarted: vi.fn(), getSelectedMarch: () => null, detach: vi.fn() },
    refreshMinimapMarches: vi.fn().mockResolvedValue(undefined), refreshState: vi.fn().mockResolvedValue(undefined) });
  return { scene, gateway, root, button: () => root.querySelector<HTMLButtonElement>('[data-action="march"]')!,
    select: () => root.querySelector<HTMLSelectElement>('[data-field="march-hero"]')!, relogin() { token = "b"; generation++; } };
}
it("allows a second march after the exact locally started order returns, without hero_id/status wire fields", async () => {
  const f = setup(); await f.scene.startMarch(); await f.scene.refreshMarchFormHeroes();
  expect(f.button().disabled).toBe(true);
  f.scene.applyMarchesSnapshot([{ march_id: 9, phase: 5 }]); await f.scene.refreshMarchFormHeroes();
  expect(f.scene.marchLocalBusyHeroIds.has(7)).toBe(false); expect(f.button().disabled).toBe(false);
  expect(f.select().value).toBe("7"); await f.scene.startMarch(); expect(f.gateway.startMarch).toHaveBeenCalledTimes(2);
});
it.each([0, 1, 2, 3, 4])("does not release from phase %s, absence, or unrelated returned history", async phase => {
  const f = setup(); await f.scene.startMarch();
  for (const rows of [[], [{ march_id: 1, phase: 5 }], [{ march_id: 9, phase, return_finish_at_ms: 1 }]]) {
    f.scene.applyMarchesSnapshot(rows); expect(f.scene.marchLocalBusyHeroIds.has(7)).toBe(true);
  }
});
it("old returned history cannot release a newer march and matching return clears only synthetic status", async () => {
  const f = setup(); await f.scene.startMarch(); f.scene.applyMarchesSnapshot([{ march_id: 9, phase: 5 }]);
  expect(f.scene.marchFormHeroes[0].status).toBe(0);
  await f.scene.startMarch(); expect(f.scene.marchLocalHeroOrders.get(7)).toBe(10);
  f.scene.applyMarchesSnapshot([{ march_id: 9, phase: 5 }, { march_id: 10, phase: 4 }]);
  expect(f.scene.marchLocalBusyHeroIds.has(7)).toBe(true);
  f.scene.marchFormHeroes[0].status = 4;
  f.scene.applyMarchesSnapshot([{ march_id: 10, phase: 5 }]);
  expect(f.scene.marchFormHeroes[0].status).toBe(4); expect(f.button().disabled).toBe(true);
});
it("never releases an unmapped busy hero or contradictory same-ID phases", async () => {
  const f = setup(); await f.scene.startMarch(); f.scene.marchLocalBusyHeroIds.add(8);
  f.scene.applyMarchesSnapshot([{ march_id: 9, phase: 5 }, { march_id: 9, phase: 2 }]);
  expect([...f.scene.marchLocalBusyHeroIds]).toEqual([7, 8]);
  f.scene.applyMarchesSnapshot([{ march_id: 9, phase: 5 }]); expect([...f.scene.marchLocalBusyHeroIds]).toEqual([8]);
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
it.each(["leave", "relogin", "city", "player"])("ignores old submit results after %s", async action => {
  const f = setup(), pending = deferred<any>(); f.gateway.startMarch.mockImplementationOnce(() => pending.promise);
  const request = f.scene.startMarch();
  if (action === "leave") f.scene.leave();
  else if (action === "relogin") f.relogin();
  else if (action === "city") f.scene.session.cityId = 2;
  else f.scene.session.player.player_id = 2;
  if (action !== "leave") await f.scene.refreshMarchFormHeroes();
  pending.resolve({ march: { march_id: 9, phase: 2 }, city_troops: [{ unit_cfg_id: 1, count: 1 }] }); await request;
  expect(f.scene.marchLocalHeroOrders.size).toBe(0); expect(f.scene.marchLocalBusyHeroIds.size).toBe(0);
  expect(f.scene.marchArrivalPoll.trackMarch).not.toHaveBeenCalled(); expect(f.scene.marchSubmitState).toBe("idle");
});
it("old hero-list completion cannot overwrite or unlock the new actor's pending read", async () => {
  const f = setup(), old = deferred<any>(), next = deferred<any>();
  f.gateway.listPlayerHeroes.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
  const one = f.scene.refreshMarchFormHeroes(); f.relogin(); const two = f.scene.refreshMarchFormHeroes();
  old.resolve({ heroes: [{ hero_id: 99, status: 1 }] }); await one;
  expect(f.scene.marchHeroListLoading).toBe(true); expect(f.scene.marchFormHeroes).toEqual([]);
  next.resolve({ heroes: [{ hero_id: 8 }] }); await two;
  expect(f.scene.marchHeroListLoading).toBe(false); expect(f.scene.marchFormHeroes).toEqual([{ hero_id: 8 }]);
});
it("failed commands create no binding; scene exit clears successful bindings", async () => {
  const f = setup(); f.gateway.startMarch.mockRejectedValueOnce(new Error("not idle")); await f.scene.startMarch();
  expect(f.scene.marchLocalHeroOrders.size).toBe(0);
  f.scene.session.garrisonStatus = "ready"; await f.scene.startMarch(); expect(f.scene.marchLocalHeroOrders.size).toBe(1);
  f.scene.leave(); expect(f.scene.marchLocalHeroOrders.size).toBe(0); expect(f.scene.marchFormHeroes).toEqual([]);
});
