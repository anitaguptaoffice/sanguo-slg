import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { readMarchFormSnapshot, formatMarchFormSummary, syncMarchFormInlineFeedback } from "@/net/marchFormSummary";
import { buildMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";
const ownedHeroes = [{ hero_id: 7, status: 1 }];
function setup(unit: number, available = 40) {
  const root = document.createElement("div"); root.dataset.centerPanel = "military";
  root.innerHTML = '<input data-field="to-x" value="10"><input data-field="to-y" value="20"><input data-field="march-count" value="30"><select data-field="march-hero"><option value="7">hero</option></select><select data-field="march-unit"><option value="1">步兵</option><option value="2">骑兵</option><option value="3">弓兵</option><option value="4">器械</option></select><p data-role="march-form-error"></p><p data-role="march-form-summary"></p>';
  root.querySelector<HTMLSelectElement>('[data-field="march-unit"]')!.value = String(unit);
  const cityTroops = [1, 2, 3, 4].map((id) => ({ unit_cfg_id: id, count: id === unit ? available : 100 }));
  const session = { cityId: 1, cityX: 60, cityY: 60, garrisonStatus: "ready", cityTroops };
  const gateway = { startMarch: vi.fn().mockResolvedValue({ march: { march_id: 9, to_x: 10, to_y: 20 }, city_troops: [{ unit_cfg_id: unit, count: available - 30 }] }) };
  // Exercise the actual production submit method; stub only surrounding scene rendering/polling.
  const scene = Object.assign(Object.create(MainCityScene.prototype), { session, gateway, militaryPanel: root,
    marchFormHeroes: ownedHeroes, marchLocalBusyHeroIds: new Set(), cityStateFetch: { clear: vi.fn() }, marchSubmitState: "idle",
    renderHud: vi.fn(), syncMilitaryPanel: vi.fn(), marchArrivalPoll: { trackMarch: vi.fn() }, marchList: { notifyMarchStarted: vi.fn() },
    refreshMinimapMarches: vi.fn().mockResolvedValue(undefined), refreshState: vi.fn().mockResolvedValue(undefined) });
  return { root, scene, session, gateway, cityTroops };
}
beforeEach(() => sessionStorage.clear());
describe("selected existing unit march flow", () => {
  it.each([2, 3, 4])("submits selected unit %s and reconciles only its stock", async (unit) => {
    const s = setup(unit); await s.scene.startMarch();
    expect(s.gateway.startMarch).toHaveBeenCalledWith(1, 10, 20, 1, 7, [{ unit_cfg_id: unit, count: 30 }]);
    expect(s.session.cityTroops.find((t) => t.unit_cfg_id === unit)?.count).toBe(10);
    expect(s.session.cityTroops.find((t) => t.unit_cfg_id === 1)?.count).toBe(100);
  });
  it.each([1, 2, 3, 4])("checks unit %s stock rather than borrowing another type", async (unit) => {
    const s = setup(unit, 29); await s.scene.startMarch(); expect(s.gateway.startMarch).not.toHaveBeenCalled();
    expect(s.root.querySelector('[data-role="march-form-error"]')!.textContent).toContain("当前 29");
  });
  it.each([2, 3, 4])("non-infantry unit %s can depart with no infantry stock", async (unit) => {
    const s = setup(unit, 30); s.session.cityTroops = [{ unit_cfg_id: unit, count: 30 }]; await s.scene.startMarch();
    expect(s.gateway.startMarch).toHaveBeenCalledWith(1, 10, 20, 1, 7, [{ unit_cfg_id: unit, count: 30 }]);
    expect(s.session.cityTroops).toEqual([]);
  });
  it.each([0, 99])("rejects invalid unit %s before RPC", async (unit) => {
    const s = setup(unit); await s.scene.startMarch(); expect(s.gateway.startMarch).not.toHaveBeenCalled();
    expect(s.root.textContent).toContain("请选择有效的出征兵种");
  });
  it("defaults missing legacy selector to infantry", async () => {
    const s = setup(1); s.root.querySelector('[data-field="march-unit"]')!.remove(); await s.scene.startMarch();
    expect(s.gateway.startMarch).toHaveBeenCalledWith(1, 10, 20, 1, 7, [{ unit_cfg_id: 1, count: 30 }]);
  });
  it.each([[1, "步兵", 30], [2, "骑兵", 60], [3, "弓兵", 30], [4, "器械", 180]])("unit %s summary/reserve/feedback share selected stock", (unit, name, food) => {
    const s = setup(unit, 29), snap = readMarchFormSnapshot(s.root, { cityX: 60, cityY: 60, wallet: { food: 1000 } });
    expect(snap.unitCfgId).toBe(unit); const summary = formatMarchFormSummary(snap, 0);
    expect(summary.summaryLine).toContain(`${name}×30`); expect(summary.estimatedFoodCost).toBe(food);
    const reserve = buildMarchFormTroopReserveLine(snap.marchCountRaw, s.cityTroops, snap.unitCfgId);
    expect(reserve?.line).toContain(name); expect(reserve?.available).toBe(29); expect(reserve?.insufficient).toBe(true);
    syncMarchFormInlineFeedback(s.root, { cityX: 60, cityY: 60, cityTroops: s.cityTroops, ownedHeroes, clockMs: 0 });
    expect(s.root.querySelector('[data-role="march-form-error"]')!.textContent).toContain("当前 29");
    expect(s.root.querySelector('[data-role="march-form-summary"]')!.textContent).toContain(`${name}×30`);
  });
  it("switch input triggers existing feedback without changing target or quantity", () => {
    const s = setup(2), select = s.root.querySelector('[data-field="march-unit"]')!;
    select.addEventListener("change", (ev) => s.scene.onMilitaryFormInput(ev)); select.dispatchEvent(new Event("change"));
    expect(s.scene.syncMilitaryPanel).toHaveBeenCalledTimes(1);
    expect(readMarchFormSnapshot(s.root)).toMatchObject({ unitCfgId: 2, toXRaw: "10", toYRaw: "20", marchCountRaw: "30" });
  });
  it("actual production markup exposes exactly the existing four units", () => {
    const source = readFileSync("src/scenes/MainCityScene.ts", "utf8");
    const markup = source.match(/this\.militaryPanel\.innerHTML = `([\s\S]*?)`;/)![1];
    const root = document.createElement("div"); root.innerHTML = markup;
    const select = root.querySelector<HTMLSelectElement>('[data-field="march-unit"]')!;
    expect([...select.options].map((o) => o.value)).toEqual(["1", "2", "3", "4"]); expect(select.value).toBe("1");
    expect(select.getAttribute("aria-label")).toBe("出征兵种");
  });

  it("production panel sync uses selected stock for button, reserve and summary", () => {
    const s = setup(2, 29); s.root.insertAdjacentHTML("beforeend", '<button data-action="march"></button><button data-role="march-form-troop-reserve-line"></button>');
    s.scene.marchList.getSelectedMarch = () => null; s.scene.marchClockMs = 0;
    const sync = () => Object.getPrototypeOf(s.scene).syncMilitaryPanel.call(s.scene);
    sync(); expect(s.root.querySelector<HTMLButtonElement>('[data-action="march"]')!.disabled).toBe(true);
    expect(s.root.querySelector('[data-role="march-form-troop-reserve-line"]')!.textContent).toContain("骑兵 已选 30 / 城内可用 29");
    s.root.querySelector<HTMLSelectElement>('[data-field="march-unit"]')!.value = "1"; sync();
    expect(s.root.querySelector<HTMLButtonElement>('[data-action="march"]')!.disabled).toBe(false);
    expect(s.root.querySelector('[data-role="march-form-summary"]')!.textContent).toContain("步兵×30");
  });

  it("unit selection immediately redraws HUD readiness in both directions", () => {
    const s = setup(2, 29), select = s.root.querySelector<HTMLSelectElement>('[data-field="march-unit"]')!;
    s.scene.minimapMarches = []; s.scene.hudTodoBadgePoll = { getDeepLinkSnapshot: () => ({ battleReportUnread: 0 }) };
    const hud = document.createElement("span");
    s.scene.renderHud = () => { hud.textContent = String(s.scene.hudMilitaryTodoSweepCounts().marchSubmittable); };
    select.value = "1"; s.scene.renderHud(); expect(hud.textContent).toBe("1");
    select.addEventListener("change", (ev) => s.scene.onMilitaryFormInput(ev));
    select.value = "2"; select.dispatchEvent(new Event("change")); expect(hud.textContent).toBe("0");
    select.value = "1"; select.dispatchEvent(new Event("change")); expect(hud.textContent).toBe("1");
  });

});
