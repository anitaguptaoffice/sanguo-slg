import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes } from "@/net/loadProto";
import type { MainCitySession } from "@/net/bootstrapSession";
import { readLeaderboardReturnScroll } from "@/net/leaderboardReturnScroll";
import { MainCityScene } from "@/scenes/MainCityScene";
import { SocialPanels } from "./SocialPanels";
import { HeroMailPanels } from "./HeroMailPanels";
import { openCenterPanel } from "./centerPanelForeground";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const clean: Array<() => void> = [];
const types = getTypes();
// Production RPC, trace/session checks and protobuf; deterministic ordered server transport.
class Socket extends EventTarget {
  static OPEN = 1;
  static last: Socket;
  readyState = 1;
  onopen?: () => void;
  onclose?: () => void;
  paused = false;
  queue: any[] = [];
  routes: string[] = [];
  processed: string[] = [];
  heroes = [7, 8];
  constructor() { super(); Socket.last = this; queueMicrotask(() => this.onopen?.()); }
  send(bytes: Uint8Array) {
    const request = types.ClientPacket.toObject(types.ClientPacket.decode(bytes), { longs: Number }) as any;
    this.queue.push(request); this.routes.push(request.route);
    if (!this.paused) queueMicrotask(() => { if (!this.paused && this.queue.length) this.step(); });
  }
  step(fail = false) {
    const request = this.queue.shift(); expect(request).toBeDefined();
    const name = request.route.split(".").at(-1) as string;
    this.processed.push(request.route);
    const fixtures: Record<string, object> = {
      Login: { session_id: "test-session" },
      GetLeaderboard: { entries: [{ rank: 1, entity_id: 1, display_name: "Self", score: 100 },
        { rank: 2, entity_id: 8, display_name: "Other", score: 50 }], total_count: 2 },
      ListPlayerHeroes: { heroes: this.heroes.map(hero_id => ({ hero_id, template_cfg_id: 1001, level: 1 })), total_count: this.heroes.length },
      ListPlayerBag: { items: [] },
      GetHeroDetail: { hero_id: name === "GetHeroDetail" ? Number((types.GetHeroDetailRequest.decode(request.payload) as any).hero_id) : 0,
        template_cfg_id: 1001, level: 1 },
    };
    expect(fixtures[name], name).toBeDefined();
    const response = types[`${name}Response` as keyof typeof types];
    const data = fail ? new Uint8Array() : response.encode(response.fromObject(fixtures[name])).finish();
    const bytes = types.ServerPacket.encode({ trace_id: request.trace_id, code: fail ? 50001 : 0, msg: fail ? "read rejected" : "", data }).finish();
    this.dispatchEvent(new MessageEvent("message", { data: Uint8Array.from(bytes).buffer }));
  }
  async drain(failFirst = false) {
    for (let n = 0; this.queue.length; n++) {
      if (n > 30) throw new Error("unexpected request loop");
      this.step(failFirst && n === 0); await flush();
    }
    expect(this.processed).toEqual(this.routes);
  }
  close() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event("close")); }
}
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { clean.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(type = 1) {
  const gateway = new GatewayClient(); await gateway.connect(); await gateway.login("fixture", "unused", 1);
  const socket = Socket.last;
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const mount = document.createElement("div"); document.body.append(mount);
  const status = vi.fn(), social = new SocialPanels(mount, gateway, () => session, status);
  const hero = new HeroMailPanels(mount, gateway, () => session, patch => Object.assign(session, patch), status);
  social.attach(); hero.attach();
  const world = document.createElement("section"); world.className = "content-panel hidden"; mount.append(world);
  // Actual scene callback wiring and hero navigation, without unrelated city polling.
  const host = Object.assign(Object.create(MainCityScene.prototype), { gateway, session, social, heroMail: hero, renderHud: vi.fn(),
    world: { getRoot: () => world, toggle: () => openCenterPanel(world), selectGridAt: vi.fn() }, focusMinimapOnWorldGrid: vi.fn() });
  host.wireSocialRankDeepLinks();
  const opened = vi.spyOn(hero, "openHeroDetailDeepLink");
  const select = (value: number) => {
    const input = social.getRankRoot().querySelector<HTMLSelectElement>('[data-field="rank-type"]')!;
    input.value = String(value); input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  select(type); social.toggleRank(); await flush(); await flush(); socket.paused = true;
  clean.push(() => { social.detach(); hero.detach(); gateway.close(); });
  const click = (index = 0) => social.getRankRoot().querySelectorAll<HTMLElement>("tr.rank-data-row")[index].click();
  const heroVisible = () => !mount.querySelector('[data-center-panel="hero"]')!.classList.contains("hidden");
  return { gateway, socket, session, mount, social, hero, opened, select, click, heroVisible, status, world };
}
it("valid hero navigation retains return scroll through actual scene wiring", async () => {
  const f = await setup(); f.click(); await f.socket.drain();
  expect(f.opened).toHaveBeenCalledExactlyOnceWith(7); expect(f.heroVisible()).toBe(true);
  expect(readLeaderboardReturnScroll()?.boardType).toBe(1);
  expect(f.socket.routes).toContain("hero.v1.GetHeroDetail");
});
it.each(["close", "guild", "world", "reopen", "board-aba", "remount", "actor", "city", "relogin", "refresh"])("newer %s intent cancels delayed hero navigation", async mode => {
  const f = await setup(); f.click(); expect(f.socket.queue[0].route).toBe("hero.v1.ListPlayerHeroes");
  let login: Promise<unknown> | undefined;
  if (mode === "close") f.social.toggleRank();
  if (mode === "guild") f.social.toggleGuild();
  if (mode === "world") openCenterPanel(f.world);
  if (mode === "reopen") { f.social.toggleRank(); f.social.toggleRank(); }
  if (mode === "board-aba") { f.select(2); f.select(1); }
  if (mode === "remount") { f.social.detach(); f.social.attach(); f.social.toggleRank(); }
  if (mode === "actor") f.session.player.player_id = 2;
  if (mode === "city") f.session.cityId = 2;
  if (mode === "relogin") login = f.gateway.login("fixture", "unused", 1);
  if (mode === "refresh") f.social.getRankRoot().querySelector<HTMLButtonElement>('[data-action="refresh-rank"]')!.click();
  await f.socket.drain(); await login;
  expect(f.opened).not.toHaveBeenCalled(); expect(f.heroVisible()).toBe(false);
  expect(readLeaderboardReturnScroll()).toBeNull();
});
it.each([false, true])("latest click wins in FIFO order (same row=%s)", async same => {
  const f = await setup(); f.click(); f.click(same ? 0 : 1);
  f.socket.step(); await flush(); expect(f.opened).not.toHaveBeenCalled();
  await f.socket.drain(); expect(f.opened).toHaveBeenCalledExactlyOnceWith(same ? 7 : 8);
});
it.each(["close", "guild", "relogin", "new-click"])("second lookup belongs to original intent: %s", async mode => {
  const f = await setup(); f.socket.heroes = []; f.click(); f.socket.step(); await flush();
  expect(f.socket.queue[0].route).toBe("hero.v1.ListPlayerHeroes"); expect(readLeaderboardReturnScroll()).toBeNull();
  let login: Promise<unknown> | undefined;
  if (mode === "close") f.social.toggleRank();
  if (mode === "guild") f.social.toggleGuild();
  if (mode === "relogin") login = f.gateway.login("fixture", "unused", 1);
  if (mode === "new-click") f.click(1);
  f.socket.heroes = [7, 8]; await f.socket.drain(); await login;
  if (mode === "new-click") expect(f.opened).toHaveBeenCalledExactlyOnceWith(8);
  else { expect(f.opened).not.toHaveBeenCalled(); expect(readLeaderboardReturnScroll()).toBeNull(); }
});
it("active empty first lookup resolves through second lookup", async () => {
  const f = await setup(); f.socket.heroes = []; f.click(); f.socket.step(); await flush();
  f.socket.heroes = [8]; await f.socket.drain(); expect(f.opened).toHaveBeenCalledExactlyOnceWith(8);
});
it("active failed lookup retains existing fallback", async () => {
  const f = await setup(); f.click(); f.socket.step(true); await flush(); await f.socket.drain();
  expect(f.opened).toHaveBeenCalledExactlyOnceWith(7);
});
it("stale failure cannot use empty-list fallback to reopen hero", async () => {
  const f = await setup(); f.click(); f.social.toggleGuild(); await f.socket.drain(true);
  expect(f.opened).not.toHaveBeenCalled(); expect(readLeaderboardReturnScroll()).toBeNull();
  expect(f.social.getGuildRoot().classList.contains("hidden")).toBe(false);
});
it.each([0, 1])("stale resource row %s cannot navigate or render summary", async index => {
  const f = await setup(2); f.click(index); f.social.toggleGuild(); await f.socket.drain();
  expect(f.world.classList.contains("hidden")).toBe(true);
  expect(f.social.getRankRoot().querySelector('[data-role="rank-entry-summary"]')!.classList.contains("hidden")).toBe(true);
  expect(f.social.getGuildRoot().classList.contains("hidden")).toBe(false);
});
it("current resource self-row opens the world", async () => {
  const f = await setup(2); f.click(); await f.socket.drain(); expect(f.world.classList.contains("hidden")).toBe(false);
});
it("Escape cancels a pending explicit view-hero button", async () => {
  const f = await setup(); f.social.getRankRoot().querySelector<HTMLButtonElement>('[data-action="rank-view-hero"]')!.click();
  f.social.getRankRoot().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await f.socket.drain(); expect(f.opened).not.toHaveBeenCalled(); expect(readLeaderboardReturnScroll()).toBeNull();
});
it("disconnect invalidates the actor before the scene's fallback", async () => {
  const f = await setup(); f.click(); f.gateway.close(); await flush();
  expect(f.opened).not.toHaveBeenCalled(); expect(readLeaderboardReturnScroll()).toBeNull();
});
it("no heroes still opens the current roster with the existing empty message", async () => {
  const f = await setup(); f.socket.heroes = []; f.click(); await f.socket.drain();
  expect(f.opened).toHaveBeenCalledExactlyOnceWith(0); expect(f.heroVisible()).toBe(true);
  expect(f.status).toHaveBeenCalledWith("暂无将领可查看");
});
it("current resource peer row retains readonly summary", async () => {
  const f = await setup(2); f.click(1); await f.socket.drain();
  expect(f.social.getRankRoot().querySelector('[data-role="rank-entry-summary"]')!.classList.contains("hidden")).toBe(false);
});
it.each([false, true])("custom lookup rejection is caught without stale feedback (stale=%s)", async stale => {
  const f = await setup(); let reject!: (error: Error) => void;
  f.social.setRankDeepLinkHandlers({ getViewerHeroIds: () => new Promise((_, fail) => { reject = fail; }) });
  f.click(); if (stale) f.social.toggleGuild(); f.status.mockClear(); reject(new Error("lookup failure")); await flush();
  if (stale) expect(f.status).not.toHaveBeenCalled(); else expect(f.status).toHaveBeenCalledWith(expect.stringContaining("lookup failure"));
  expect(readLeaderboardReturnScroll()).toBeNull();
});
