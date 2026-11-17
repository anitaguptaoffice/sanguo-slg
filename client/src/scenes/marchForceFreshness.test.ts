import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { persistHeroMarchForceFromDetail } from "@/net/heroDetailForce";
const now = 1800000000000;
beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });
function setup() {
  const root = document.createElement("div"); root.dataset.centerPanel = "military";
  root.innerHTML = '<input data-field="to-x" value="10"><input data-field="to-y" value="20"><input data-field="march-count" value="30"><select data-field="march-hero"><option value="7">hero</option></select><button data-action="march"></button><p data-role="march-form-error"></p>';
  const gateway = { startMarch: vi.fn().mockResolvedValue({ march: { march_id: 9, to_x: 10, to_y: 20 }, city_troops: [{ unit_cfg_id: 1, count: 10 }] }) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { cityId: 1, cityX: 60, cityY: 60, garrisonStatus: "ready", cityTroops: [{ unit_cfg_id: 1, count: 40 }] }, gateway, militaryPanel: root,
    marchFormHeroes: [{ hero_id: 7, status: 1 }], marchLocalBusyHeroIds: new Set(), cityStateFetch: { clear: vi.fn() },
    renderHud: vi.fn(), marchArrivalPoll: { trackMarch: vi.fn() }, marchList: { notifyMarchStarted: vi.fn(), getSelectedMarch: () => null },
    refreshMinimapMarches: vi.fn().mockResolvedValue(undefined), refreshState: vi.fn().mockResolvedValue(undefined) });
  persistHeroMarchForceFromDetail({ hero_id: 7, level: 1, march_force: 9, march_force_max: 24 });
  return { scene, gateway, root, button: () => root.querySelector<HTMLButtonElement>('[data-action="march"]')! };
}
it("releases the real button and submit gate when low stamina cache expires", async () => {
  const f = setup(); f.scene.syncMilitaryPanel(); expect(f.button().disabled).toBe(true);
  await f.scene.startMarch(); expect(f.gateway.startMarch).not.toHaveBeenCalled();
  vi.setSystemTime(now + 180000); f.scene.syncMilitaryPanel(); expect(f.button().disabled).toBe(false);
  await f.scene.startMarch(); expect(f.gateway.startMarch).toHaveBeenCalledWith(1, 10, 20, 1, 7, [{ unit_cfg_id: 1, count: 30 }]);
  expect(f.scene.lastMarch?.march_id).toBe(9);
});
it("expiry allows server validation, not a fabricated successful march", async () => {
  const f = setup(); f.gateway.startMarch.mockRejectedValueOnce(new Error("insufficient march force"));
  vi.setSystemTime(now + 86400000); await f.scene.startMarch();
  expect(f.gateway.startMarch).toHaveBeenCalledTimes(1); expect(f.scene.lastMarch).toBeNull();
  expect(f.scene.status).toContain("体力不足"); expect(f.scene.marchArrivalPoll.trackMarch).not.toHaveBeenCalled();
});
