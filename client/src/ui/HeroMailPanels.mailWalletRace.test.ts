import { afterEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { MainCityScene } from "@/scenes/MainCityScene";
import { CityStateFetch } from "@/net/cityStateFetch";
import { CityStatePoll } from "@/net/cityStatePoll";
import { beginAssetRead, captureAssetRead } from "@/net/questClaimAssets";
import { GatewayClient, type GatewayPort } from "@/net/GatewayClient";
import { getTypes } from "@/net/loadProto";
import type { MainCitySession } from "@/net/bootstrapSession";

const flush = () => new Promise(r => setTimeout(r, 0));
function deferred() {
  let resolve!: (v: any) => void, reject!: (e: Error) => void;
  const promise = new Promise<any>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const panels: HeroMailPanels[] = [];
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.replaceChildren(); });
async function setup() {
  let generation = 1;
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, buildings: [], cityTroops: [],
    wallet: { food: 10, gold: 9 }, bag: [] } as MainCitySession;
  const mails = [7, 8].map(mail_id => ({ mail_id, title: `Mail ${mail_id}`, status: 1,
    has_unclaimed_attachments: true, attachments: { resources: { food: 20 } } }));
  const gateway = {
    getSessionId: () => "session", getSessionGeneration: () => generation, getBoundServerId: () => 1,
    listPlayerMail: vi.fn(async (_sid: number, options: { pageSize?: number }) => options.pageSize === 1
      ? { mails: [], total_count: 0 } : { mails, total_count: 2 }),
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    claimPlayerMailAttachments: vi.fn(), getCityState: vi.fn(),
  };
  const port = gateway as unknown as GatewayPort;
  const mount = document.createElement("div"), hud = document.createElement("div");
  document.body.append(mount, hud);
  const scene = new MainCityScene() as unknown as Record<string, any>;
  // Keep real city application/patchSession; only unrelated rendering is replaced.
  Object.assign(scene, { session, gateway: port, hud, renderHud: () => { hud.textContent = `${session.wallet.food}`; },
    syncMilitaryPanel: vi.fn() });
  const fetch = new CityStateFetch(port, () => session.cityId,
    () => `${gateway.getSessionId()}:${session.serverId}:${session.player.player_id}`);
  scene.cityStateFetch = fetch;
  const status = vi.fn();
  const panel = new HeroMailPanels(mount, port, () => session, patch => scene.patchSession(patch), status);
  panels.push(panel); panel.attach(); panel.toggleMail(); await flush();
  const poll = new CityStatePoll({ fetch, isPanelVisible: () => panel.isMailOpen(),
    onState: state => scene.applyCityStatePoll(state) });
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const start = (mode = "single") => {
    if (mode === "batch") mount.querySelectorAll<HTMLInputElement>('[data-role="mail-batch-checkbox"]').forEach(cb => cb.click());
    click(mode === "single" ? "claim-mail" : `claim-mail-${mode}`);
  };
  const receipt = (mail_id = 7, food = 30) => ({ mail: { mail_id, status: 2, has_unclaimed_attachments: false },
    wallet_after: { food, gold: 0 }, bag_items: [], granted: { resources: { food: 20 } } });
  return { session, gateway, port, panel, poll, fetch, scene, hud, status, start, click, receipt,
    relogin: () => generation++ };
}

it.each(["before", "during"])("a city read started %s the claim cannot roll back its receipt", async when => {
  const f = await setup(), claim = deferred(), city = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise);
  f.gateway.getCityState.mockReturnValueOnce(city.promise);
  let pending: Promise<void>;
  if (when === "before") { pending = f.poll.pollOnce(); f.start(); }
  else { f.start(); pending = f.poll.pollOnce(); }
  claim.resolve(f.receipt()); await flush();
  expect(f.session.wallet).toEqual({ food: 30, gold: 0 }); expect(f.hud.textContent).toBe("30");
  city.resolve({ wallet: { food: 10, gold: 0 } }); await pending;
  expect(f.session.wallet.food).toBe(30); expect(f.hud.textContent).toBe("30");
  f.gateway.getCityState.mockResolvedValueOnce({ wallet: { food: 31, gold: 0 } });
  await f.poll.pollOnce(); expect(f.session.wallet).toMatchObject({ food: 31, gold: 0 });
});

it("invalidates a decoded pre-claim snapshot before MainCityScene consumes it", async () => {
  const f = await setup(), claim = deferred();
  f.gateway.getCityState.mockResolvedValueOnce({ wallet: { food: 10 } });
  const decoded = await f.fetch.fetch();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise); f.start();
  expect(f.fetch.isCurrent(decoded!)).toBe(false);
  claim.resolve(f.receipt()); await flush(); f.scene.applyCityStatePoll(decoded);
  expect(f.hud.textContent).toBe("30");
});

it.each(["success", "reject"])("hidden %s settles the mutation and permits a later fresh read", async outcome => {
  const f = await setup(), claim = deferred(), city = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise);
  const before = captureAssetRead(f.port); f.start(); expect(before()).toBe(false);
  f.gateway.getCityState.mockReturnValueOnce(city.promise); const pending = f.poll.pollOnce();
  f.panel.toggleMail(); expect(f.panel.isMailOpen()).toBe(false);
  if (outcome === "success") claim.resolve(f.receipt()); else claim.reject(new Error("claim rejected"));
  await flush(); city.resolve({ wallet: { food: 1 } }); await pending;
  expect(f.session.wallet.food).toBe(outcome === "success" ? 30 : 10);
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  if (outcome === "reject") expect(f.status).toHaveBeenLastCalledWith("claim rejected");
  f.gateway.getCityState.mockResolvedValueOnce({ wallet: { food: 42 } });
  await f.poll.pollOnce(); expect(f.session.wallet.food).toBe(42);
});

it.each(["single", "batch", "all"])("%s claims use both mutation boundaries without duplicate dispatch", async mode => {
  const f = await setup(), first = deferred(), second = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const before = captureAssetRead(f.port); f.start(mode); expect(before()).toBe(false);
  f.click("claim-mail"); f.click("claim-mail-all");
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  const during = captureAssetRead(f.port); first.resolve(f.receipt()); await flush(); expect(during()).toBe(false);
  if (mode !== "single") {
    expect(f.gateway.claimPlayerMailAttachments.mock.calls).toEqual([[1, 7], [1, 8]]);
    const next = captureAssetRead(f.port); second.resolve(f.receipt(8, 50)); await flush(); expect(next()).toBe(false);
  }
  expect(f.session.wallet.food).toBe(mode === "single" ? 30 : 50);
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(1);
});

it.each(["player", "city", "server", "relogin"])("old actor %s cannot patch or invalidate new reads or continue batch", async change => {
  const f = await setup(), claim = deferred(), city = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise); f.start("all");
  if (change === "player") f.session.player.player_id = 2;
  else if (change === "city") f.session.cityId = 2;
  else if (change === "server") f.session.serverId = 2;
  else f.relogin();
  f.session.wallet = { food: 70, gold: 8 }; const current = beginAssetRead(f.port);
  f.gateway.getCityState.mockReturnValueOnce(city.promise); const pending = f.poll.pollOnce(); f.status.mockClear();
  claim.resolve(f.receipt()); await flush();
  expect(f.session.wallet).toEqual({ food: 70, gold: 8 }); expect(current()).toBe(true);
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  expect(f.gateway.listPlayerBag).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled();
  city.resolve({ wallet: { food: 71 } }); await pending; expect(f.session.wallet.food).toBe(71);
});

it("rejected old single claim does not report its error in the new actor", async () => {
  const f = await setup(), claim = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise); f.start(); f.relogin();
  const current = beginAssetRead(f.port); f.status.mockClear(); claim.reject(new Error("old failure")); await flush();
  expect(current()).toBe(true); expect(f.status).not.toHaveBeenCalled();
});

it("a newer asset observation supersedes receipt assets without losing confirmed mail state", async () => {
  const f = await setup(), claim = deferred();
  f.gateway.claimPlayerMailAttachments.mockReturnValueOnce(claim.promise); f.start();
  beginAssetRead(f.port); f.session.wallet = { food: 80, gold: 7 };
  claim.resolve(f.receipt()); await flush();
  expect(f.session.wallet).toEqual({ food: 80, gold: 7 });
  expect(f.gateway.claimPlayerMailAttachments).toHaveBeenCalledTimes(1);
  expect(f.panel.getMailRoot().querySelector('[data-action="claim-mail"]')?.classList.contains("hidden")).toBe(true);
});

it.each(["bag", "unread"])("actor change during follow-up %s read cannot patch or report completion", async phase => {
  const f = await setup(), read = deferred();
  f.gateway.claimPlayerMailAttachments.mockResolvedValueOnce(f.receipt());
  if (phase === "bag") f.gateway.listPlayerBag.mockReturnValueOnce(read.promise);
  else f.gateway.listPlayerMail.mockReturnValueOnce(read.promise);
  f.start(); await flush(); f.relogin(); f.session.bag = [{ item_cfg_id: 2001, quantity: 99 }];
  f.status.mockClear();
  read.resolve(phase === "bag" ? { items: [{ item_cfg_id: 2001, quantity: 1 }] } : { mails: [], total_count: 4 });
  await flush(); expect(f.session.bag).toEqual([{ item_cfg_id: 2001, quantity: 99 }]);
  expect(f.status).not.toHaveBeenCalled();
});

it("partial batch failure retains success, reports failure, and allows explicit retry", async () => {
  const f = await setup();
  f.gateway.claimPlayerMailAttachments.mockRejectedValueOnce(new Error("rejected"))
    .mockResolvedValueOnce(f.receipt(8, 30));
  f.start("all"); await flush();
  expect(f.session.wallet.food).toBe(30); expect(f.status.mock.lastCall?.[0]).toContain("rejected");
  f.gateway.claimPlayerMailAttachments.mockResolvedValueOnce(f.receipt(7, 50));
  f.start(); await flush(); expect(f.gateway.claimPlayerMailAttachments.mock.calls).toEqual([[1, 7], [1, 8], [1, 7]]);
  expect(f.session.wallet.food).toBe(50);
});


it.each(["success", "unknown"])("production protobuf claim fences city reads on %s", async outcome => {
  const types = getTypes(), gateway = new GatewayClient(), claim = deferred(), city = deferred();
  const packet = (name: keyof typeof types, value: object) => Uint8Array.from(types.ServerPacket.encode({
    code: 0, data: types[name].encode(value).finish(),
  }).finish()).buffer;
  const routes: string[] = [];
  const send = vi.spyOn(gateway as never, "sendAndWait").mockImplementation((wire: Uint8Array) => {
    const req = types.ClientPacket.decode(wire) as unknown as { route: string; payload: Uint8Array };
    const name = req.route.split(".").at(-1)!; routes.push(name);
    if (name === "ClaimPlayerMailAttachments") {
      const body = types.ClaimPlayerMailAttachmentsRequest.decode(req.payload) as unknown as { server_id: number; mail_id: number };
      expect(body.server_id).toBe(1); expect(Number(body.mail_id)).toBe(7); return claim.promise;
    }
    if (name === "GetCityState") return city.promise;
    const fixtures: Record<string, object> = { Login: { session_id: "token" }, ListPlayerBag: { items: [] },
      ListPlayerMail: { mails: [{ mail_id: 7, title: "Mail", status: 1, has_unclaimed_attachments: true,
        attachments: { resources: { food: 20 } } }], total_count: 1 } };
    expect(fixtures[name], name).toBeDefined();
    return Promise.resolve(packet(`${name}Response` as keyof typeof types, fixtures[name]));
  });
  try {
    await gateway.login("fixture", "not-stored", 1);
    const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { food: 10, gold: 9 },
      bag: [], buildings: [], cityTroops: [] } as MainCitySession;
    const mount = document.createElement("div"); document.body.append(mount);
    const panel = new HeroMailPanels(mount, gateway, () => session, patch => Object.assign(session, patch), () => {});
    panels.push(panel); panel.attach(); panel.toggleMail(); await flush();
    mount.querySelector<HTMLButtonElement>('[data-action="claim-mail"]')!.click();
    const fetch = new CityStateFetch(gateway, () => 1), pending = fetch.fetch();
    if (outcome === "success") claim.resolve(packet("ClaimPlayerMailAttachmentsResponse", {
      mail: { mail_id: 7, status: 2 }, wallet_after: { food: 30, gold: 0 },
    })); else claim.reject(new Error("gateway timeout"));
    await flush(); city.resolve(packet("GetCityStateResponse", { wallet: { food: 10 } }));
    expect(await pending).toBeNull();
    expect(session.wallet.food).toBe(outcome === "success" ? 30 : 10);
    expect(session.wallet.gold).toBe(outcome === "success" ? 0 : 9);
    expect(routes.filter(r => r === "ClaimPlayerMailAttachments")).toHaveLength(1);
  } finally { send.mockRestore(); }
});
