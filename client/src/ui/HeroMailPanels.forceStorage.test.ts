import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { HERO_MARCH_FORCE_SESSION_KEY, clearHeroMarchForceSession, readHeroMarchForceSession } from "@/net/heroMarchForceSession";
import { validateMarchHeroMarchForce } from "@/net/heroDetailForce";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let panel: HeroMailPanels;
beforeEach(() => sessionStorage.clear());
afterEach(() => { vi.restoreAllMocks(); panel?.detach(); document.body.innerHTML = ""; sessionStorage.clear(); });
const detail = (force = 5) => ({ hero_id: 7, template_cfg_id: 1001, template_name: "Hero 7", level: 1, status: 1, march_force: force, march_force_max: 24 });
async function setup() {
  const gateway = { getSessionId: () => "a", getSessionGeneration: () => 1, getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })), listPlayerHeroes: vi.fn(async () => ({ heroes: [detail()], total_count: 1 })),
    getHeroDetail: vi.fn(async () => detail()), restHero: vi.fn(async () => ({ hero_id: 7, march_force: 24, march_force_max: 24 })) };
  const mount = document.createElement("div"); document.body.append(mount);
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const status = vi.fn(); panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, () => {}, status);
  panel.attach(); panel.toggleHero(); await flush();
  const click = () => mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click();
  return { gateway, mount, status, click, raw: panel as unknown as Record<string, any> };
}
function failForceStorage(method: "getItem" | "setItem") {
  const original = Storage.prototype[method];
  return vi.spyOn(Storage.prototype, method).mockImplementation(function(this: Storage, key: string, value?: string) {
    if (key === HERO_MARCH_FORCE_SESSION_KEY) throw new DOMException("storage unavailable", method === "setItem" ? "QuotaExceededError" : "SecurityError");
    return original.call(this, key, value!);
  });
}
it.each(["getItem", "setItem"] as const)("successful detail remains visible when cache %s fails", async method => {
  const f = await setup(); failForceStorage(method); f.click(); await flush();
  expect(f.raw.heroDetail?.hero_id).toBe(7); expect(f.raw.heroDetailError).toBeNull();
  expect(f.mount.querySelector('[data-role="hero-force-summary"]')?.textContent).toContain("5/24");
  expect(f.status).toHaveBeenLastCalledWith("详情已加载");
  expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(1);
});
it.each(["getItem", "setItem"] as const)("successful rest is not reported as failure when cache %s fails", async method => {
  const f = await setup(); f.click(); await flush(); const storageFailure = failForceStorage(method);
  f.mount.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]')!.click(); await flush();
  expect(f.raw.heroDetail.march_force).toBe(24); expect(f.raw.heroForceSubmitState).toBe("idle");
  expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("休整成功"));
  expect(f.gateway.restHero).toHaveBeenCalledTimes(1);
  storageFailure.mockRestore(); expect(validateMarchHeroMarchForce(7)).toEqual({ ok: true });
});
it("a failed clear still fences delayed rest without replaying it", async () => {
  const f = await setup(); f.click(); await flush();
  let resolve!: (value: any) => void; f.gateway.restHero.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  f.mount.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]')!.click();
  const storageFailure = failForceStorage("setItem"); clearHeroMarchForceSession(7); storageFailure.mockRestore();
  f.gateway.getHeroDetail.mockResolvedValueOnce(detail(14)); resolve({ hero_id: 7, march_force: 24, march_force_max: 24 }); await flush(); await flush();
  expect(f.raw.heroDetail.march_force).toBe(14); expect(readHeroMarchForceSession(7)?.current).toBe(14);
  expect(f.gateway.restHero).toHaveBeenCalledTimes(1); expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(2);
});
