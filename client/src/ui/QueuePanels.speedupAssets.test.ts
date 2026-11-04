import { afterEach, expect, it, vi } from "vitest";
import { QueuePanels } from "./QueuePanels";
import { useBagItemWithAssets } from "@/net/bagUseAssets";
import { beginAssetRead } from "@/net/questClaimAssets";
const flush = () => new Promise((r) => setTimeout(r, 0));
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
const panels: QueuePanels[] = []; afterEach(() => panels.splice(0).forEach((p) => p.detach()));
function setup() {
  let generation = 1;
  const session: any = { serverId: 1, player: {player_id: 1}, cityId: 1, buildings: [{slot_key: "farm", level: 1, upgrade_finish_at_ms: Date.now()+120000}], bag: [{item_cfg_id: 2003, quantity: 5}], wallet: {gold: 10, food: 10}, cityTroops: [] };
  const gateway = { getSessionGeneration: () => generation, useConsumable: vi.fn().mockResolvedValue({remaining: 4, wallet_after: {gold: 10, food: 10}}), getCityState: vi.fn().mockResolvedValue({wallet: {food: 10, gold: 0}}), listPlayerBag: vi.fn().mockResolvedValue({items: [{item_cfg_id: 2003, quantity: 3}]}) };
  const mount = document.createElement("div"), status = vi.fn();
  const panel = new QueuePanels(mount, gateway as never, () => session, {farm: "农田"}, status, vi.fn(), vi.fn()); panels.push(panel); panel.attach(); panel.open();
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const disabled = () => mount.querySelector<HTMLButtonElement>('[data-action="speedup-build"]')?.disabled ?? true;
  const message = () => mount.querySelector('[data-role="queue-status"]')!.textContent;
  return {session, gateway, panel, click, disabled, message, status, relogin: () => generation++};
}
it("late queue receipt cannot restore inventory after a newer bag use", async () => {
  const s = setup(), old = deferred(); s.gateway.useConsumable.mockReturnValueOnce(old.promise); s.click("speedup-build");
  s.gateway.useConsumable.mockResolvedValueOnce({remaining: 3, wallet_after: {gold: 10, food: 10}});
  await useBagItemWithAssets(s.gateway as never, 2003, 1, () => s.session, (p) => Object.assign(s.session,p), () => true);
  expect(s.session.bag[0].quantity).toBe(3); old.resolve({remaining: 4}); await flush(); await flush();
  expect(s.session.bag[0].quantity).toBe(3); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(2);
});
it("fresh confirmed full wallet receipt accepts genuine gold zero", async () => {
  const s = setup(); s.gateway.useConsumable.mockResolvedValueOnce({remaining: 4, wallet_after: {gold: 0, food: 10}});
  s.click("speedup-build"); await flush(); expect(s.session.wallet.gold).toBe(0); expect(s.session.bag[0].quantity).toBe(4);
});
it("city read begun before consumption cannot undo newer asset values", async () => {
  const s = setup(), old = deferred(); s.gateway.getCityState.mockReturnValueOnce(old.promise); s.click("refresh-queue");
  await useBagItemWithAssets(s.gateway as never, 2003, 1, () => s.session, (p) => Object.assign(s.session,p), () => true);
  s.session.wallet = {gold: 10, food: 30}; old.resolve({wallet: {gold: 0, food: 1}}); await flush(); expect(s.session.wallet.food).toBe(30);
});
it("unknown use blocks repeats until explicit read-only recovery", async () => {
  const s = setup(); s.gateway.useConsumable.mockRejectedValueOnce(new Error("timeout")); s.click("speedup-build"); await flush();
  expect(s.message()).toContain("结果未知"); expect(s.disabled()).toBe(true); s.click("speedup-build"); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
  s.click("refresh-queue"); await flush(); await flush(); expect(s.gateway.listPlayerBag).toHaveBeenCalledTimes(1); expect(s.session.bag[0].quantity).toBe(3);
  expect(s.disabled()).toBe(false); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
it("failed explicit recovery preserves guard and retries only reads", async () => {
  const s = setup(); s.gateway.useConsumable.mockRejectedValueOnce(new Error("timeout")); s.click("speedup-build"); await flush();
  s.gateway.listPlayerBag.mockRejectedValueOnce(new Error("offline")); s.click("refresh-queue"); await flush(); expect(s.disabled()).toBe(true);
  s.click("refresh-queue"); await flush(); await flush(); expect(s.disabled()).toBe(false); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
it("successful use followed by failed city refresh never becomes unknown or replays", async () => {
  const s = setup(); s.gateway.getCityState.mockRejectedValueOnce(new Error("offline")); s.click("speedup-build"); await flush();
  expect(s.session.bag[0].quantity).toBe(4); expect(s.message()).not.toContain("结果未知"); s.click("refresh-queue"); await flush(); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
it.each(["bag", "wallet", "epoch"])("stale receipt with %s change and failed reconciliation is guarded", async (change) => {
  const s = setup(), old = deferred(); s.gateway.useConsumable.mockReturnValueOnce(old.promise); s.click("speedup-build");
  if(change === "bag") s.session.bag = [{item_cfg_id: 2003, quantity: 2}]; else if(change === "wallet") s.session.wallet = {gold: 20, food: 30}; else beginAssetRead(s.gateway as never);
  const bag = s.session.bag, wallet = s.session.wallet; s.gateway.listPlayerBag.mockRejectedValueOnce(new Error("offline")); old.resolve({remaining: 4, wallet_after: {gold: 0, food: 1}}); await flush(); await flush();
  expect(s.session.bag).toBe(bag); expect(s.session.wallet).toBe(wallet); expect(s.disabled()).toBe(true); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
it.each(["relogin", "actor", "detach"])("old unknown response after %s cannot affect current view or read assets", async (change) => {
  const s = setup(), old = deferred(); s.gateway.useConsumable.mockReturnValueOnce(old.promise); s.click("speedup-build");
  if(change === "relogin") s.relogin(); else if(change === "actor") s.session.player.player_id = 2; else s.panel.detach(); s.status.mockClear();
  old.reject(new Error("old timeout")); await flush(); expect(s.status).not.toHaveBeenCalled(); expect(s.gateway.listPlayerBag).not.toHaveBeenCalled();
});
it("failed building-state stage of explicit recovery keeps the consumption guard", async () => {
  const s = setup(); s.gateway.useConsumable.mockRejectedValueOnce(new Error("timeout")); s.click("speedup-build"); await flush();
  s.gateway.getCityState.mockResolvedValueOnce({wallet: {food: 10, gold: 0}}).mockRejectedValueOnce(new Error("city offline"));
  s.click("refresh-queue"); await flush(); await flush(); expect(s.disabled()).toBe(true);
  s.click("refresh-queue"); await flush(); await flush(); expect(s.disabled()).toBe(false); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
it("closing and reopening does not silently unlock unknown consumption", async () => {
  const s = setup(); s.gateway.useConsumable.mockRejectedValueOnce(new Error("timeout")); s.click("speedup-build"); await flush();
  s.panel.toggle(); s.panel.open(); expect(s.disabled()).toBe(true); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});
