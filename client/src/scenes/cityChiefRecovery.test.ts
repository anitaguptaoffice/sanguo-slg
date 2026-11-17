import { afterEach, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { MainCityCityOfficePanel } from "@/ui/MainCityCityOfficePanel";
const flush = () => new Promise((r) => setTimeout(r, 0));
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
afterEach(() => vi.restoreAllMocks());
function setup() {
  const scene = new MainCityScene() as any; let generation = 1;
  const gateway = { getSessionGeneration: () => generation, getCityChief: vi.fn().mockResolvedValue({ city_id: 9, hero_id: 1 }), listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [{ hero_id: 1 }, { hero_id: 2 }] }), setCityChief: vi.fn().mockRejectedValue(new Error("hero: hero not available for office")), clearCityChief: vi.fn().mockRejectedValue(new Error("network timeout")) };
  const root = document.createElement("div"); root.innerHTML = '<div data-role="building-scroll"></div>';
  const panel = new MainCityCityOfficePanel({ onAppoint: (id) => void scene.appointCityChief(id), onClear: () => void scene.clearCityChief() });
  panel.mountInto(root); panel.setVisibleForHallSlot("hall"); panel.setHeroes([{ hero_id: 1 }, { hero_id: 2 }]); panel.setChiefView({ city_id: 9, hero_id: 1 });
  Object.assign(scene, { gateway, session: { serverId: 1, cityId: 9, player: { player_id: 1 } }, cityOfficePanel: panel, minimapMarches: [], renderHud: vi.fn() });
  const line = () => root.querySelector('[data-role="city-chief-current"]')!.textContent!;
  const error = () => root.querySelector('[data-role="city-chief-form-error"]')!.textContent!;
  const button = (a: string) => root.querySelector<HTMLButtonElement>(`[data-action="${a}"]`)!;
  return { scene, gateway, panel, root, line, error, button, relogin: () => { generation++; } };
}
it.each(["appointCityChief", "clearCityChief"])("%s failure rereads incumbent rather than fabricating vacancy", async (method) => {
  const s = setup(); await s.scene[method](2); expect(s.line()).toContain("#1");
  expect(s.gateway.getCityChief).toHaveBeenCalledExactlyOnceWith(1, 9); expect(s.error()).not.toBe("");
  expect(s.button("clear-chief").disabled).toBe(false);
});
it.each([0, 2])("unknown result follows authoritative hero %s", async (id) => {
  const s = setup(); s.gateway.getCityChief.mockResolvedValueOnce({ city_id: 9, hero_id: id }); await s.scene.appointCityChief(2);
  expect(s.line()).toContain(id ? "#2" : "空缺"); expect(s.gateway.setCityChief).toHaveBeenCalledTimes(1);
});
it("failed reconciliation preserves labeled last-known chief and retry reads only", async () => {
  const s = setup(); s.gateway.getCityChief.mockRejectedValueOnce(new Error("offline")); await s.scene.appointCityChief(2);
  expect(s.line()).toContain("#1"); expect(s.line()).toContain("待核实"); expect(s.error()).toContain("重新打开");
  expect(s.button("clear-chief").disabled).toBe(true); expect(s.button("appoint-chief").disabled).toBe(true);
  await s.scene.clearCityChief(); await s.scene.appointCityChief(2); expect(s.gateway.clearCityChief).not.toHaveBeenCalled(); expect(s.gateway.setCityChief).toHaveBeenCalledTimes(1);
  await s.scene.refreshCityOfficePanel(); expect(s.line()).toContain("#1"); expect(s.line()).not.toContain("待核实");
  expect(s.gateway.getCityChief).toHaveBeenCalledTimes(2); expect(s.gateway.setCityChief).toHaveBeenCalledTimes(1);
  expect(s.button("clear-chief").disabled).toBe(false);
});
it("failed initial read never presents an authoritative vacancy", async () => {
  const s = setup(); s.panel.setChiefView(null); s.gateway.getCityChief.mockRejectedValueOnce(new Error("offline")); await s.scene.refreshCityOfficePanel();
  expect(s.line()).toContain("待核实"); expect(s.line()).not.toContain("空缺"); expect(s.button("appoint-chief").disabled).toBe(true);
});
it("serializes mutations and suppresses refresh while command/recovery is pending", async () => {
  const s = setup(), mutation = deferred(), read = deferred(); s.gateway.setCityChief.mockReturnValueOnce(mutation.promise); s.gateway.getCityChief.mockReturnValueOnce(read.promise);
  const request = s.scene.appointCityChief(2); await s.scene.clearCityChief(); await s.scene.refreshCityOfficePanel(); expect(s.gateway.getCityChief).not.toHaveBeenCalled();
  mutation.reject(new Error("timeout")); await flush(); await s.scene.appointCityChief(2); await s.scene.refreshCityOfficePanel();
  expect(s.gateway.setCityChief).toHaveBeenCalledTimes(1); expect(s.gateway.clearCityChief).not.toHaveBeenCalled(); expect(s.gateway.getCityChief).toHaveBeenCalledTimes(1);
  read.resolve({ hero_id: 2 }); await request; expect(s.line()).toContain("#2");
});
it("old read cannot overwrite a newer mutation", async () => {
  const s = setup(), old = deferred(); s.gateway.getCityChief.mockReturnValueOnce(old.promise); const read = s.scene.refreshCityOfficePanel();
  s.gateway.setCityChief.mockResolvedValueOnce({ hero_id: 2 }); await s.scene.appointCityChief(2); old.resolve({ hero_id: 1 }); await read; expect(s.line()).toContain("#2");
});
it.each(["actor", "city", "relogin", "leave"])("ignores mutation failure after %s without dispatching recovery", async (change) => {
  const s = setup(), old = deferred(); s.gateway.setCityChief.mockReturnValueOnce(old.promise); const request = s.scene.appointCityChief(2);
  if (change === "actor") s.scene.session.player.player_id = 2; else if (change === "city") s.scene.session.cityId = 10; else if (change === "relogin") s.relogin(); else s.scene.marchSnapshotGeneration++;
  s.panel.setChiefView({ hero_id: 99 }); s.panel.setPhase("idle"); old.reject(new Error("old")); await request;
  expect(s.gateway.getCityChief).not.toHaveBeenCalled(); expect(s.line()).toContain("#99");
});
it.each([false, true])("old recovery cannot overwrite new actor or release its pending mutation (reject=%s)", async (reject) => {
  const s = setup(), old = deferred(), newer = deferred(); s.gateway.getCityChief.mockReturnValueOnce(old.promise); const first = s.scene.appointCityChief(2); await flush();
  s.relogin(); s.gateway.setCityChief.mockReturnValueOnce(newer.promise); const second = s.scene.appointCityChief(2);
  if (reject) old.reject(new Error("old read")); else old.resolve({ hero_id: 99 }); await first;
  expect(s.button("appoint-chief").disabled).toBe(true); expect(s.line()).not.toContain("#99");
  newer.resolve({ hero_id: 2 }); await second; expect(s.line()).toContain("#2");
});
it("successful set and clear do not add recovery requests", async () => {
  const s = setup(); s.gateway.setCityChief.mockResolvedValueOnce({ hero_id: 2 }); await s.scene.appointCityChief(2); expect(s.line()).toContain("#2");
  s.gateway.clearCityChief.mockResolvedValueOnce({}); await s.scene.clearCityChief(); expect(s.line()).toContain("空缺"); expect(s.gateway.getCityChief).not.toHaveBeenCalled();
});

it("discard superseded city context after A-B-A", async () => {
  const s = setup(), old = deferred();
  s.gateway.getCityChief.mockReturnValueOnce(old.promise);
  const first = s.scene.refreshCityOfficePanel();
  s.scene.session.cityId = 10;
  s.gateway.getCityChief.mockResolvedValueOnce({city_id: 10, hero_id: 10});
  await s.scene.refreshCityOfficePanel();
  s.scene.session.cityId = 9;
  s.gateway.getCityChief.mockResolvedValueOnce({city_id: 9, hero_id: 2});
  await s.scene.refreshCityOfficePanel();
  expect(s.line()).toContain("#2");
  old.resolve({city_id: 9, hero_id: 1}); await first;
  expect(s.line()).toContain("#2");
});
it("discard superseded city mutation after A-B-A", async () => {
  const s = setup(), old = deferred(), newer = deferred();
  s.gateway.setCityChief.mockReturnValueOnce(old.promise);
  const first = s.scene.appointCityChief(2);
  s.scene.session.cityId = 10;
  await s.scene.refreshCityOfficePanel();
  s.scene.session.cityId = 9;
  s.gateway.setCityChief.mockReturnValueOnce(newer.promise);
  const second = s.scene.appointCityChief(2);
  old.reject(new Error("old timeout")); await first;
  expect(s.gateway.getCityChief).toHaveBeenCalledTimes(1);
  expect(s.button("appoint-chief").disabled).toBe(true);
  newer.resolve({hero_id: 2}); await second;
});
