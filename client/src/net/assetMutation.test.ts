import { expect, it } from "vitest";
import { captureActor } from "./actorContext";
import { beginAssetMutation } from "./assetMutation";
import { beginAssetRead, captureAssetRead } from "./questClaimAssets";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";

function fixture() {
  let generation = 1;
  const session = { serverId: 1, cityId: 7, player: { player_id: 1 } } as MainCitySession;
  const gateway = { getSessionId: () => "same-token", getSessionGeneration: () => generation,
    getBoundServerId: () => 1 } as GatewayPort;
  return { gateway, session, current: captureActor(gateway, () => session), relogin: () => generation++ };
}
it("invalidates both boundaries and returns pre-settlement receipt freshness only once", () => {
  const f = fixture(), before = captureAssetRead(f.gateway);
  const settle = beginAssetMutation(f.gateway, f.current), during = captureAssetRead(f.gateway);
  expect(before()).toBe(false); expect(settle()).toBe(true); expect(during()).toBe(false);
  const after = beginAssetRead(f.gateway);
  expect(settle()).toBe(false); expect(after()).toBe(true);
});
it("does not call an overtaken receipt fresh while still invalidating the intervening read", () => {
  const f = fixture(), settle = beginAssetMutation(f.gateway, f.current), during = beginAssetRead(f.gateway);
  expect(settle()).toBe(false); expect(during()).toBe(false);
});
it.each(["actor", "session"])("old %s settlement cannot invalidate new ownership", kind => {
  const f = fixture(), settle = beginAssetMutation(f.gateway, f.current);
  if (kind === "actor") f.session.player.player_id = 2; else f.relogin();
  const current = beginAssetRead(f.gateway);
  expect(settle()).toBe(false); expect(current()).toBe(true);
});
