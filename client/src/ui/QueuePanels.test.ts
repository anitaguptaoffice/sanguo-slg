import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, QueuePanels } from "@/ui/QueuePanels";

const baseSession = (): MainCitySession => ({
  serverId: 1,
  player: {},
  wallet: {},
  cityId: 1,
  cityName: "主城",
  buildings: [],
  cityTroops: [],
  bag: [],
});

describe("QueuePanels", () => {
  it("shows upgrade and recruit rows when open", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = { getCityState: vi.fn(), getBoundServerId: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 5, unit_cfg_id: 1, count: 12, finish_at_ms: now + 60_000 });
    const text = mount.querySelector('[data-role="queue-list"]')?.textContent ?? "";
    expect(text).toContain("农田");
    expect(text).toContain("步兵×12");
  });

  it("offers speedup button on build rows and disables without item", () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 }];
    const gateway = {
      getCityState: vi.fn(),
      getBoundServerId: vi.fn(() => 1),
      useConsumable: vi.fn(),
    } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    const btn = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);

    session.bag = [{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 1 }];
    panel.toggle();
    panel.toggle();
    const btn2 = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    expect(btn2.disabled).toBe(false);
  });

  it("calls UseConsumable and refreshes city state on success", async () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const finishBefore = now + 120_000;
    const finishAfter = now + 60_000;
    const session = baseSession();
    session.buildings = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: finishBefore }];
    session.bag = [{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 2 }];
    const useConsumable = vi.fn().mockResolvedValue({
      remaining: 1,
      effect_summary: "建造加速 300 秒",
      speedup_seconds: 300,
    });
    const getCityState = vi.fn().mockResolvedValue({
      buildings: [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: finishAfter }],
    });
    const gateway = {
      getCityState,
      getBoundServerId: vi.fn(() => 1),
      useConsumable,
    } as unknown as GatewayPort;
    const statuses: string[] = [];
    const panel = new QueuePanels(
      mount,
      gateway,
      () => session,
      { farm: "农田" },
      (msg) => statuses.push(msg),
      () => {},
      () => {},
    );
    panel.attach();
    panel.toggle();
    const btn = mount.querySelector('[data-action="speedup-build"]') as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => expect(useConsumable).toHaveBeenCalledWith(1, BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, 1));
    await vi.waitFor(() => expect(getCityState).toHaveBeenCalledWith(1));
    expect(session.buildings[0].upgrade_finish_at_ms).toBe(finishAfter);
    expect(session.bag).toEqual([{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity: 1 }]);
    expect(statuses.some((s) => s.includes("建造加速") || s.includes("加速"))).toBe(true);
    const panelStatus = mount.querySelector('[data-role="queue-status"]')?.textContent ?? "";
    expect(panelStatus.length).toBeGreaterThan(0);
  });
});
