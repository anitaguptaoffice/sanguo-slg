import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes, Routes } from "@/net/loadProto";
import type { MarchSummary } from "@/net/militaryFormat";
import { writeBattleReportReplaySession } from "@/net/battleReportIntelReplayJump";
import { MarchListPanel } from "./MarchListPanel";

const types = getTypes();
const returned: MarchSummary = { march_id: 7, phase: 5, to_x: 5, to_y: 5, from_x: 60, from_y: 60,
  depart_at_ms: 1000, arrive_at_ms: 2000, return_finish_at_ms: 0, purpose: 1,
  troops: [{ unit_cfg_id: 1, count: 19, wounded: 0 }] };
const panels: MarchListPanel[] = [];
afterEach(() => {
  panels.forEach(panel => panel.detach()); panels.length = 0;
  sessionStorage.clear(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.useRealTimers();
});
function setup(initial: MarchSummary[]) {
  vi.useFakeTimers();
  let snapshot = initial;
  const gateway = new GatewayClient();
  const send = vi.spyOn(gateway as never, "sendAndWait").mockImplementation((wire: Uint8Array) => {
    expect((types.ClientPacket.decode(wire) as unknown as { route: string }).route).toBe(Routes.ListMarches);
    const data = types.ListMarchesResponse.encode(types.ListMarchesResponse.create({ marches: snapshot, total: snapshot.length })).finish();
    return Promise.resolve(Uint8Array.from(types.ServerPacket.encode({ code: 0, data }).finish()).buffer);
  });
  const mount = document.createElement("div"); document.body.append(mount);
  const reminders = vi.fn(), replay = vi.fn(), remarch = vi.fn();
  const create = () => {
    const panel = new MarchListPanel(mount, gateway, () => 1, () => {}, {
      nowMs: () => 3000, pollIntervalMs: 5000, onMarchArrivalReminders: reminders,
      onReplayBattleReportFromInfoCard: replay, onRemarchFromRow: remarch,
    });
    panels.push(panel); panel.attach(); panel.toggle(); return panel;
  };
  const panel = create();
  const click = (selector: string) => mount.querySelector<HTMLElement>(selector)!.click();
  const refresh = async () => { click('[data-action="refresh-marches"]'); await vi.advanceTimersByTimeAsync(0); };
  return { mount, panel, send, reminders, replay, remarch, create, click, refresh, set: (rows: MarchSummary[]) => { snapshot = rows; } };
}

describe("returned retained list via production GatewayClient", () => {
  it.each([2, 4])("keeps selection, phase pulse and report link on %s → 5 but stops list/countdown timers", async phase => {
    const f = setup([{ ...returned, phase, return_finish_at_ms: 10000 }]);
    await vi.advanceTimersByTimeAsync(0);
    f.click('.march-list li[data-march-id="7"]');
    writeBattleReportReplaySession({ reportId: 9, wx: 5, wy: 5 });
    f.set([returned]); await f.refresh();
    const row = f.mount.querySelector('.march-list li[data-march-id="7"]')!;
    expect(row.classList.contains("march-phase-changed")).toBe(true);
    expect(row.querySelector(".march-phase-returned")?.textContent).toBe("已回城");
    expect(f.mount.querySelector('[data-role="march-info-card-secondary"]')?.textContent).toBe("已回城 · 步兵×19");
    expect(f.panel.getSelectedMarchId()).toBe(7);
    expect(f.reminders).not.toHaveBeenCalled();
    f.click('[data-action="march-info-replay-battle-report"]');
    expect(f.replay).toHaveBeenCalledWith(expect.objectContaining({ phase: 5, march_id: 7 }), 9);
    expect(f.remarch).not.toHaveBeenCalled();
    f.click('[data-action="march-info-remarch"]');
    expect(f.remarch).toHaveBeenCalledWith(expect.objectContaining({ phase: 5, troops: returned.troops }));
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.send).toHaveBeenCalledTimes(2);
    await f.refresh(); await f.refresh();
    expect(f.panel.getSelectedMarch()?.phase).toBe(5);
    expect(f.reminders).not.toHaveBeenCalled();
    expect(f.mount.querySelector(".march-phase-changed")).toBeNull();
  });

  it("starts with returned history, preserves unknown127 and restores selected history on reattach", async () => {
    const f = setup([returned, { ...returned, march_id: 9, phase: 127 }]);
    await vi.advanceTimersByTimeAsync(0);
    f.click('.march-list li[data-march-id="7"]');
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.mount.textContent).toContain("阶段127");
    f.panel.detach();
    const reopened = f.create(); await vi.advanceTimersByTimeAsync(0);
    expect(reopened.getSelectedMarchId()).toBe(7);
    expect(reopened.getMarches().map(m => m.phase)).toEqual([5, 127]);
    expect(f.reminders).not.toHaveBeenCalled();
  });

  it("keeps genuine pending active while all/default and destination history retain5", async () => {
    const f = setup([returned, { ...returned, march_id: 8, phase: 1 }]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.send).toHaveBeenCalledTimes(2);
    f.click('[data-action="march-phase-filter-chip"][data-phase="pending"]');
    expect(f.mount.querySelectorAll('.march-list li[data-march-id]')).toHaveLength(1);
    expect(f.mount.querySelector('.march-list li')?.getAttribute("data-march-id")).toBe("8");
    f.click('[data-action="march-phase-filter-chip"][data-phase="all"]');
    f.panel.openIntelViewForGrid(5, 5);
    expect(f.mount.querySelectorAll('.march-list li[data-march-id]')).toHaveLength(2);
    f.panel.openIntelViewForGrid(99, 99);
    expect(f.mount.querySelector('.march-list')?.textContent).toContain("共 2 条行军记录");
    expect(f.mount.querySelector('.march-list')?.textContent).not.toContain("2 条进行中");
  });

  it("retains optional report_id extension replay without claiming it is in binary schema", async () => {
    const f = setup([]); await vi.advanceTimersByTimeAsync(0); f.panel.detach();
    const replay = vi.fn();
    const panel = new MarchListPanel(f.mount, { listMarches: async () => ({ marches: [{ ...returned, report_id: 31 }], total: 1 }) } as never,
      () => 1, () => {}, { onReplayBattleReportFromInfoCard: replay });
    panels.push(panel); panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
    f.click('.march-list li[data-march-id="7"]'); f.click('[data-action="march-info-replay-battle-report"]');
    expect(replay).toHaveBeenCalledWith(expect.objectContaining({ phase: 5, report_id: 31 }), 31);
  });
});
