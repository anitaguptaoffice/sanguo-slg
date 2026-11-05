import { it, expect, vi, afterEach } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { SceneManager } from "@/engine/SceneManager";
import { ServerSelectScene } from "./ServerSelectScene";
const clean: Array<() => void> = [];
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
afterEach(() => { clean.splice(0).forEach(fn => fn()); document.body.replaceChildren(); sessionStorage.clear(); vi.restoreAllMocks(); });
async function setup() {
  const main = new MainCityScene(), select = new ServerSelectScene(), manager = new SceneManager(); manager.register(main); manager.register(select);
  let online = true, generation = 1; const events: string[] = [];
  const session = { serverId: 1, player: { player_id: 1, level: 1 }, cityId: 1, cityName: "主城", cityX: 60, cityY: 60,
    wallet: { food: 900, wood: 900, stone: 900, iron: 900 }, buildings: [], cityTroops: [], bag: [] };
  const fallback = vi.fn(async () => { if (!online) throw new Error("gateway not connected"); return {}; });
  const gateway = new Proxy({ getSessionId: () => online ? "token" : "", getSessionGeneration: () => generation, getBoundServerId: () => online ? 1 : 0,
    close: vi.fn(() => { events.push("close"); online = false; generation++; }),
    connect: vi.fn(async () => { events.push("connect"); online = true; generation++; }),
    listGameServers: vi.fn(async () => { events.push("list"); return { servers: [{ shard: { server_id: 1, status: 1, display_name: "S1" } }] }; }),
    login: vi.fn(async () => ({ player: session.player })), register: vi.fn(), enterGameServer: vi.fn(async () => ({ player: session.player })),
    getCityState: vi.fn(async () => { if (!online) throw new Error("gateway not connected"); return { wallet: session.wallet }; }),
    claimPlayerMailAttachments: vi.fn(async () => ({})), markPlayerMailRead: vi.fn(async () => ({})),
    listPlayerMail: vi.fn(async () => ({})),
    recruitTroop: vi.fn(), listCaptiveHeroes: vi.fn(async () => ({})),
    listPlayerCities: vi.fn(async () => ({ cities: [{ city_id: 1, name: "主城", x: 60, y: 60 }] })),
  }, { get: (target, key) => key in target ? target[key as keyof typeof target] : fallback });
  const assets = new Proxy({ getTextureScale: () => 1, getDevicePixelRatio: () => 1 }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => undefined });
  const layoutFrame = document.createElement("div"), hud = document.createElement("div"), canvas = document.createElement("canvas");
  layoutFrame.append(hud, canvas); document.body.append(layoutFrame);
  const ctx = { layoutFrame, hud, canvas, gateway, assets, switchScene: vi.fn(), getViewport: () => ({ scale: 1, offsetX: 0, offsetY: 0 }) } as any;
  vi.spyOn(window, "confirm").mockReturnValue(true); await manager.switch("mainCity", ctx, session); await flush();
  clean.push(() => { main.leave(); select.leave(); });
  const click = (action: string) => { const button = layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${action}"]`); expect(button).not.toBeNull(); button!.click(); };
  return { main: main as unknown as Record<string, any>, manager, select, ctx, session, gateway, layoutFrame, hud, events, click,
    disconnect: () => { online = false; generation++; }, reenter: async () => { await manager.switch("mainCity", ctx, { ...session, player: { player_id: 2 }, wallet: { food: 77 } }); await flush(); } };
}
it("confirmed disconnected return closes before listing, warns about outcomes, and never auto-logs in", async () => {
  const f = await setup(); f.disconnect(); f.click("refresh"); await flush();
  expect(f.gateway.connect).not.toHaveBeenCalled(); const old = f.layoutFrame.querySelector<HTMLButtonElement>('[data-action="return-server-select"]')!;
  f.click("return-server-select"); old.click(); await flush();
  expect(window.confirm).toHaveBeenCalledTimes(1); expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("不会撤销"));
  expect(f.events).toEqual(["close", "connect", "list"]); expect(f.layoutFrame.querySelector(".main-city-toolbar")).toBeNull();
  expect(f.layoutFrame.querySelector('[data-role="return-result-notice"]')?.textContent).toContain("勿重复提交");
  expect(f.gateway.login).not.toHaveBeenCalled(); expect(f.gateway.register).not.toHaveBeenCalled(); expect(f.gateway.enterGameServer).not.toHaveBeenCalled();
  f.click("enter-game"); await flush(); expect(f.gateway.login).toHaveBeenCalledTimes(1); expect(f.gateway.enterGameServer).toHaveBeenCalledTimes(1);
  expect(f.layoutFrame.querySelector(".main-city-toolbar")).not.toBeNull(); old.click(); expect(f.gateway.close).toHaveBeenCalledTimes(1);
});
it("cancel keeps the current session, panel, and connection intact", async () => {
  const f = await setup(); vi.mocked(window.confirm).mockReturnValue(false); f.click("toggle-military"); await flush(); const html = f.hud.innerHTML;
  f.click("return-server-select"); expect(f.gateway.close).not.toHaveBeenCalled(); expect(f.gateway.connect).not.toHaveBeenCalled();
  expect(f.hud.innerHTML).toBe(html); expect(f.layoutFrame.querySelector(".military-panel")!.classList.contains("hidden")).toBe(false);
});
it.each(["selection", "reentry"])("late manual refresh rejection cannot replace %s HUD", async where => {
  const f = await setup(), d = deferred(); f.gateway.getCityState.mockReturnValueOnce(d.promise); f.click("refresh");
  f.click("return-server-select"); await flush(); if (where === "reentry") await f.reenter(); const html = f.hud.innerHTML;
  d.reject(new Error("old socket closed")); await flush(); expect(f.hud.innerHTML).toBe(html); expect(f.hud.textContent).not.toContain("old socket");
});
it("pending submitted recruitment is not replayed or treated as canceled on return", async () => {
  const f = await setup(), d = deferred(); f.gateway.recruitTroop.mockReturnValueOnce(d.promise); f.click("toggle-military"); f.click("recruit");
  expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1); f.click("return-server-select"); await flush(); await f.reenter(); const html = f.hud.innerHTML;
  d.reject(new Error("gateway disconnected")); await flush(); expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1);
  expect(f.hud.innerHTML).toBe(html); expect(f.main.session.wallet.food).toBe(77);
});
it("old unguarded hero-list errors, badge snapshots and rank navigation cannot target the new scene", async () => {
  const f = await setup(), d = deferred(), oldHero = f.main.heroMail, oldPoll = f.main.hudTodoBadgePoll, oldRank = f.main.social.rankDeepLink;
  f.gateway.listCaptiveHeroes.mockReturnValueOnce(d.promise); const pending = oldHero.refreshCaptiveHeroes();
  f.click("return-server-select"); await flush(); await f.reenter(); const html = f.hud.innerHTML;
  const applyMail = vi.spyOn(f.main.hudTodoBadgePoll, "applyMailInboxSnapshot"), applyCounts = vi.spyOn(f.main, "applyHudTodoBadgeCounts");
  d.reject(new Error("old captive read")); await pending; oldPoll.opts.onCounts({});
  oldHero.onMailInboxSnapshot([{ mail_id: 90 }], 1); oldHero.onMailHudSnapshot({ count: 5, firstId: 90 });
  oldRank.onOpenWorldViewer(); oldRank.onOpenHeroDetail(99);
  expect(applyMail).not.toHaveBeenCalled(); expect(applyCounts).not.toHaveBeenCalled(); expect(f.hud.innerHTML).toBe(html);
  expect(f.layoutFrame.querySelector(".world-panel")!.classList.contains("hidden")).toBe(true);
});
it("reentry drops prior actor display caches even if the new roster/march reads are empty", async () => {
  const f = await setup(), oldTracker = f.main.chatUnreadTracker, oldReports = f.main.battleReportUnread;
  Object.assign(f.main, { lastMarch: { march_id: 90 }, minimapMarches: [{ march_id: 90 }], walletGainBrief: "old reward", marchArrivalHudReminder: { marchId: 90 }, status: "old actor", activeDomesticSlotKey: "farm" });
  f.click("return-server-select"); await flush(); await f.reenter();
  expect(f.main.lastMarch).toBeNull(); expect(f.main.minimapMarches).toEqual([]); expect(f.main.walletGainBrief).toBeNull(); expect(f.main.activeDomesticSlotKey).toBeNull();
  expect(f.main.chatUnreadTracker).not.toBe(oldTracker); expect(f.main.battleReportUnread).not.toBe(oldReports); expect(f.hud.textContent).not.toMatch(/old actor|old reward/);
});
it("connection failure remains in server selection with an explicit retry and outcome notice", async () => {
  const f = await setup(); f.gateway.connect.mockRejectedValueOnce(new Error("offline")); f.click("return-server-select"); await flush();
  expect(f.layoutFrame.textContent).toContain("offline"); expect(f.layoutFrame.querySelector('[data-role="return-result-notice"]')).not.toBeNull();
  expect(f.layoutFrame.querySelector<HTMLButtonElement>('[data-action="enter-game"]')!.disabled).toBe(true);
  f.click("refresh-servers"); await flush(); expect(f.gateway.connect).toHaveBeenCalledTimes(2); expect(f.gateway.login).not.toHaveBeenCalled();
});

it("revokes detached mail batch access before it can submit the next claim on a new connection", async () => {
  const f = await setup(), d = deferred(), old = f.main.heroMail;
  old.mails = [11, 12].map(mail_id => ({ mail_id, title: "Mail", attachments: { items: [{ item_cfg_id: 2004, quantity: 1 }] } }));
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(d.promise);
  const pending = old.runSequentialMailClaims([11, 12], "claiming");
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  f.click("return-server-select"); await flush(); await f.reenter();
  d.reject(new Error("old socket disconnected")); await pending;
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledWith(1, 11);
});
it("late mail deep-link refresh cannot mark a mail read after return", async () => {
  const f = await setup(), d = deferred(), old = f.main.heroMail;
  f.gateway.listPlayerMail.mockResolvedValueOnce({ mails: [{ mail_id: 11, title: "Mail", is_read: false }], total_count: 1 } as any).mockReturnValueOnce(d.promise);
  old.openAndHighlightMail(11); await flush();
  f.click("return-server-select"); await flush(); await f.reenter();
  d.reject(new Error("old unread read closed")); await flush(); await flush();
  expect(f.gateway.markPlayerMailRead).not.toHaveBeenCalled();
});
it("the per-entry gateway facade binds real method receivers and rejects calls after leave", async () => {
  const f = await setup(), facade = f.main.gateway;
  f.gateway.getCityState.mockImplementationOnce(async function (this: unknown) { expect(this).toBe(f.gateway); return {}; });
  await facade.getCityState(1); f.click("return-server-select"); await flush();
  const calls = f.gateway.getCityState.mock.calls.length;
  await expect(facade.getCityState(1)).rejects.toThrow("场景已离开");
  expect(f.gateway.getCityState).toHaveBeenCalledTimes(calls);
  expect(typeof facade.getSessionGeneration()).toBe("number");
});

it("pending march-success selection callback cannot overwrite later actor scene", async () => {
  const f = await setup(), d = deferred(), oldMarchList = f.main.marchList;
  (f.gateway as any).listMarches = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue({ marches: [] });
  oldMarchList.notifyMarchStarted(90, { march: { march_id: 90, from_city_id: 1, to_x: 123, to_y: 124, phase: 1 }, toX: 123, toY: 124 });
  f.click("return-server-select"); await flush(); await f.reenter();
  const html = f.hud.innerHTML, status = f.main.status;
  d.reject(new Error("old socket disconnected")); await flush();
  expect(f.main.status).toBe(status);
  expect(f.hud.innerHTML).toBe(html);
});
