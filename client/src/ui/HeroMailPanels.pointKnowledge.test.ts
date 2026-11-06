import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes } from "@/net/loadProto";
import type { MainCitySession } from "@/net/bootstrapSession";

const types = getTypes();
const panels: HeroMailPanels[] = [];
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => sessionStorage.clear());
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; vi.restoreAllMocks(); });

async function freshPanel(savedAllocated: number, clearFails = false) {
  let allocated = savedAllocated;
  const routes: string[] = [];
  const gateway = new GatewayClient();
  const attributes = () => ({ force: 80 + allocated, intel: 83, politics: 98, command: 86 });
  const packet = (name: string, value: object) => Uint8Array.from(types.ServerPacket.encode({
    code: 0, data: types[name as keyof typeof types].encode(value).finish(),
  }).finish()).buffer;
  vi.spyOn(gateway as never, "sendAndWait").mockImplementation(async (wire: Uint8Array) => {
    const request = types.ClientPacket.decode(wire) as unknown as { route: string; payload: Uint8Array };
    const method = request.route.split(".").at(-1)!;
    routes.push(method);
    if (method === "AddHeroPoint") {
      const add = types.AddHeroPointRequest.decode(request.payload) as unknown as { hero_id: number; force: number; intel: number; politics: number };
      expect(Number(add.hero_id)).toBe(7);
      expect(add.force).toBe(attributes().force + 1);
      expect(add.intel).toBe(attributes().intel);
      expect(add.politics).toBe(attributes().politics);
      if (allocated === 3) return Uint8Array.from(types.ServerPacket.encode({ code: 1, msg: "hero: insufficient potential points" }).finish()).buffer;
      allocated++;
      return packet("AddHeroPointResponse", { hero_id: 7, potential_remaining: 3 - allocated,
        force_add: allocated, intel_add: 0, politics_add: 0, attributes: attributes() });
    }
    if (method === "ClearHeroPoint") {
      if (clearFails) throw new Error("reply unavailable");
      allocated = 0;
      return packet("ClearHeroPointResponse", { hero_id: 7, potential_remaining: 3,
        force_add: 0, intel_add: 0, politics_add: 0, attributes: attributes() });
    }
    const fixtures: Record<string, object> = {
      Login: { session_id: "local-test-session" },
      ListPlayerHeroes: { heroes: [{ hero_id: 7, template_cfg_id: 1001, level: 3, loyalty: 80 }], total_count: 1 },
      GetHeroDetail: { hero_id: 7, template_cfg_id: 1001, template_name: "Existing hero", level: 3,
        loyalty: 80, attributes: attributes(), exp: 300, exp_toward_next: 0, upgrade_exp_required: 300 },
      ListPlayerBag: { items: [] }, ListRecruitTemplates: { templates: [] },
      ListHotelRecruitCandidates: { candidates: [] }, ListCaptiveHeroes: { captives: [] },
      ListPersuadeTargets: { targets: [] }, ListComingHeroes: { coming: [] },
    };
    expect(fixtures[method], `unexpected route ${method}`).toBeDefined();
    return packet(`${method}Response`, fixtures[method]);
  });
  await gateway.login("local-test", "not-a-real-credential", 1);
  const wireDetail = await gateway.getHeroDetail(1, 7);
  expect(wireDetail.attributes?.force).toBe(80 + savedAllocated);
  expect(wireDetail.force_add).toBeUndefined();
  expect(wireDetail.potential_remaining).toBeUndefined();
  const session: MainCitySession = { serverId: 1, cityId: 1, cityName: "City", player: { player_id: 1 },
    wallet: {}, bag: [], buildings: [], cityTroops: [] };
  const mount = document.createElement("div"); document.body.append(mount);
  const status = vi.fn();
  const panel = new HeroMailPanels(mount, gateway, () => session, () => {}, status);
  panels.push(panel); panel.attach(); panel.toggleHero(); await flush();
  mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  const add = () => mount.querySelector<HTMLButtonElement>('[data-action="hero-point-add"][data-stat="force"]')!;
  const clear = () => mount.querySelector<HTMLButtonElement>('[data-action="hero-point-clear"]')!;
  return { routes, panel, mount, status, add, clear, allocated: () => allocated };
}

it("a fully allocated saved hero can explicitly reset after a new panel loses receipt memory", async () => {
  const f = await freshPanel(3);
  expect(f.add().disabled).toBe(false);
  expect(f.routes).not.toContain("ClearHeroPoint");
  expect(f.mount.querySelector('[data-role="hero-point-summary"]')?.textContent).toContain("潜力分配未知");
  f.add().click(); await flush();
  expect(f.allocated()).toBe(3);
  expect(f.routes.filter(r => r === "AddHeroPoint")).toHaveLength(1);
  expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("潜力点不足"));
  expect(f.clear().disabled, "GetHeroDetail omitted allocation, it did not confirm zero allocated").toBe(false);
  f.clear().click(); f.clear().click(); await flush();
  expect(f.routes.filter(r => r === "ClearHeroPoint")).toHaveLength(1);
  expect(f.allocated()).toBe(0);
  expect(f.clear().disabled).toBe(true);
  expect(f.mount.querySelector('[data-role="hero-point-summary"]')?.textContent).toContain("剩余 3/3");
  f.add().click(); await flush();
  expect(f.allocated()).toBe(1);
});

it("unknown partial allocation must still allow a server-validated +1 without forcing reset", async () => {
  const f = await freshPanel(1);
  expect(f.add().disabled).toBe(false);
  expect(f.routes).not.toContain("ClearHeroPoint");
  expect(f.mount.querySelector('[data-role="hero-point-summary"]')?.textContent).toContain("潜力分配未知");
  f.add().click(); await flush();
  expect(f.allocated()).toBe(2);
  expect(f.routes.filter(r => r === "ClearHeroPoint")).toHaveLength(0);
  expect(f.clear().disabled).toBe(false);
  expect(f.mount.querySelector('[data-role="hero-point-summary"]')?.textContent).toContain("剩余 1/3");
});

it("a failed explicit reset does not invent allocation or automatically retry", async () => {
  const f = await freshPanel(3, true);
  f.clear().click(); await flush();
  expect(f.routes.filter(r => r === "ClearHeroPoint")).toHaveLength(1);
  expect(f.allocated()).toBe(3);
  expect(f.clear().disabled).toBe(false);
  expect(f.mount.querySelector('[data-role="hero-point-summary"]')?.textContent).toContain("潜力分配未知");
  await flush();
  expect(f.routes.filter(r => r === "ClearHeroPoint")).toHaveLength(1);
});
