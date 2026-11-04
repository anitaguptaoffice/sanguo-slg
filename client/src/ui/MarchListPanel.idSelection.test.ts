import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarchListPanel } from "./MarchListPanel";
import { openCenterPanel } from "./centerPanelForeground";
const cleanup: Array<() => void> = [];
const rows = [{ march_id: 1, to_x: 60, to_y: 60, phase: 2, purpose: 1 },
  { march_id: 2, to_x: 10, to_y: 20, phase: 2, purpose: 1 }];
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; });
async function setup(initial = rows) {
  let generation = 1, city = 1;
  const mount = document.createElement("div"); document.body.append(mount);
  const grid = { x: 60, y: 60 };
  const gateway = { listMarches: vi.fn().mockResolvedValue({ marches: initial, total: initial.length }),
    getSessionGeneration: () => generation, getSessionId: () => "token", getBoundServerId: () => 1 };
  const panel = new MarchListPanel(mount, gateway as never, () => city, vi.fn(), { getWorldSelectedGrid: () => grid });
  panel.attach(); panel.toggle(); cleanup.push(() => panel.detach());
  await vi.waitFor(() => expect(panel.getMarches()).toHaveLength(initial.length));
  const ids = () => Array.from(mount.querySelectorAll('li[data-march-id]')).map(el => Number(el.getAttribute("data-march-id")));
  const phase = (value: string) => mount.querySelector<HTMLButtonElement>(`[data-action="march-phase-filter-chip"][data-phase="${value}"]`)!.click();
  const refresh = async (marches = rows) => { gateway.listMarches.mockResolvedValue({ marches, total: marches.length }); await (panel as any).refreshList(); };
  return { panel, mount, gateway, grid, ids, phase, refresh, raw: panel as any,
    relogin: () => { generation++; }, changeCity: () => { city++; } };
}
it.each(["world", "manual"])("ID deep link reveals target hidden by %s destination", async mode => {
  const f = await setup(); mode === "world" ? f.panel.syncWorldGridSelection(f.grid) : f.panel.setDestFilter(60, 60);
  f.panel.selectMarchById(2, { openPanel: true });
  expect(f.panel.getSelectedMarchId()).toBe(2); expect(f.ids()).toContain(2);
  expect(f.panel.getDestFilter()).toEqual({ x: 10, y: 20 });
});
it("clears incompatible phase while preserving ETA sort and compatible destination", async () => {
  const f = await setup(); f.panel.setDestFilter(10, 20); f.raw.setListFilter({ phase: "return", etaSort: "eta_desc" });
  f.panel.selectMarchById(2, { openPanel: true });
  expect(f.ids()).toContain(2); expect(f.raw.listFilter).toEqual({ phase: "all", etaSort: "eta_desc" });
  expect(f.panel.getDestFilter()).toEqual({ x: 10, y: 20 });
});
it("compatible filters and ordinary non-opening selection keep their existing semantics", async () => {
  const f = await setup(); f.panel.setDestFilter(10, 20); f.phase("outbound");
  f.panel.selectMarchById(2, { openPanel: true }); expect(f.raw.listFilter.phase).toBe("outbound");
  f.panel.setDestFilter(60, 60); f.panel.selectMarchById(2);
  expect(f.ids()).toEqual([1]); expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 });
});
it("closed panel target appears on a later authoritative snapshot without a fabricated row", async () => {
  const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60); f.phase("return"); f.panel.toggle();
  f.panel.selectMarchById(2, { openPanel: true }); await vi.waitFor(() => expect(f.raw.listLoading).toBe(false));
  expect(f.ids()).not.toContain(2); await f.refresh();
  expect(f.panel.isOpen()).toBe(true); expect(f.ids()).toContain(2); expect(f.panel.getSelectedMarchId()).toBe(2);
});
it("minimap authoritative snapshot resolves a missing ID target", async () => {
  const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60);
  f.panel.selectMarchById(2, { openPanel: true }); await vi.waitFor(() => expect(f.raw.listLoading).toBe(false));
  f.panel.syncMinimapMarchFocusFromSnapshot(rows); expect(f.ids()).toContain(2); expect(f.panel.getSelectedMarchId()).toBe(2);
});
it.each(["destination", "phase", "sort", "typing", "row", "close", "peer", "relogin", "city", "detach"])(
  "pending target cannot override newer %s intent", async action => {
    const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60);
    f.panel.selectMarchById(2, { openPanel: true }); await vi.waitFor(() => expect(f.raw.listLoading).toBe(false));
    if (action === "destination") f.panel.setDestFilter(60, 60);
    if (action === "phase") f.phase("return");
    if (action === "sort") { const el = f.mount.querySelector<HTMLSelectElement>('[data-action="march-eta-sort"]')!; el.value = "eta_desc"; el.dispatchEvent(new Event("change", { bubbles: true })); }
    if (action === "typing") { const el = f.mount.querySelector<HTMLInputElement>('[data-field="filter-to-x"]')!; el.value = "61"; el.dispatchEvent(new Event("input", { bubbles: true })); }
    if (action === "row") f.mount.querySelector<HTMLElement>('li[data-march-id="1"]')!.click();
    if (action === "close") { f.panel.toggle(); f.panel.toggle(); }
    if (action === "peer") { const peer = document.createElement("div"); peer.dataset.centerPanel = "test"; f.mount.append(peer); openCenterPanel(peer); openCenterPanel(f.panel.getRoot()); }
    if (action === "relogin") f.relogin();
    if (action === "city") f.changeCity();
    if (action === "detach") { f.panel.detach(); f.panel.attach(); f.panel.toggle(); }
    await f.refresh(); expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 }); expect(f.ids()).not.toContain(2);
    if (action === "row") expect(f.panel.getSelectedMarchId()).toBe(1);
  },
);
it("a newer ID deep link supersedes the missing target", async () => {
  const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60);
  f.panel.selectMarchById(2, { openPanel: true }); f.panel.selectMarchById(1, { openPanel: true }); await f.refresh();
  expect(f.panel.getSelectedMarchId()).toBe(1); expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 });
});
it("a failed read can be retried without replaying any game command", async () => {
  const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60);
  f.gateway.listMarches.mockRejectedValueOnce(new Error("offline")); f.panel.selectMarchById(2, { openPanel: true });
  await vi.waitFor(() => expect(f.raw.listError).toContain("offline"));
  expect(f.ids()).not.toContain(2); await f.refresh(); expect(f.ids()).toContain(2);
});
it("successful reveal is one-shot and disappearance clears selection", async () => {
  const f = await setup(); f.panel.setDestFilter(60, 60); f.panel.selectMarchById(2, { openPanel: true });
  f.phase("outbound"); await f.refresh([rows[0], { ...rows[1], phase: 3 }]);
  expect(f.raw.listFilter.phase).toBe("outbound"); expect(f.ids()).not.toContain(2);
  await f.refresh([rows[0]]); expect(f.panel.getSelectedMarchId()).toBeNull();
});
it("null selection cancels pending reveal and unknown ID never changes filters", async () => {
  const f = await setup([rows[0]]); f.panel.setDestFilter(60, 60); f.panel.selectMarchById(999, { openPanel: true });
  await f.refresh([rows[0]]); expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 }); expect(f.ids()).not.toContain(999);
  f.panel.selectMarchById(2, { openPanel: true }); f.panel.selectMarchById(null); await f.refresh();
  expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 }); expect(f.panel.getSelectedMarchId()).toBeNull();
});
it("an unavailable world selection is replaced by the explicit target", async () => {
  const f = await setup(); f.raw.getWorldSelectedGrid = () => null; f.panel.setDestFilterMode("world");
  f.panel.selectMarchById(2, { openPanel: true }); expect(f.ids()).toContain(2); expect(f.panel.getDestFilter()).toEqual({ x: 10, y: 20 });
});
it.each(["selection", "filter", "foreground"])("selection callback's newer %s intent wins", async action => {
  const f = await setup(); f.panel.setDestFilter(60, 60); let first = true;
  f.raw.onSelectionChange = () => {
    if (!first) return; first = false;
    if (action === "selection") f.panel.selectMarchById(1, { openPanel: true });
    if (action === "filter") f.phase("return");
    if (action === "foreground") { f.panel.toggle(); f.panel.toggle(); }
  };
  f.panel.selectMarchById(2, { openPanel: true }); await f.refresh();
  expect(f.panel.getDestFilter()).toEqual({ x: 60, y: 60 }); expect(f.ids()).not.toContain(2);
  if (action === "selection") expect(f.panel.getSelectedMarchId()).toBe(1);
});
