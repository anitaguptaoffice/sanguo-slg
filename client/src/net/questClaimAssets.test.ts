import { expect, it, vi } from "vitest";
import { beginAssetRead, claimQuestWithAssets, refreshQuestAssets, QUEST_ASSETS_PENDING } from "./questClaimAssets";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";
import { PROFILE_REENTRY_HINT } from "./tutorialPlayerLevel";
import { ContentPanels } from "@/ui/ContentPanels";

function fixture() {
  let generation = 1;
  let session = { serverId: 1, cityId: 1, player: { player_id: 1, level: 1 }, wallet: { gold: 5 },
    bag: [{ item_cfg_id: 2004, quantity: 1 }] } as MainCitySession;
  const gateway = {
    getSessionId: () => "same-token", getSessionGeneration: () => generation, getBoundServerId: () => 1,
    claimQuestReward: vi.fn().mockResolvedValue({ granted_rewards: { items: [{ item_cfg_id: 2004, quantity: 999 }], resources: { gold: 999 } } }),
    listPlayerBag: vi.fn().mockResolvedValue({ items: [{ item_cfg_id: 2004, quantity: 2 }] }),
    getCityState: vi.fn().mockResolvedValue({ wallet: { gold: 10 } }),
    listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }), reportQuestProgress: vi.fn(),
  } as unknown as GatewayPort;
  const get = () => session;
  const patch = vi.fn((value: Partial<MainCitySession>) => { session = { ...session, ...value }; });
  return { gateway, get, patch, switchActor: () => { generation++; session = { ...session, player: { player_id: 2 } }; },
    relogin: () => { generation++; }, claim: (id = 1002) => claimQuestWithAssets(gateway, id, get, patch) };
}
function delayed<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

it("replayed claim receipts replace authoritative bag and wallet without adding rewards", async () => {
  const f = fixture();
  await f.claim(); await f.claim();
  expect(f.get().bag).toEqual([{ item_cfg_id: 2004, quantity: 2 }]);
  expect(f.get().wallet).toEqual({ gold: 10 });
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(2);
  expect(f.gateway.getCityState).toHaveBeenCalledWith(1);
});
it.each(["listPlayerBag", "getCityState"] as const)("failed %s keeps prior snapshots and explicit pending state", async method => {
  const f = fixture(); const before = f.get();
  vi.mocked(f.gateway[method]).mockRejectedValueOnce(new Error("temporarily unavailable"));
  await expect(f.claim()).rejects.toThrow(QUEST_ASSETS_PENDING);
  expect(f.get()).toBe(before); expect(f.patch).not.toHaveBeenCalled();
  await f.claim();
  expect(f.get().wallet.gold).toBe(10);
});
it("already-completed error remains an error even after authoritative recovery", async () => {
  const f = fixture();
  const error = Object.assign(new Error("already completed"), { code: 40012 });
  vi.mocked(f.gateway.claimQuestReward).mockRejectedValue(error);
  await expect(f.claim()).rejects.toMatchObject({ code: 40012, message: expect.stringContaining("already completed") });
  expect(f.get().bag[0].quantity).toBe(2);
  expect(f.get().player.level).toBe(1);
  vi.mocked(f.gateway.listPlayerBag).mockRejectedValue(new Error("offline"));
  await expect(f.claim()).rejects.toMatchObject({ code: 40012, message: expect.stringContaining(QUEST_ASSETS_PENDING) });
});
it.each(["switchActor", "relogin"] as const)("late claim after %s issues no new reads or patches", async change => {
  const f = fixture(); const pending = delayed<object>();
  vi.mocked(f.gateway.claimQuestReward).mockReturnValue(pending.promise);
  const run = f.claim(); f[change](); pending.resolve({ granted_rewards: {} });
  expect(await run).toBeNull(); expect(f.patch).not.toHaveBeenCalled();
  expect(f.gateway.listPlayerBag).not.toHaveBeenCalled();
});
it("drops late asset reads after actor switch", async () => {
  const f = fixture(); const pending = delayed<object>();
  vi.mocked(f.gateway.getCityState).mockReturnValue(pending.promise);
  const run = refreshQuestAssets(f.gateway, f.get, f.patch);
  f.switchActor(); pending.resolve({ wallet: { gold: 999 } });
  expect(await run).toBe(false); expect(f.patch).not.toHaveBeenCalled();
});
it.each(["newer read", "newer wallet", "newer bag"])("does not overwrite %s while refresh is pending", async change => {
  const f = fixture(); const pending = delayed<object>();
  vi.mocked(f.gateway.getCityState).mockReturnValue(pending.promise);
  const run = refreshQuestAssets(f.gateway, f.get, f.patch);
  if (change === "newer read") beginAssetRead(f.gateway);
  else f.patch(change === "newer wallet" ? { wallet: { gold: 100 } } : { bag: [] });
  f.patch.mockClear(); pending.resolve({ wallet: { gold: 10 } });
  await expect(run).rejects.toThrow(QUEST_ASSETS_PENDING);
  expect(f.patch).not.toHaveBeenCalled();
});
it("tutorial UI has no Report shortcut and double claim clicks cannot submit twice", async () => {
  const f = fixture(); const pending = delayed<object>();
  vi.mocked(f.gateway.claimQuestReward).mockReturnValue(pending.promise);
  const mount = document.createElement("div"); const status = vi.fn();
  const panel = new ContentPanels(mount, f.gateway, f.get, f.patch, status); panel.attach();
  expect(mount.querySelector('[data-action="report-quest"]')).toBeNull();
  const button = mount.querySelector<HTMLButtonElement>('[data-action="claim-quest"]')!;
  button.click(); button.click();
  expect(button.disabled).toBe(true); expect(f.gateway.claimQuestReward).toHaveBeenCalledTimes(1);
  pending.resolve({ granted_rewards: { resources: { gold: 999 } } });
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(f.gateway.reportQuestProgress).not.toHaveBeenCalled();
  expect(f.get().wallet.gold).toBe(10); panel.detach();
});

it("invalidates a city read started during Claim before its delayed pre-commit wallet can apply", async () => {
  const { CityStateFetch } = await import("./cityStateFetch");
  const f = fixture(); const claim = delayed<object>(); const city = delayed<object>();
  vi.mocked(f.gateway.claimQuestReward).mockReturnValueOnce(claim.promise);
  vi.mocked(f.gateway.getCityState).mockReturnValueOnce(city.promise).mockResolvedValue({ wallet: { gold: 10 } });
  const fetcher = new CityStateFetch(f.gateway, () => 1);
  const recovering = f.claim();
  const preCommitCityRead = fetcher.fetch();
  claim.resolve({ player_level: 2, granted_rewards: { resources: { gold: 999 } } });
  await recovering;
  expect(f.get().wallet.gold).toBe(10);
  city.resolve({ wallet: { gold: 5 } });
  const stale = await preCommitCityRead;
  if (stale && fetcher.isCurrent(stale)) f.patch({ wallet: stale.wallet });
  expect(stale).toBeNull(); expect(f.get().wallet.gold).toBe(10);
});


it.each([1001, 1002, 1003, 1004, 1005, 1006, 1007])("quest %i rejection gives only the bounded profile reentry hint", async id => {
  const f = fixture();
  vi.mocked(f.gateway.claimQuestReward).mockRejectedValue(Object.assign(new Error("already completed"), {code:63007}));
  await expect(f.claim(id)).rejects.toMatchObject({code:63007,
    message:id <= 1006 ? expect.stringContaining(PROFILE_REENTRY_HINT) : "already completed"});
  expect(f.get().player.level).toBe(1); expect(f.get().bag[0].quantity).toBe(2); expect(f.get().wallet.gold).toBe(10);
  expect(f.gateway.claimQuestReward).toHaveBeenCalledTimes(1);
});
it.each([undefined, 0, 6, 20])("wall claim uses only authoritative positive scalar %s, never completed state or grant", async level => {
  const f = fixture(); f.get().player.level = 5;
  vi.mocked(f.gateway.claimQuestReward).mockResolvedValue({player_level:level,quest:{quest_cfg_id:1006,state:4},
    granted_rewards:{resources:{gold:9999},items:[{item_cfg_id:2018,quantity:999}]}});
  await f.claim(1006);
  expect(f.get().player.level).toBe(level && level > 5 ? level : 5);
  expect(f.get().wallet).toEqual({gold:10}); expect(f.get().bag).toEqual([{item_cfg_id:2004,quantity:2}]);
});
it.each(["switchActor", "relogin"] as const)("wall completion after %s cannot patch or recover another session", async change => {
  const f = fixture(), pending = delayed<object>();
  vi.mocked(f.gateway.claimQuestReward).mockReturnValueOnce(pending.promise);
  const result = f.claim(1006); f[change](); pending.resolve({player_level:6});
  expect(await result).toBeNull(); expect(f.patch).not.toHaveBeenCalled();
  expect(f.gateway.listPlayerBag).not.toHaveBeenCalled(); expect(f.gateway.getCityState).not.toHaveBeenCalled();
});
it("completed wall remains explicitly claimable in the existing UI without double-click replay or inferred level", async () => {
  const f = fixture(), pending = delayed<object>(), status = vi.fn(); f.get().player.level = 5;
  vi.mocked(f.gateway.listPlayerQuests).mockResolvedValue({quests:[{quest_cfg_id:1006,state:4}]});
  vi.mocked(f.gateway.claimQuestReward).mockReturnValueOnce(pending.promise);
  const mount = document.createElement("div"), panels = new ContentPanels(mount,f.gateway,f.get,f.patch,status);
  panels.attach(); panels.toggleQuest();
  await vi.waitFor(() => expect(mount.querySelector('[data-role="quest-list"]')?.textContent).toContain("1006"));
  const field = mount.querySelector<HTMLInputElement>('[data-field="quest-id"]')!;
  field.value = "1006"; field.dispatchEvent(new Event("change", {bubbles:true}));
  const button = mount.querySelector<HTMLButtonElement>('[data-action="claim-quest"]')!;
  expect(button.disabled).toBe(false); button.click(); button.click();
  expect(f.gateway.claimQuestReward).toHaveBeenCalledExactlyOnceWith(1,1006);
  panels.toggleQuest(); panels.toggleQuest(); pending.resolve({quest:{quest_cfg_id:1006,state:4}});
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(f.get().player.level).toBe(5); expect(f.get().wallet.gold).toBe(10);
  expect(f.gateway.claimQuestReward).toHaveBeenCalledTimes(1); panels.detach();
});
