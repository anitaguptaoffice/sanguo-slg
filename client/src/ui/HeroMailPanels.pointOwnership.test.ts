import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const flush = () => new Promise(r => setTimeout(r, 0));
const panels: HeroMailPanels[] = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; });
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const detail = (id: number, level = 3) => ({ hero_id: id, template_cfg_id: 1001, template_name: `Hero ${id}`, level, exp_toward_next: 1000, upgrade_exp_required: 100, attributes: { force: 20, intel: 15, politics: 10 } });
const result = (id: number, used = 1, level = 3) => ({ hero_id: id, potential_remaining: level - used, force_add: used, intel_add: 0, politics_add: 0, attributes: { force: 20 + used, intel: 15, politics: 10 } });
async function setup() {
 let token = "a", generation = 1;
 const gateway = { getSessionId: () => token, getSessionGeneration: () => generation, getBoundServerId: () => 1, listPlayerBag: vi.fn(async () => ({ items: [] })), listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 3 }, { hero_id: 8, level: 3 }], total_count: 2 })), getHeroDetail: vi.fn(async (_s: number, id: number) => detail(id)), addHeroPoint: vi.fn(async (_s: number, id: number) => result(id)), clearHeroPoint: vi.fn(async (_s: number, id: number) => result(id, 0)), upgradeHero: vi.fn(async () => ({ hero_id: 7, previous_level: 3, level: 4, exp_current: 1000, exp_to_next: 100 })) };
 const mount = document.createElement("div"); document.body.append(mount);
 const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
 const status = vi.fn(), panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, () => {}, status); panels.push(panel); panel.attach(); panel.toggleHero(); await flush();
 const click = (id: number) => mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
 const button = (action: "add" | "clear") => mount.querySelector<HTMLButtonElement>(`[data-action="hero-point-${action}"]`)!;
 return { panel, raw: panel as unknown as Record<string, any>, gateway, session, status, click, mount, button, relogin() { token = "b"; generation++; } };
}
type Fixture = Awaited<ReturnType<typeof setup>>;
async function prepare(f: Fixture, action: "add" | "clear") { f.click(7); await flush(); if (action === "clear") { f.button("add").click(); await flush(); } }
it.each(["add", "clear"] as const)("%s result preserves A snapshot without replacing B", async action => {
 const f = await setup(), a = deferred(); await prepare(f, action); f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"].mockReturnValueOnce(a.promise); f.button(action).click(); f.click(8); await flush(); f.status.mockClear(); a.resolve(result(7, action === "add" ? 2 : 0)); await flush();
 expect(f.raw.heroDetail.hero_id).toBe(8); expect(f.raw.heroDetail.force_add).toBe(0); expect(f.status).not.toHaveBeenCalled(); f.click(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(action === "add" ? 2 : 0); expect(f.raw.heroDetail.potential_remaining).toBe(action === "add" ? 1 : 3);
});
it.each(["add", "clear"] as const)("old %s failure cannot change B or release B pending allocation", async action => {
 const f = await setup(), a = deferred(), b = deferred(); await prepare(f, action); f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"].mockReturnValueOnce(a.promise); f.button(action).click(); f.click(8); await flush(); expect(f.button("add").disabled).toBe(false); f.gateway.addHeroPoint.mockReturnValueOnce(b.promise); f.button("add").click(); a.reject(new Error("old error")); await flush(); expect(f.raw.heroPointSubmitState).toBe("submitting"); b.resolve(result(8)); await flush(); expect(f.raw.heroDetail.hero_id).toBe(8); expect(f.raw.heroDetail.force_add).toBe(1);
});
it("snapshot from completed allocation cannot leak across actor replacement", async () => {
 const f = await setup(); await prepare(f, "add"); f.button("add").click(); await flush(); expect(f.raw.heroDetail.force_add).toBe(1); f.relogin(); f.click(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(0); expect(f.raw.heroDetail.potential_remaining).toBe(3);
});
it.each(["add", "clear"] as const)("old actor %s response never becomes new actor snapshot", async action => {
 const f = await setup(), a = deferred(); await prepare(f, action); f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"].mockReturnValueOnce(a.promise); f.button(action).click(); f.relogin(); f.click(7); await flush(); f.status.mockClear(); a.resolve(result(7, 2)); await flush(); expect(f.raw.heroDetail.force_add).toBe(0); expect(f.status).not.toHaveBeenCalled(); f.click(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(0);
});
it.each(["add", "clear"] as const)("%s A/B/A shares pending lock and rereads confirmed receipt once", async action => {
 const f = await setup(), a = deferred(); await prepare(f, action); const rpc = f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"]; rpc.mockReturnValueOnce(a.promise); const before = rpc.mock.calls.length; f.button(action).click(); f.click(8); await flush(); f.click(7); await flush(); expect(f.button("add").disabled).toBe(true); expect(f.button("clear").disabled).toBe(true); f.button("add").click(); f.button("clear").click(); a.resolve(result(7, action === "add" ? 2 : 0)); await flush(); await flush(); expect(rpc).toHaveBeenCalledTimes(before + 1); expect(f.raw.heroDetail.force_add).toBe(action === "add" ? 2 : 0);
});
it.each(["close", "back", "detach", "peer"])("successful points remain available after %s without late presentation", async action => {
 const f = await setup(), a = deferred(); await prepare(f, "add"); f.gateway.addHeroPoint.mockReturnValueOnce(a.promise); f.button("add").click(); if (action === "close") f.panel.toggleHero(); else if (action === "back") f.raw.restoreHeroListFromReturnState(); else if (action === "detach") f.panel.detach(); else f.panel.openMailPanel(); await flush(); f.status.mockClear(); a.resolve(result(7, 2)); await flush(); expect(f.status).not.toHaveBeenCalled(); if (action === "detach") f.panel.attach(); await f.panel.openHeroDetailDeepLink(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(2); expect(f.raw.heroDetail.potential_remaining).toBe(1); expect(f.gateway.addHeroPoint).toHaveBeenCalledTimes(1);
});
it.each(["add", "clear"] as const)("%s late Lv3 receipt after upgrade to Lv4 preserves exact allocation debt", async action => {
 const f = await setup(), a = deferred(); await prepare(f, action); const rpc = f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"]; rpc.mockReturnValueOnce(a.promise); f.button(action).click(); f.mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click(); await flush(); expect(f.raw.heroDetail.level).toBe(4); f.gateway.getHeroDetail.mockResolvedValue(detail(7, 4)); a.resolve(result(7, action === "add" ? 2 : 0, 3)); await flush(); await flush(); expect(f.raw.heroDetail.level).toBe(4); expect(f.raw.heroDetail.potential_remaining).toBe(action === "add" ? 2 : 4); f.click(7); await flush(); expect(f.raw.heroDetail.potential_remaining).toBe(action === "add" ? 2 : 4);
});
it("point receipt before pending upgrade retains allocation when upgrade settles", async () => {
 const f = await setup(), upgrade = deferred(); await prepare(f, "add"); f.gateway.upgradeHero.mockReturnValueOnce(upgrade.promise); f.mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click(); f.button("add").click(); await flush(); f.gateway.getHeroDetail.mockResolvedValue({ ...detail(7, 4), attributes: { force: 25, intel: 18, politics: 12 } }); upgrade.resolve({ hero_id: 7, previous_level: 3, level: 4, exp_current: 1000, exp_to_next: 100 }); await flush(); await flush(); expect(f.raw.heroDetail.attributes.force).toBe(25); expect(f.raw.heroDetail.potential_remaining).toBe(3); f.gateway.getHeroDetail.mockResolvedValue(detail(7, 4)); f.click(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(1); expect(f.raw.heroDetail.potential_remaining).toBe(3);
});
it("new actor's same-hero request survives old finally and retains only new receipt", async () => {
 const f = await setup(), a = deferred(), b = deferred(); await prepare(f, "add"); f.gateway.addHeroPoint.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise); f.button("add").click(); f.relogin(); f.click(7); await flush(); f.button("add").click(); a.resolve(result(7, 2)); await flush(); expect(f.raw.heroPointSubmitState).toBe("submitting"); b.resolve(result(7, 1)); await flush(); expect(f.raw.heroDetail.force_add).toBe(1); f.click(7); await flush(); expect(f.raw.heroDetail.force_add).toBe(1);
});
it.each(["add", "clear"] as const)("%s current failure, mismatched response and retry preserve identity", async action => {
 const f = await setup(); await prepare(f, action); const rpc = f.gateway[action === "add" ? "addHeroPoint" : "clearHeroPoint"]; rpc.mockRejectedValueOnce(new Error("failure")); f.button(action).click(); await flush(); expect(f.raw.heroPointSubmitState).toBe("error"); rpc.mockResolvedValueOnce(result(8)); f.button(action).click(); await flush(); expect(f.raw.heroDetail.hero_id).toBe(7); expect(f.raw.heroPointSubmitState).toBe("error"); rpc.mockResolvedValueOnce(result(7, action === "add" ? 1 : 0)); f.button(action).click(); await flush(); expect(f.raw.heroPointSubmitState).toBe("idle");
});
