import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { QueuePanels } from "@/ui/QueuePanels";

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
    const gateway = { getCityState: vi.fn() } as unknown as GatewayPort;
    const panel = new QueuePanels(mount, gateway, () => session, { farm: "农田" }, () => {}, () => {}, () => {});
    panel.attach();
    panel.toggle();
    panel.addRecruitEntry({ queue_id: 5, unit_cfg_id: 1, count: 12, finish_at_ms: now + 60_000 });
    const text = mount.querySelector('[data-role="queue-list"]')?.textContent ?? "";
    expect(text).toContain("农田");
    expect(text).toContain("步兵×12");
  });
});
