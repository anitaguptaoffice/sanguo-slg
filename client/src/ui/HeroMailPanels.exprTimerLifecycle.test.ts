import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const panels: HeroMailPanels[] = [];
const receipt = () => ({ hero_id: 7, status: 4, ends_at_ms: Date.now() + 3600000, gold_spent: 20, hours: 1 });

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
});
afterEach(() => {
  panels.splice(0).forEach(panel => panel.detach());
  const remaining = vi.getTimerCount();
  // Keep a failing regression from leaking into the next case; cleanup itself must pass.
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = "";
  expect(remaining, "detach must dispose every countdown before test environment teardown").toBe(0);
});

async function setup() {
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 2 }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, template_name: "将领", level: 2,
      exp: 280, exp_toward_next: 80, upgrade_exp_required: 100 })),
    beginHeroExpr: vi.fn(async () => receipt()),
    cancelHeroExpr: vi.fn(async () => ({ hero_id: 7, status: 1 })),
  };
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { gold: 10000 },
    bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const mount = document.createElement("div");
  document.body.append(mount);
  const patch = vi.fn(value => Object.assign(session, value));
  const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, patch, () => {});
  panels.push(panel);
  panel.attach();
  await panel.openHeroDetailDeepLink(7);
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="hero-expr-${action}"]`)!;
  const begin = async () => { button("begin").click(); await flush(); };
  return { panel, gateway, mount, session, patch, button, begin };
}

describe("mounted training countdown lifetime", () => {
  it("cancels an active countdown immediately on detach, including repeated cleanup", async () => {
    const f = await setup();
    await f.begin();
    expect(vi.getTimerCount()).toBe(1);
    f.panel.detach();
    expect(vi.getTimerCount()).toBe(0);
    f.panel.detach();
    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the live countdown ticking and enables finish at the real deadline", async () => {
    const f = await setup();
    f.gateway.beginHeroExpr.mockResolvedValueOnce({ ...receipt(), ends_at_ms: Date.now() + 2000 });
    await f.begin();
    const before = f.mount.querySelector('[data-role="hero-expr-summary"]')!.textContent;
    expect(f.button("finish").disabled).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(f.mount.querySelector('[data-role="hero-expr-summary"]')!.textContent).not.toBe(before);
    vi.advanceTimersByTime(1000);
    expect(f.button("finish").disabled).toBe(false);
    expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(1);
  });

  it("closes and reopens with one countdown and without replaying training", async () => {
    const f = await setup();
    await f.begin();
    f.panel.toggleHero();
    expect(vi.getTimerCount()).toBe(0);
    await f.panel.openHeroDetailDeepLink(7);
    expect(vi.getTimerCount()).toBe(1);
    await f.panel.openHeroDetailDeepLink(7);
    expect(vi.getTimerCount()).toBe(1);
    expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(1);
    expect(f.session.wallet.gold).toBe(9980);
  });

  it("recreates a detached panel without retaining the old timer", async () => {
    const f = await setup();
    await f.begin();
    f.panel.detach();
    expect(vi.getTimerCount()).toBe(0);
    f.panel.attach();
    await f.panel.openHeroDetailDeepLink(7);
    expect(vi.getTimerCount()).toBe(1);
    await f.panel.openHeroDetailDeepLink(7);
    expect(vi.getTimerCount()).toBe(1);
  });

  it.each(["detach", "close", "reattach"] as const)("late successful BeginExpr after %s only ticks a currently mounted display", async mode => {
    const f = await setup();
    let resolve!: (result: ReturnType<typeof receipt>) => void;
    f.gateway.beginHeroExpr.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    f.button("begin").click();
    if (mode === "close") f.panel.toggleHero();
    else f.panel.detach();
    if (mode === "reattach") {
      f.panel.attach();
      await f.panel.openHeroDetailDeepLink(7);
    }
    resolve({ ...receipt(), ends_at_ms: Date.now() + 2000 });
    await flush();
    expect(vi.getTimerCount()).toBe(mode === "reattach" ? 1 : 0);
    if (mode === "reattach") {
      // A successful receipt still renders the current same-hero view. Do not freeze its deadline.
      expect(f.button("finish").disabled).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(f.button("finish").disabled).toBe(false);
    }
    // Disposing a display is not cancellation of an already successful server command.
    expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(1);
    expect(f.patch.mock.calls.filter(([value]) => value.wallet)).toHaveLength(1);
    expect(f.session.wallet.gold).toBe(9980);
    if (mode === "detach") f.panel.attach();
    await f.panel.openHeroDetailDeepLink(7);
    expect(vi.getTimerCount()).toBe(1);
    expect(f.button("begin").disabled).toBe(true);
  });

  it("does not revive a timer from a late detail read after detach", async () => {
    const f = await setup();
    await f.begin();
    let resolve!: (value: Awaited<ReturnType<typeof f.gateway.getHeroDetail>>) => void;
    f.gateway.getHeroDetail.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = f.panel.openHeroDetailDeepLink(7);
    f.panel.detach();
    resolve({ hero_id: 7, template_cfg_id: 1001, template_name: "将领", level: 2,
      exp: 280, exp_toward_next: 80, upgrade_exp_required: 100 });
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up on successful settlement and starts a single new user-requested countdown", async () => {
    const f = await setup();
    await f.begin();
    f.button("cancel").click();
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    await f.begin();
    expect(vi.getTimerCount()).toBe(1);
    expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(2);
    expect(f.gateway.cancelHeroExpr).toHaveBeenCalledTimes(1);
  });
});
