import { afterEach, beforeEach, expect, it } from "vitest";
import { MarchListPanel } from "./MarchListPanel";
import { openCenterPanel } from "./centerPanelForeground";
import { GatewayClient } from "@/net/GatewayClient";
import { getProtoRoot } from "@/net/loadProto";
import { readMilitaryListFilterSession } from "@/net/militaryListFilter";
import type { MarchSummary } from "@/net/militaryFormat";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const cleanup: Array<() => void> = [];
const oldMarch = { march_id: 1, origin_city_id: 1, to_x: 10, to_y: 20, phase: 4, purpose: 1 };
const newMarch = { march_id: 2, origin_city_id: 1, to_x: 30, to_y: 40, phase: 2, purpose: 1 };
const both = [oldMarch, newMarch];
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); document.body.replaceChildren(); });
async function setup() {
  const root = getProtoRoot(), cp = root.lookupType("sanguo.common.v1.ClientPacket"), sp = root.lookupType("sanguo.common.v1.ServerPacket");
  const queue: Array<{ route: string; trace_id: string }> = [], sent: string[] = [], delivered: string[] = [];
  const ws = Object.assign(new EventTarget(), { readyState: WebSocket.OPEN, send(packet: Uint8Array) {
    const req = cp.decode(packet) as unknown as { route: string; trace_id: string };
    queue.push(req); sent.push(req.route);
  }, close() {} });
  const gateway = new GatewayClient();
  Object.assign(gateway, { ws, sessionId: "fixture-session", boundServerId: 1, sessionGeneration: 1 });
  let city = 1, grid: { x: number; y: number } | null = { x: 10, y: 20 };
  const mount = document.createElement("div"); document.body.append(mount);
  const panel = new MarchListPanel(mount, gateway, () => city, () => {}, { getWorldSelectedGrid: () => grid });
  panel.attach(); cleanup.push(() => { panel.detach(); gateway.close(); });
  const reply = async (route: string, typeName: string, value: object, code = 0) => {
    const req = queue.shift(); expect(req?.route).toBe(route); delivered.push(route);
    const type = root.lookupType(typeName), data = type.encode(type.fromObject(value)).finish();
    const bytes = sp.encode(sp.fromObject({ trace_id: req!.trace_id, code, data, message: "fixture failure" })).finish();
    ws.dispatchEvent(new MessageEvent("message", { data: Uint8Array.from(bytes).buffer })); await flush();
  };
  const listReply = (marches: MarchSummary[] = both, code = 0) => reply("military.v1.ListMarches", "sanguo.military.v1.ListMarchesResponse", { marches, total: marches.length }, code);
  const ids = () => Array.from(panel.getRoot().querySelectorAll("li[data-march-id]")).map(el => Number(el.getAttribute("data-march-id")));
  const phase = (value: string) => panel.getRoot().querySelector<HTMLButtonElement>(`[data-phase="${value}"]`)!.click();
  const sort = () => { const el = panel.getRoot().querySelector<HTMLSelectElement>('[data-action="march-eta-sort"]')!; el.value = "eta_desc"; el.dispatchEvent(new Event("change", { bubbles: true })); };
  const refresh = () => panel.getRoot().querySelector<HTMLButtonElement>('[data-action="refresh-marches"]')!.click();
  const depart = async (openPanel = true) => {
    const military = document.createElement("div"); military.className = "military-panel hidden"; mount.append(military); openCenterPanel(military);
    const request = gateway.startMarch(1, 30, 40, 1, 7, [{ unit_cfg_id: 1, count: 10 }]);
    await reply("military.v1.StartMarch", "sanguo.military.v1.StartMarchResponse", { march: newMarch });
    const res = await request as { march: MarchSummary };
    panel.notifyMarchStarted(res.march.march_id, { march: res.march, toX: 30, toY: 40, openPanel });
    return military;
  };
  panel.toggle(); await listReply([oldMarch]);
  return { panel, gateway, mount, queue, sent, delivered, ids, phase, sort, refresh, depart, listReply,
    changeCity: () => { city = 2; }, clearWorld: () => { grid = null; } };
}

it.each(["return", "manual", "world", "missing-world"])("reveals confirmed new march through %s filter", async mode => {
  const f = await setup(); f.sort();
  if (mode === "return") f.phase("return");
  if (mode === "manual") f.panel.setDestFilter(10, 20);
  if (mode === "world" || mode === "missing-world") { if (mode === "missing-world") f.clearWorld(); f.panel.setDestFilterMode("world"); }
  await f.depart(); await f.listReply();
  expect(f.panel.isOpen()).toBe(true); expect(f.panel.getSelectedMarchId()).toBe(2); expect(f.ids()).toContain(2);
  expect(f.panel.getRoot().querySelector('li.march-row-recent[data-march-id="2"]')).not.toBeNull();
  expect(readMilitaryListFilterSession().etaSort).toBe("eta_desc");
  expect(f.delivered).toEqual(f.sent); expect(f.sent.filter(r => r === "military.v1.StartMarch")).toHaveLength(1);
});

it("preserves compatible destination and phase and reveals only once", async () => {
  const f = await setup(); f.panel.setDestFilter(30, 40); f.phase("outbound"); f.sort();
  await f.depart(); await f.listReply(); expect(f.ids()).toEqual([2]);
  expect(f.panel.getDestFilter()).toEqual({ x: 30, y: 40 });
  expect(readMilitaryListFilterSession()).toEqual({ phase: "outbound", etaSort: "eta_desc" });
  f.refresh(); await f.listReply([oldMarch, { ...newMarch, phase: 4 }]);
  expect(f.ids()).toEqual([]); expect(readMilitaryListFilterSession().phase).toBe("outbound");
});

it.each(["later-read", "minimap", "failed-read"])("waits for authoritative target after %s without repeating StartMarch", async kind => {
  const f = await setup(); f.panel.setDestFilter(10, 20); f.phase("return");
  await f.depart(); await f.listReply([oldMarch], kind === "failed-read" ? 10002 : 0); expect(f.ids()).not.toContain(2);
  if (kind === "minimap") f.panel.syncMinimapMarchFocusFromSnapshot(both);
  else { f.refresh(); await f.listReply(); }
  expect(f.ids()).toContain(2); expect(f.panel.getSelectedMarch()?.march_id).toBe(2);
  expect(f.sent.filter(r => r === "military.v1.StartMarch")).toHaveLength(1);
});

it.each(["phase", "destination", "sort", "typing", "row", "id", "close", "peer", "relogin", "city", "remount"])(
  "does not override newer %s intent during the handoff read", async action => {
    const f = await setup(); f.panel.setDestFilter(10, 20); f.phase("return"); await f.depart();
    if (action === "phase") f.phase("return");
    if (action === "destination") f.panel.setDestFilter(10, 20);
    if (action === "sort") f.sort();
    if (action === "typing") { const el = f.panel.getRoot().querySelector<HTMLInputElement>('[data-field="filter-to-x"]')!; el.value = "11"; el.dispatchEvent(new Event("input", { bubbles: true })); }
    if (action === "row") f.panel.getRoot().querySelector<HTMLElement>('li[data-march-id="1"]')!.click();
    if (action === "id") f.panel.selectMarchById(1, { openPanel: true });
    if (action === "close") { f.panel.toggle(); f.panel.toggle(); }
    if (action === "peer") { const peer = document.createElement("div"); peer.className = "content-panel hidden"; f.mount.append(peer); openCenterPanel(peer); openCenterPanel(f.panel.getRoot()); }
    if (action === "relogin") Object.assign(f.gateway, { sessionGeneration: 2 });
    if (action === "city") f.changeCity();
    if (action === "remount") { f.panel.detach(); f.panel.attach(); f.panel.toggle(); }
    const filter = readMilitaryListFilterSession();
    await f.listReply(); while (f.queue.length) await f.listReply();
    expect(f.ids()).not.toContain(2); expect(readMilitaryListFilterSession()).toEqual(filter);
    if (action !== "remount") expect(f.panel.getDestFilter()).toEqual({ x: 10, y: 20 });
  },
);

it("preserves foreground and filters when the successful start has no presentation intent", async () => {
  const f = await setup(); f.panel.setDestFilter(10, 20); f.phase("return");
  const military = await f.depart(false); await f.listReply();
  expect(f.panel.isOpen()).toBe(false); expect(military.classList.contains("hidden")).toBe(false);
  expect(f.panel.getDestFilter()).toEqual({ x: 10, y: 20 }); expect(readMilitaryListFilterSession().phase).toBe("return");
});
