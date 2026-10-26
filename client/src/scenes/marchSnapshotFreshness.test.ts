import { afterEach, describe, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { MarchListPanel } from "@/ui/MarchListPanel";
import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
import { countIntelInProgressMarches } from "@/net/hudMilitaryTodoSweep";

const returned = { march_id: 7, phase: 5, to_x: 5, to_y: 5, hero_id: 11, return_finish_at_ms: 0 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const panels: MarchListPanel[] = [];
afterEach(() => { panels.forEach(p => p.detach()); panels.length = 0; document.body.replaceChildren(); sessionStorage.clear(); vi.useRealTimers(); });
async function harness() {
  vi.useFakeTimers();
  let token = "session-a", generation = 1;
  const gateway = { listMarches: vi.fn().mockResolvedValue({ marches: [{ ...returned, phase: 4 }], total: 1 }),
    getSessionId: () => token, getSessionGeneration: () => generation };
  const mount = document.createElement("div"); document.body.append(mount);
  const scene = new MainCityScene() as unknown as Record<string, any>;
  const reminders = vi.fn();
  const panel = new MarchListPanel(mount, gateway as never, () => scene.session.cityId, () => {}, {
    onMarchesUpdated: rows => scene.applyMarchesSnapshot(rows), onMarchArrivalReminders: reminders,
  });
  const militaryPanel = document.createElement("div");
  militaryPanel.innerHTML = '<p data-role="march"></p><div data-role="march-form-readonly-strip"><p data-role="march-form-readonly-strip-line"></p></div>';
  Object.assign(scene, { session: { cityId: 31 }, lastMarch: { ...returned, phase: 2 }, marchList: panel, gateway,
    militaryPanel, activeDomesticSlotKey: "hall", cityOfficePanel: { setMarchingHeroIds: vi.fn() },
    hud: document.createElement("div"), renderHud: vi.fn(), world: { refreshMarchDestCounts: vi.fn(), detach: vi.fn() } });
  panels.push(panel); panel.attach(); panel.toggle(); await vi.advanceTimersByTimeAsync(0);
  mount.querySelector<HTMLElement>('.march-list li[data-march-id="7"]')!.click(); panel.toggle();
  return { scene, panel, gateway, militaryPanel, reminders, relogin() { token = "session-b"; generation++; } };
}

describe("authoritative march snapshot reconciliation and freshness", () => {
  it("updates real military readouts, full panel/world snapshot and local chief busy evidence", async () => {
    const f = await harness(); f.gateway.listMarches.mockResolvedValue({ marches: [returned], total: 1 });
    await f.scene.refreshMinimapMarches();
    expect(f.militaryPanel.querySelector('[data-role="march"]')?.textContent).toContain("已回城");
    expect(f.militaryPanel.querySelector('[data-role="march-form-readonly-strip-line"]')?.textContent).toContain("已回城");
    expect(f.militaryPanel.textContent).not.toMatch(/即将|预计|剩余/);
    expect(f.panel.getSelectedMarch()?.phase).toBe(5);
    expect(countIntelInProgressMarches(f.panel.getMarches())).toBe(0);
    expect(f.scene.cityOfficePanel.setMarchingHeroIds).toHaveBeenLastCalledWith(new Set());
    expect(f.scene.renderHud).toHaveBeenCalled();
  });

  it.each([3, 4])("preserves legitimate2→%s arrival reminders before the panel rereads", async phase => {
    const f = await harness();
    for (const next of [2, phase, phase, 5]) {
      f.gateway.listMarches.mockResolvedValue({ marches: [{ ...returned, phase: next }], total: 1 });
      await f.scene.refreshMinimapMarches();
    }
    expect(f.reminders).toHaveBeenCalledTimes(1);
    expect(f.reminders).toHaveBeenCalledWith([expect.objectContaining({ marchId: 7, kind: "phase" })]);
    f.panel.toggle(); await vi.advanceTimersByTimeAsync(0);
    expect(f.reminders).toHaveBeenCalledTimes(1);
  });

  it.each(["panel", "background"])("does not accept an older %s response after newer returned snapshot", async older => {
    const f = await harness(), late = deferred<unknown>();
    f.gateway.listMarches.mockImplementationOnce(() => late.promise).mockResolvedValue({ marches: [returned], total: 1 });
    let old: Promise<void> | undefined;
    if (older === "background") old = f.scene.refreshMinimapMarches(); else f.panel.toggle();
    if (older === "background") { f.panel.toggle(); await vi.advanceTimersByTimeAsync(0); }
    else await f.scene.refreshMinimapMarches();
    late.resolve({ marches: [{ ...returned, phase: 4 }], total: 1 });
    if (old) await old; await vi.advanceTimersByTimeAsync(0);
    expect(f.scene.lastMarch.phase).toBe(5); expect(f.scene.minimapMarches[0].phase).toBe(5);
    expect(f.panel.getSelectedMarch()?.phase).toBe(5);
  });

  it("applies an older slow successful snapshot until a newer response actually arrives", async () => {
    const f = await harness(), first = deferred<unknown>(), second = deferred<unknown>();
    f.gateway.listMarches.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const one = f.scene.refreshMinimapMarches(), two = f.scene.refreshMinimapMarches();
    first.resolve({ marches: [returned], total: 1 }); await one;
    expect(f.scene.lastMarch.phase).toBe(5);
    second.resolve({ marches: [{ ...returned, phase: 1 }], total: 1 }); await two;
    expect(f.scene.lastMarch.phase).toBe(1);
  });

  it("lets a newer pending panel response replace an earlier applied background snapshot", async () => {
    const f = await harness(), first = deferred<unknown>(), second = deferred<unknown>();
    f.gateway.listMarches.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const background = f.scene.refreshMinimapMarches(); f.panel.toggle();
    first.resolve({ marches: [{ ...returned, phase: 1 }], total: 1 }); await background;
    expect(f.scene.lastMarch.phase).toBe(1);
    second.resolve({ marches: [returned], total: 1 }); await vi.advanceTimersByTimeAsync(0);
    expect(f.scene.lastMarch.phase).toBe(5); expect(f.panel.getSelectedMarch()?.phase).toBe(5);
  });

  it.each(["leave", "relogin"])("ignores background replies after %s", async action => {
    const f = await harness(), late = deferred<unknown>();
    f.gateway.listMarches.mockImplementationOnce(() => late.promise);
    const request = f.scene.refreshMinimapMarches();
    if (action === "leave") f.scene.leave(); else f.relogin();
    late.resolve({ marches: [returned], total: 1 }); await request;
    expect(f.scene.lastMarch.phase).toBe(4);
  });

  it("accepts current pending/unknown rows after5, and never infers completion from absence", async () => {
    const f = await harness();
    for (const phase of [5, 1, 127]) {
      f.gateway.listMarches.mockResolvedValue({ marches: [{ ...returned, phase }], total: 1 });
      await f.scene.refreshMinimapMarches(); expect(f.scene.lastMarch.phase).toBe(phase);
    }
    f.gateway.listMarches.mockResolvedValue({ marches: [], total: 0 }); await f.scene.refreshMinimapMarches();
    expect(f.scene.lastMarch.phase).toBe(127);
  });
});

describe("arrival tracking request lifecycle", () => {
  it("rejects a reply for a different city without requiring reset", async () => {
    let city = 31; const late = deferred<any[]>();
    const poll = new MarchArrivalPoll({ listMarches: () => late.promise, getCityId: () => city, onCompletions: vi.fn() });
    const old = poll.pollOnce(); city = 32; late.resolve([{ ...returned, phase: 4 }]); await old;
    expect(poll.needsPoll()).toBe(false);
  });
  it("applies a slow successful read even while another poll is in flight", async () => {
    const first = deferred<any[]>(), second = deferred<any[]>();
    const listMarches = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const poll = new MarchArrivalPoll({ listMarches, getCityId: () => 31, onCompletions: vi.fn() });
    const one = poll.pollOnce(), two = poll.pollOnce();
    first.resolve([{ ...returned, phase: 4 }]); await one; expect(poll.needsPoll()).toBe(true);
    second.resolve([returned]); await two; expect(poll.needsPoll()).toBe(false);
  });
  it.each(["newer-returned", "reset"])("rejects late phase4 after %s", async action => {
    const late = deferred<any[]>(), callbacks = vi.fn();
    const listMarches = vi.fn().mockImplementationOnce(() => late.promise).mockResolvedValue([returned]);
    const poll = new MarchArrivalPoll({ listMarches, getCityId: () => 31, onCompletions: callbacks });
    poll.trackMarch(7, { ...returned, phase: 4 }); const old = poll.pollOnce();
    if (action === "reset") poll.reset(); else await poll.pollOnce();
    late.resolve([{ ...returned, phase: 4 }]); await old;
    expect(poll.needsPoll()).toBe(false); expect(callbacks).not.toHaveBeenCalled();
  });
});
