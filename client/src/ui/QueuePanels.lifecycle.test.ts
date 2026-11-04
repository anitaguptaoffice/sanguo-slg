import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { QueuePanels } from "./QueuePanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() { let resolve!: (value: unknown) => void, reject!: (e: Error) => void; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
const session = (player = 1, city = 1): MainCitySession => ({ serverId: 1, player: { player_id: player }, cityId: city, cityName: "city", buildings: [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: Date.now() + 120000 }], wallet: { gold: 10, food: 10 }, bag: [{ item_cfg_id: 2003, quantity: 5 }], cityTroops: [] });
function setup() {
  let current = session(), generation = 1; const mount = document.createElement("div"), status = vi.fn(), after = vi.fn(), military = vi.fn();
  const gateway = { getBoundServerId: () => current.serverId, getSessionGeneration: () => generation, useConsumable: vi.fn().mockResolvedValue({ remaining: 4 }), getCityState: vi.fn().mockResolvedValue({ wallet: { food: 20, gold: 0 } }) };
  const panel = new QueuePanels(mount, gateway as unknown as GatewayPort, () => current, { farm: "farm" }, status, after, military); panel.attach(); panel.open();
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  return { panel, mount, gateway, status, after, military, button, current: () => current, switchActor: () => { current = session(2, 2); generation++; }, relogin: () => { generation++; }, switchCity: () => { current.cityId = 2; } };
}
describe("queue actor lifecycle", () => {
  it("does not apply an old speedup result to the new player bag or fetch their city", async () => {
    const s = setup(); try {
      const pending = deferred(); s.gateway.useConsumable.mockReturnValueOnce(pending.promise); s.button("speedup-build").click(); s.switchActor(); s.status.mockClear();
      pending.resolve({ remaining: 1 }); await flush(); expect(s.current().bag[0].quantity).toBe(5); expect(s.gateway.getCityState).not.toHaveBeenCalled(); expect(s.status).not.toHaveBeenCalled();
    } finally { s.panel.detach(); }
  });
  it("only applies the newest overlapping city refresh", async () => {
    const s = setup(); try {
      const pending = deferred(); s.gateway.getCityState.mockReturnValueOnce(pending.promise); s.button("refresh-queue").click(); s.button("refresh-queue").click(); await flush();
      pending.resolve({ wallet: { food: 1, gold: 0 } }); await flush(); expect(s.current().wallet.food).toBe(20); expect(s.after).toHaveBeenCalledTimes(1);
    } finally { s.panel.detach(); }
  });
  it("does not replace refresh failure with a success message", async () => {
    const s = setup(); try {
      s.gateway.getCityState.mockRejectedValueOnce(new Error("offline")); s.button("refresh-queue").click(); await flush();
      expect(s.mount.querySelector('[data-role="queue-status"]')!.textContent).not.toContain("已刷新内政状态"); expect(s.after).not.toHaveBeenCalled();
    } finally { s.panel.detach(); }
  });  it.each(["actor", "relogin", "city", "remount"])("ignores old speedup success/error after %s", async (change) => {
    for (const reject of [false, true]) {
      const s = setup(); try {
        const pending = deferred(); s.gateway.useConsumable.mockReturnValueOnce(pending.promise); s.button("speedup-build").click();
        if (change === "actor") s.switchActor();
        if (change === "relogin") s.relogin();
        if (change === "city") s.switchCity();
        if (change === "remount") { s.panel.detach(); s.panel.attach(); s.panel.open(); }
        s.status.mockClear();
        if (reject) pending.reject(new Error("old failure")); else pending.resolve({ remaining: 1 }); await flush();
        expect(s.current().bag[0].quantity).toBe(5); expect(s.gateway.getCityState).not.toHaveBeenCalled(); expect(s.status).not.toHaveBeenCalled();
      } finally { s.panel.detach(); }
    }
  });
  it("does not unlock a new actor's pending speedup when the old operation finishes", async () => {
    const s = setup(); try {
      const old = deferred(), fresh = deferred(); s.gateway.useConsumable.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
      s.button("speedup-build").click(); s.switchActor(); s.panel.open(); s.button("speedup-build").click(); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(2);
      old.resolve({ remaining: 1 }); await flush(); expect(s.button("speedup-build").disabled).toBe(true); expect(s.current().bag[0].quantity).toBe(5);
      fresh.resolve({ remaining: 4 }); await flush(); expect(s.current().bag[0].quantity).toBe(4); expect(s.gateway.getCityState).toHaveBeenCalledExactlyOnceWith(2); expect(s.button("speedup-build").disabled).toBe(false);
    } finally { s.panel.detach(); }
  });
  it("coalesces repeated speedup clicks and permits another after completion", async () => {
    const s = setup(); try {
      const pending = deferred(); s.gateway.useConsumable.mockReturnValueOnce(pending.promise); s.button("speedup-build").click();
      s.button("speedup-build").dispatchEvent(new MouseEvent("click", { bubbles: true })); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
      pending.resolve({ remaining: 4 }); await flush(); s.button("speedup-build").click(); await flush(); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(2);
    } finally { s.panel.detach(); }
  });
  it("shows current speedup failure, preserves bag, and allows explicit retry", async () => {
    const s = setup(); try {
      s.gateway.useConsumable.mockRejectedValueOnce(new Error("failed now")); s.button("speedup-build").click(); await flush();
      expect(s.current().bag[0].quantity).toBe(5); expect(s.gateway.getCityState).not.toHaveBeenCalled(); expect(s.button("speedup-build").disabled).toBe(false);
      expect(s.status.mock.calls.flat().join(" ")).toContain("failed now"); s.button("speedup-build").click(); await flush(); expect(s.current().bag[0].quantity).toBe(4);
    } finally { s.panel.detach(); }
  });
  it.each(["actor", "relogin", "city", "remount"])("rejects old city state after %s", async (change) => {
    const s = setup(); try {
      const pending = deferred(); s.gateway.getCityState.mockReturnValueOnce(pending.promise); s.button("refresh-queue").click();
      if (change === "actor") s.switchActor();
      if (change === "relogin") s.relogin();
      if (change === "city") s.switchCity();
      if (change === "remount") { s.panel.detach(); s.panel.attach(); s.panel.open(); }
      pending.resolve({ wallet: { food: 1, gold: 0 }, production_rates: { food: 99 }, buildings: [] }); await flush();
      expect(s.current().wallet.food).toBe(10); expect(s.current().buildings).toHaveLength(1); expect(s.current().productionRates).toBeUndefined(); expect(s.after).not.toHaveBeenCalled();
    } finally { s.panel.detach(); }
  });
  it("keeps a newer refresh loading when the older refresh fails", async () => {
    const s = setup(); try {
      const old = deferred(), fresh = deferred(); s.gateway.getCityState.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
      s.button("refresh-queue").click(); s.button("refresh-queue").click(); old.reject(new Error("old offline")); await flush();
      expect(s.mount.querySelector('[data-role="queue-build-list"]')!.textContent).not.toContain("old offline"); expect(s.after).not.toHaveBeenCalled();
      expect(s.mount.querySelector('[data-role="queue-build-list"] [data-panel-state="loading"]')).not.toBeNull();
      fresh.resolve({ wallet: { food: 25, gold: 0 } }); await flush(); expect(s.current().wallet.food).toBe(25); expect(s.after).toHaveBeenCalledTimes(1);
      expect(s.mount.querySelector('[data-role="queue-status"]')!.textContent).toBe("已刷新内政状态");
    } finally { s.panel.detach(); }
  });
  it("does not replay an already successful speedup when its state refresh fails", async () => {
    const s = setup(); try {
      s.gateway.getCityState.mockRejectedValueOnce(new Error("read offline")); s.button("speedup-build").click(); await flush();
      expect(s.current().bag[0].quantity).toBe(4); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
      s.button("refresh-queue").click(); await flush(); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1); expect(s.current().wallet.food).toBe(20);
    } finally { s.panel.detach(); }
  });
});
describe("queue stale loading ownership", () => {
  it.each(["actor", "relogin", "city"])("releases obsolete loading after %s without a replacement read", async (change) => {
    const s = setup(); try {
      const pending = deferred(); s.gateway.getCityState.mockReturnValueOnce(pending.promise); s.button("refresh-queue").click();
      if (change === "actor") s.switchActor(); else if (change === "relogin") s.relogin(); else s.switchCity();
      s.panel.open(); pending.resolve({ wallet: { food: 30, gold: 0 } }); await flush(); s.panel.tick(1);
      expect(s.current().wallet.food).toBe(10); expect(s.mount.querySelector('[data-panel-state="loading"]')).toBeNull(); expect(s.button("speedup-build")).not.toBeNull();
    } finally { s.panel.detach(); }
  });
  it("clears an old actor's read error when rendering the new actor", async () => {
    const s = setup(); try {
      s.gateway.getCityState.mockRejectedValueOnce(new Error("old actor error")); s.button("refresh-queue").click(); await flush();
      s.switchActor(); s.panel.open(); expect(s.button("speedup-build")).not.toBeNull(); expect(s.mount.querySelector('[data-role="queue-build-list"]')!.textContent).not.toContain("old actor error");
    } finally { s.panel.detach(); }
  });
});
it("stops the recruit completion loop when its awaited read loses its actor", async () => {
  const s = setup(); try {
    const pending = deferred(); s.gateway.getCityState.mockReturnValueOnce(pending.promise);
    s.panel.addRecruitEntry({ queue_id: 1, unit_cfg_id: 1, count: 10, finish_at_ms: Date.now() - 1000 });
    s.panel.addRecruitEntry({ queue_id: 2, unit_cfg_id: 1, count: 10, finish_at_ms: Date.now() - 1000 });
    s.panel.tick(1); expect(s.military).toHaveBeenCalledTimes(1);
    s.relogin(); pending.resolve({}); await flush();
    expect(s.military).toHaveBeenCalledTimes(1); expect(s.gateway.getCityState).toHaveBeenCalledTimes(1); expect(s.status).toHaveBeenCalledTimes(1);
  } finally { s.panel.detach(); }
});
