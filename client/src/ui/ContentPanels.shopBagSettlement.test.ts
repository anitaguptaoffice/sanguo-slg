import { afterEach, beforeEach, expect, it } from "vitest";
import { ContentPanels } from "./ContentPanels";
import { GatewayClient } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { getProtoRoot } from "@/net/loadProto";
import { beginAssetRead } from "@/net/questClaimAssets";
import { openCenterPanel } from "./centerPanelForeground";

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const cleanup: Array<() => void> = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); document.body.replaceChildren(); });
async function setup(purchase = true) {
  const root = getProtoRoot(), cp = root.lookupType("sanguo.common.v1.ClientPacket"), sp = root.lookupType("sanguo.common.v1.ServerPacket");
  const queue: Array<{ route: string; trace_id: string }> = [], sent: string[] = [], delivered: string[] = [];
  const ws = Object.assign(new EventTarget(), { readyState: WebSocket.OPEN, send(packet: Uint8Array) {
    const req = cp.decode(packet) as unknown as { route: string; trace_id: string };
    queue.push(req); sent.push(req.route);
  }, close() {} });
  const gateway = new GatewayClient();
  Object.assign(gateway, { ws, sessionId: "fixture-session", boundServerId: 1, sessionGeneration: 1 });
  const session = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { gold: 10, food: 100 }, bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const mount = document.createElement("div"); document.body.append(mount);
  const panels = new ContentPanels(mount, gateway, () => session, patch => Object.assign(session, patch), () => {});
  panels.attach(); cleanup.push(() => { panels.detach(); gateway.close(); });
  const reply = async (route: string, typeName: string, value: object, code = 0) => {
    const req = queue.shift(); expect(req?.route).toBe(route); delivered.push(route);
    const type = root.lookupType(typeName), data = type.encode(type.fromObject(value)).finish();
    const bytes = sp.encode(sp.fromObject({ trace_id: req!.trace_id, code, data, message: "fixture failure" })).finish();
    ws.dispatchEvent(new MessageEvent("message", { data: Uint8Array.from(bytes).buffer })); await flush();
  };
  const shelf = { offers: [{ offer_id: 1001, item_cfg_id: 2001, quantity_per_purchase: 1, price_resources: { gold: 10 } }] };
  const shelfReply = () => reply("shop.v1.ListShopShelf", "sanguo.shop.v1.ListShopShelfResponse", shelf);
  const bagReply = (code = 0) => reply("content.v1.ListPlayerBag", "sanguo.content.v1.ListPlayerBagResponse", { items: [{ item_cfg_id: 2001, quantity: 1 }] }, code);
  const purchaseReply = (code = 0) => reply("shop.v1.PurchaseShopOffer", "sanguo.shop.v1.PurchaseShopOfferResponse",
    { wallet_after: { gold: 0, food: 100 }, granted_items: { items: [{ item_cfg_id: 2001, quantity: 1 }] } }, code);
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  panels.toggleShop(); await shelfReply(); expect(button("buy-offer").disabled).toBe(false);
  if (purchase) button("buy-offer").click();
  return { panels, gateway, session, mount, sent, delivered, queue, button, reply, shelfReply, bagReply, purchaseReply };
}

it("retains confirmed zero gold across bag navigation with FIFO protobuf replies", async () => {
  const f = await setup(); f.panels.toggleBag();
  expect(f.panels.getBagRoot().classList.contains("hidden")).toBe(false);
  expect(f.queue.map(r => r.route)).toEqual(["shop.v1.PurchaseShopOffer"]);
  await f.purchaseReply(); expect(f.session.wallet.gold).toBe(0);
  await f.bagReply(); expect(f.session.bag).toEqual([{ item_cfg_id: 2001, quantity: 1 }]);
  f.panels.toggleShop(); await f.bagReply();
  await f.reply("domestic.v1.GetCityState", "sanguo.domestic.v1.GetCityStateResponse", { wallet: { food: 105 } });
  await f.shelfReply(); expect(f.session.wallet).toMatchObject({ gold: 0, food: 105 });
  expect(f.button("buy-offer").disabled).toBe(true); expect(f.delivered).toEqual(f.sent);
  expect(f.sent.filter(route => route === "shop.v1.PurchaseShopOffer")).toHaveLength(1);
});

it.each(["repeat", "reopen", "deep-link"])("coalesces current %s bag intent after settlement", async kind => {
  const f = await setup(); f.panels.toggleBag();
  if (kind === "repeat") { f.button("refresh-bag").click(); f.button("refresh-bag").click(); }
  if (kind === "reopen") { f.panels.toggleBag(); f.panels.toggleBag(); }
  if (kind === "deep-link") f.panels.openBagFromShopDeepLink(2001);
  expect(f.queue).toHaveLength(1); await f.purchaseReply();
  expect(f.queue.map(r => r.route)).toEqual(["content.v1.ListPlayerBag"]);
  await f.bagReply(); expect(f.session.wallet.gold).toBe(0);
  expect(f.sent.filter(route => route === "content.v1.ListPlayerBag")).toHaveLength(1);
});

it.each(["close", "peer", "actor", "relogin", "detach", "remount"])("drops obsolete waiting reads after %s", async kind => {
  const f = await setup(); f.panels.toggleBag();
  if (kind === "close") f.panels.toggleBag();
  if (kind === "peer") { const peer = document.createElement("div"); peer.className = "content-panel hidden"; f.mount.append(peer); openCenterPanel(peer); }
  if (kind === "actor") f.session.player = { player_id: 2 };
  if (kind === "relogin") Object.assign(f.gateway, { sessionGeneration: 2 });
  if (kind === "detach" || kind === "remount") f.panels.detach();
  if (kind === "remount") f.panels.attach();
  await f.purchaseReply(); expect(f.queue).toHaveLength(0);
  expect(f.session.wallet.gold).toBe(["actor", "relogin", "detach", "remount"].includes(kind) ? 10 : 0);
  expect(f.sent.filter(route => route === "content.v1.ListPlayerBag")).toHaveLength(0);
});

it.each([64001, 10002])("releases bag reads after rejection %s without replaying purchase", async code => {
  const f = await setup(); f.panels.toggleBag(); expect(f.queue).toHaveLength(1);
  await f.purchaseReply(code); await f.bagReply(); expect(f.session.wallet.gold).toBe(10);
  expect(f.sent.filter(route => route === "shop.v1.PurchaseShopOffer")).toHaveLength(1);
  expect(f.panels.getBagRoot().classList.contains("hidden")).toBe(false);
});

it("retains confirmed gold after bag failure and permits only read retry", async () => {
  const f = await setup(); f.panels.toggleBag(); await f.purchaseReply(); await f.bagReply(10002);
  expect(f.session.wallet.gold).toBe(0); f.button("refresh-bag").click(); await f.bagReply();
  expect(f.session.bag).toEqual([{ item_cfg_id: 2001, quantity: 1 }]);
  expect(f.sent.filter(route => route === "shop.v1.PurchaseShopOffer")).toHaveLength(1);
});

it("preserves receipt protection against unrelated asset supersession", async () => {
  const f = await setup(); f.panels.toggleBag(); beginAssetRead(f.gateway);
  await f.purchaseReply(); await f.bagReply(); expect(f.session.wallet.gold).toBe(10);
});


it.each([0, 10002])("clears deferred loading after unknown-use recovery settles with code %s", async code => {
  const f = await setup(false); f.panels.toggleBag(); await f.bagReply(); f.button("use-item").click();
  await f.reply("content.v1.UseConsumable", "sanguo.content.v1.UseConsumableResponse", {}, 10002);
  expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("结果未知");
  f.panels.toggleShop(); await f.shelfReply(); f.button("buy-offer").click(); f.panels.toggleBag();
  expect(f.queue.map(r => r.route)).toEqual(["shop.v1.PurchaseShopOffer"]); await f.purchaseReply(64001);
  await f.reply("content.v1.ListPlayerBag", "sanguo.content.v1.ListPlayerBagResponse", { items: [] }, code);
  await f.reply("domestic.v1.GetCityState", "sanguo.domestic.v1.GetCityStateResponse", { wallet: { food: 1100 } });
  expect(f.mount.querySelector('[data-role="bag-list"]')?.textContent).not.toContain("加载");
  expect(f.session.bag).toEqual(code ? [{ item_cfg_id: 2001, quantity: 1 }] : []);
  if (code) expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("资产待同步");
  expect(f.sent.filter(route => route === "shop.v1.PurchaseShopOffer")).toHaveLength(1);
  expect(f.sent.filter(route => route === "content.v1.UseConsumable")).toHaveLength(1);
});

it.each(["close", "remount", "peer"].flatMap(kind => [0, 10002].map(code => [kind, code] as const)))(
  "clears abandoned waiting state after %s and recovery code %s", async (kind, code) => {
    const f = await setup(false); f.panels.toggleBag(); await f.bagReply(); f.button("use-item").click();
    await f.reply("content.v1.UseConsumable", "sanguo.content.v1.UseConsumableResponse", {}, 10002);
    f.panels.toggleShop(); await f.shelfReply(); f.button("buy-offer").click(); f.panels.toggleBag();
    expect(f.queue.map(r => r.route)).toEqual(["shop.v1.PurchaseShopOffer"]);
    if (kind === "close") f.panels.toggleBag();
    if (kind === "remount") { f.panels.detach(); f.panels.attach(); }
    if (kind === "peer") { const peer = document.createElement("div"); peer.className = "content-panel hidden"; f.mount.append(peer); openCenterPanel(peer); }
    await f.purchaseReply(64001); expect(f.queue).toHaveLength(0);
    const recover = async (result: number) => {
      expect(f.queue.map(r => r.route)).toEqual(["content.v1.ListPlayerBag", "domestic.v1.GetCityState"]);
      await f.reply("content.v1.ListPlayerBag", "sanguo.content.v1.ListPlayerBagResponse", { items: [] }, result);
      await f.reply("domestic.v1.GetCityState", "sanguo.domestic.v1.GetCityStateResponse", { wallet: { food: 1100 } });
      expect(f.mount.querySelector('[data-role="bag-list"]')?.textContent).not.toContain("加载");
    };
    f.panels.toggleBag(); await recover(code);
    if (code) {
      expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("资产待同步");
      f.button("refresh-bag").click(); await recover(0);
    }
    expect(f.session.bag).toEqual([]); expect(f.session.wallet.food).toBe(1100);
    expect(f.delivered).toEqual(f.sent); expect(f.queue).toHaveLength(0);
    expect(f.sent.filter(route => route === "shop.v1.PurchaseShopOffer")).toHaveLength(1);
    expect(f.sent.filter(route => route === "content.v1.UseConsumable")).toHaveLength(1);
});
