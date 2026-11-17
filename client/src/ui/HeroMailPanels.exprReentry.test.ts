import { readFileSync } from "node:fs";
import path from "node:path";
import protobuf from "protobufjs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

const schema = protobuf.parse(readFileSync(path.resolve(
  process.cwd(), "../internal/api/proto/sanguo/hero/v1/hero.proto",
), "utf8"), { keepCase: true }).root;
const detailType = schema.lookupType("sanguo.hero.v1.GetHeroDetailResponse");
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const panels: HeroMailPanels[] = [];
const receipt = { hero_id: 7, status: 1, exp: 320, exp_gained: 40 };

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  panels.splice(0).forEach(panel => panel.detach());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

async function setup() {
  let generation = 1;
  const detail = (id: number) => detailType.toObject(detailType.decode(detailType.encode({
    hero_id: id, template_cfg_id: 1001, template_name: `Hero ${id}`, level: 2,
    exp: 280, exp_toward_next: 80, upgrade_exp_required: 100,
  }).finish()), { longs: Number });
  const gateway = {
    getBoundServerId: () => 1,
    getSessionId: () => "session",
    getSessionGeneration: () => generation,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({
      heroes: [{ hero_id: 7, level: 2 }, { hero_id: 9, level: 2 }], total_count: 2,
    })),
    getHeroDetail: vi.fn(async (_sid: number, id: number) => detail(id)),
    beginHeroExpr: vi.fn(async () => ({
      hero_id: 7, status: 4, ends_at_ms: Date.now() + 3600000, hours: 1, gold_spent: 20,
    })),
    finishHeroExpr: vi.fn(async () => receipt),
    cancelHeroExpr: vi.fn(),
    fasterHeroExpr: vi.fn(),
    upgradeHero: vi.fn(async () => ({
      hero_id: 7, level: 3, previous_level: 2, exp: 320, exp_current: 20, exp_to_next: 200,
    })),
  };
  const session = {
    serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { gold: 10000 },
    bag: [], buildings: [], cityTroops: [],
  } as MainCitySession;
  const mount = document.createElement("div");
  document.body.append(mount);
  const status = vi.fn();
  const create = () => {
    const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort,
      () => session, patch => Object.assign(session, patch), status);
    panels.push(panel);
    panel.attach();
    return panel;
  };
  let panel = create();
  const select = async (id = 7) => { await panel.openHeroDetailDeepLink(id); await flush(); };
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(
    `[data-action="hero-${action}"]`,
  )!;
  await select();
  return {
    gateway, status, mount, button, select, detail,
    get panel() { return panel; },
    reenter: async () => { panel.detach(); panel = create(); await select(); },
    relogin: () => { generation++; },
  };
}

it("reconstructs the panel with real detail wire omissions and offers only an explicit Finish", async () => {
  const f = await setup();
  expect(f.detail(7)).not.toHaveProperty("status");
  expect(f.detail(7)).not.toHaveProperty("expr_ends_at_ms");
  f.button("expr-begin").click();
  await flush();
  expect(f.button("expr-finish").disabled).toBe(true);
  await f.reenter();
  expect(f.mount.querySelector('[data-role="hero-expr-summary"]')?.textContent).toContain("未提供历练状态");
  expect(f.button("expr-finish").textContent).toBe("领取已到期历练");
  expect(f.button("expr-finish").disabled).toBe(false);
  expect(f.button("expr-cancel").disabled).toBe(true);
  expect(f.button("expr-faster").disabled).toBe(true);
  expect(f.gateway.finishHeroExpr).not.toHaveBeenCalled();
  const pending = deferred<typeof receipt>();
  f.gateway.finishHeroExpr.mockReturnValueOnce(pending.promise);
  f.button("expr-finish").click();
  f.button("expr-finish").click();
  expect(f.gateway.finishHeroExpr).toHaveBeenCalledExactlyOnceWith(1, 7);
  pending.resolve(receipt);
  await flush();
  expect(f.mount.querySelector('[data-role="hero-expr-success"]')?.textContent).toContain("经验 +40");
  expect(f.button("expr-finish").disabled).toBe(true);
  expect(f.button("upgrade").disabled).toBe(false);
  f.button("upgrade").click();
  await flush();
  expect(f.gateway.upgradeHero).toHaveBeenCalledExactlyOnceWith(1, 7);
  expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(1);
  expect(f.gateway.cancelHeroExpr).not.toHaveBeenCalled();
  expect(f.gateway.fasterHeroExpr).not.toHaveBeenCalled();
});

it.each([
  ["hero: expr not finished yet", "尚未到期"],
  ["hero: hero is not in training", "不能确认之前的领取结果"],
  ["hero: expr session not found", "未找到可结算"],
  ["internal error", "结果暂无法确认"],
  ["timeout", "经验可能已经到账"],
])("reports actual Finish error %s conservatively without automatic retry", async (message, expected) => {
  const f = await setup();
  f.gateway.finishHeroExpr.mockRejectedValueOnce(Object.assign(new Error(message), { code: 10001 }));
  f.button("expr-finish").click();
  await flush();
  expect(f.mount.querySelector('[data-role="hero-expr-form-error"]')?.textContent).toContain(expected);
  expect(f.button("upgrade").disabled).toBe(true);
  await f.select();
  expect(f.gateway.finishHeroExpr).toHaveBeenCalledTimes(1);
});

it("does not treat a mismatched success receipt as completion", async () => {
  const f = await setup();
  f.gateway.finishHeroExpr.mockResolvedValueOnce({ ...receipt, hero_id: 9 });
  f.button("expr-finish").click();
  await flush();
  expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("结果暂无法确认"));
  expect(f.button("upgrade").disabled).toBe(true);
});

it("keeps confirmed success when subsequent rendering fails", async () => {
  const f = await setup();
  const render = vi.spyOn(f.panel as unknown as { renderHeroList(): void }, "renderHeroList");
  render.mockImplementationOnce(() => { throw new Error("render failed"); });
  f.button("expr-finish").click();
  await flush();
  expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("历练完成：经验 +40"));
  expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("请重新打开详情"));
  expect(f.gateway.finishHeroExpr).toHaveBeenCalledTimes(1);
  expect(f.mount.querySelector('[data-role="hero-expr-form-error"]')?.textContent).toBe("");
});

it.each(["hero", "actor", "close", "detach"])("isolates a pending Finish after %s changes", async mode => {
  const f = await setup();
  const pending = deferred<typeof receipt>();
  f.gateway.finishHeroExpr.mockReturnValueOnce(pending.promise);
  f.button("expr-finish").click();
  if (mode === "hero") await f.select(9);
  if (mode === "actor") { f.relogin(); await f.select(); }
  if (mode === "close") f.panel.toggleHero();
  if (mode === "detach") f.panel.detach();
  f.status.mockClear();
  pending.resolve(receipt);
  await flush();
  expect(f.status).not.toHaveBeenCalled();
  expect(f.gateway.finishHeroExpr).toHaveBeenCalledTimes(1);
  if (mode === "hero" || mode === "actor") expect(f.button("upgrade").disabled).toBe(true);
});

it("retains a known deadline and never submits merely because it expires", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000000);
  const f = await setup();
  f.button("expr-begin").click();
  await flush();
  now.mockReturnValue(4599999);
  await f.select();
  expect(f.button("expr-finish").disabled).toBe(true);
  expect(f.button("expr-cancel").disabled).toBe(false);
  expect(f.button("expr-faster").disabled).toBe(false);
  now.mockReturnValue(4600000);
  await f.select();
  expect(f.button("expr-finish").disabled).toBe(false);
  expect(f.button("expr-faster").disabled).toBe(true);
  expect(f.gateway.finishHeroExpr).not.toHaveBeenCalled();
});

it("keeps acknowledged completion if a subsequent FIFO detail refresh fails", async () => {
  const f = await setup();
  const finish = deferred<typeof receipt>();
  const firstRead = deferred<Record<string, unknown>>();
  const freshRead = deferred<Record<string, unknown>>();
  f.gateway.finishHeroExpr.mockReturnValueOnce(finish.promise);
  f.gateway.getHeroDetail.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(freshRead.promise);
  f.button("expr-finish").click();
  const selection = f.select();
  finish.resolve(receipt);
  await flush();
  firstRead.resolve(f.detail(7));
  await selection;
  freshRead.reject(new Error("detail unavailable"));
  await flush();
  expect(f.status).toHaveBeenLastCalledWith("历练完成：经验 +40。详情刷新未完成，请重新打开详情。");
  expect(f.gateway.finishHeroExpr).toHaveBeenCalledTimes(1);
});
