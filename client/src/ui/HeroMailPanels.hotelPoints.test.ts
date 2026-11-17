import { afterEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes } from "@/net/loadProto";
import type { MainCitySession } from "@/net/bootstrapSession";

const types = getTypes();
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let panel: HeroMailPanels | undefined;
afterEach(() => { panel?.detach(); document.body.innerHTML = ""; sessionStorage.clear(); vi.restoreAllMocks(); });
type Identity = { template_cfg_id?: number; template_code?: string };
const hotel: Identity = { template_cfg_id: 0, template_code: "hotel_random" };
const fixed: Identity = { template_cfg_id: 1001, template_code: "xuan_de_lord" };
const reason = "随机客栈将领暂不支持潜力加点或洗点";

async function setup(identity: Identity = hotel) {
  const routes: string[] = [], allocations = new Map<number, number>();
  const identities = new Map([[7, identity], [8, fixed]]);
  const gateway = new GatewayClient();
  let wait: Promise<void> | undefined, release: (() => void) | undefined;
  const packet = (name: string, value: object) => Uint8Array.from(types.ServerPacket.encode({
    code: 0, data: types[name as keyof typeof types].encode(value).finish(),
  }).finish()).buffer;
  const attributes = (id: number) => ({ force: 40 + (allocations.get(id) ?? 0), intel: 35, politics: 50, command: 0 });
  vi.spyOn(gateway as never, "sendAndWait").mockImplementation(async (wire: Uint8Array) => {
    const request = types.ClientPacket.decode(wire) as unknown as { route: string; payload: Uint8Array };
    const method = request.route.split(".").at(-1)!;
    routes.push(method);
    if (["GetHeroDetail", "AddHeroPoint", "ClearHeroPoint"].includes(method)) {
      const payload = types[`${method}Request` as keyof typeof types].decode(request.payload) as unknown as { hero_id: number; force?: number };
      const id = Number(payload.hero_id), identity = identities.get(id)!;
      if (method === "GetHeroDetail") return packet("GetHeroDetailResponse", {
        hero_id: id, ...identity, template_name: `Hero ${id}`, rarity: 1, level: 3,
        loyalty: 70, loyalty_min: 0, loyalty_max: 100, march_force: 32, march_force_max: 32,
        attributes: attributes(id),
      });
      // Matches both server operations' ownedTemplateHero rejection; this branch must stay unreachable from the UI.
      if (identity.template_code === "hotel_random") return Uint8Array.from(types.ServerPacket.encode({
        code: 10001, msg: "hero: unknown template_cfg_id",
      }).finish()).buffer;
      if (method === "AddHeroPoint") expect(payload.force).toBe(attributes(id).force + 1);
      const held = wait; wait = undefined; await held;
      const used = method === "AddHeroPoint" ? (allocations.get(id) ?? 0) + 1 : 0;
      allocations.set(id, used);
      return packet(`${method}Response`, { hero_id: id, potential_remaining: 3 - used,
        force_add: used, intel_add: 0, politics_add: 0, attributes: attributes(id) });
    }
    const fixtures: Record<string, object> = {
      Login: { session_id: "local-test" },
      ListPlayerHeroes: { heroes: [...identities].map(([hero_id, identity]) => ({ hero_id, ...identity, level: 3, loyalty: 70 })), total_count: 2 },
      ListPlayerBag: { items: [] }, ListRecruitTemplates: { templates: [] }, ListHotelRecruitCandidates: { candidates: [] },
      ListCaptiveHeroes: { captives: [] }, ListPersuadeTargets: { targets: [] }, ListComingHeroes: { coming: [] },
    };
    expect(fixtures[method], method).toBeDefined(); return packet(`${method}Response`, fixtures[method]);
  });
  await gateway.login("local-test", "not-a-real-credential", 1);
  const wireDetail = await gateway.getHeroDetail(1, 7);
  expect(wireDetail.template_cfg_id).toBe(identity.template_cfg_id ?? 0);
  expect(wireDetail.template_code || "").toBe(identity.template_code ?? "");
  expect(wireDetail.potential_remaining).toBeUndefined();
  expect(wireDetail.force_add).toBeUndefined();
  const session: MainCitySession = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { gold: 10000 }, bag: [], buildings: [], cityTroops: [] };
  const mount = document.createElement("div"); document.body.append(mount);
  const status = vi.fn();
  panel = new HeroMailPanels(mount, gateway, () => session, () => {}, status);
  panel.attach(); panel.toggleHero(); await flush();
  const select = async (id: number) => { mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click(); await flush(); };
  await select(7);
  const raw = panel as unknown as { submitHeroPoints(stat: "force" | null): Promise<void>; heroDetail: { hero_id: number; force_add?: number } };
  const button = (action: "add" | "clear") => mount.querySelector<HTMLButtonElement>(`[data-action="hero-point-${action}"]`)!;
  const mutations = () => routes.filter(r => r === "AddHeroPoint" || r === "ClearHeroPoint");
  return { mount, status, raw, button, select, mutations, identities,
    hold() { wait = new Promise<void>(resolve => { release = resolve; }); }, release() { release!(); } };
}

it("explicit hotel_random disables every add/reset control with a visible reason and sends neither RPC", async () => {
  const f = await setup();
  const buttons = f.mount.querySelectorAll<HTMLButtonElement>('[data-action="hero-point-add"], [data-action="hero-point-clear"]');
  expect(buttons).toHaveLength(4);
  buttons.forEach(button => { expect(button.disabled).toBe(true); button.click(); });
  for (const action of ["add", "clear"]) {
    const label = f.mount.querySelector(`[data-role="hero-point-${action}-disabled-reason"]`)!;
    expect(label.textContent).toBe(reason); expect(label.classList.contains("hidden")).toBe(false);
  }
  await flush(); expect(f.mutations()).toEqual([]);
});

it.each(["force", null] as const)("direct %s entry rejects hotel_random without dispatch", async stat => {
  const f = await setup();
  await f.raw.submitHeroPoints(stat);
  expect(f.mutations()).toEqual([]);
  expect(f.status).toHaveBeenLastCalledWith(reason);
  expect(f.mount.querySelector('[data-role="hero-point-form-error"]')?.textContent).toBe(reason);
});

it.each([fixed, {}, { template_cfg_id: 0 }, { template_cfg_id: 1001 }])("unknown allocation remains server-validated without explicit marker (%o)", async identity => {
  const f = await setup(identity);
  expect(f.button("add").disabled).toBe(false); expect(f.button("clear").disabled).toBe(false);
  f.button("add").click(); await flush();
  expect(f.raw.heroDetail.force_add).toBe(1);
  f.button("clear").click(); await flush();
  expect(f.raw.heroDetail.force_add).toBe(0);
  expect(f.mutations()).toEqual(["AddHeroPoint", "ClearHeroPoint"]);
});

it("switching target and rereading same-target identity both refresh the capability", async () => {
  const f = await setup();
  await f.select(8); expect(f.button("add").disabled).toBe(false);
  await f.select(7); expect(f.button("add").disabled).toBe(true);
  f.identities.set(7, fixed); await f.select(7);
  expect(f.button("add").disabled).toBe(false); expect(f.button("clear").disabled).toBe(false);
  f.identities.set(7, hotel); await f.select(7);
  await f.raw.submitHeroPoints("force"); await f.raw.submitHeroPoints(null);
  expect(f.button("clear").disabled).toBe(true); expect(f.mutations()).toEqual([]);
});

it.each(["add", "clear"] as const)("supported %s pending ownership survives a hotel visit without leaking its receipt", async action => {
  const f = await setup(); await f.select(8); f.hold(); f.button(action).click();
  await f.select(7); await f.raw.submitHeroPoints("force"); await f.raw.submitHeroPoints(null);
  expect(f.mutations()).toHaveLength(1);
  await f.select(8);
  expect(f.button("add").disabled).toBe(true); expect(f.button("clear").disabled).toBe(true);
  await f.raw.submitHeroPoints("force"); await f.raw.submitHeroPoints(null);
  expect(f.mutations()).toHaveLength(1);
  await f.select(7); f.status.mockClear(); f.release(); await flush(); await flush();
  expect(f.raw.heroDetail.hero_id).toBe(7); expect(f.raw.heroDetail.force_add).toBeUndefined();
  expect(f.status).not.toHaveBeenCalled(); expect(f.button("add").disabled).toBe(true);
  await f.select(8); expect(f.raw.heroDetail.force_add).toBe(action === "add" ? 1 : 0);
  expect(f.button("add").disabled).toBe(false);
});
