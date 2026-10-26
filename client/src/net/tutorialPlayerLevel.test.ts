import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getTypes } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { applyClaimPlayerLevel, positivePlayerLevel, PROFILE_REENTRY_HINT } from "./tutorialPlayerLevel";
import { claimQuestWithAssets } from "./questClaimAssets";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";

const bytes = (name: string) => new Uint8Array(readFileSync(resolve("src/net/fixtures/tutorial-level", `${name}.bin`)));
const claimType = () => getTypes().ClaimQuestRewardResponse;
const raw = (name: string) => claimType().toObject(claimType().decode(bytes(name)), { longs: String, defaults: true });

describe("actual API-WIRE-ONBOARD-001 Go binary compatibility", () => {
  it.each([0, 1, 5, 20, 2147483647, -2147483648])("keeps fields1–3 and scalar field4=%i", value => {
    const decoded = raw(`go-level-${value}`);
    const old = raw("claim_reward_legacy");
    expect(decoded).toEqual({ ...old, player_level: value });
    expect(old.player_level).toBe(0);
    const safe = decodeGatewayResponse(claimType(), bytes(`go-safe-level-${value}`));
    expect(safe.player_level).toBe(value);
    expect(safe.granted_rewards).toMatchObject({ resources: { food: 8000 } });
    expect(safe.quest).toMatchObject({ quest_cfg_id: 1002, state: 4 });
    expect(safe.chain).toMatchObject({ chain_id: 100, completed_quest_count: 2 });
    expect(claimType().fields.player_level.id).toBe(4);
    expect(claimType().fields.player_level.type).toBe("int32");
    // These exact supplied fixtures deliberately include food=2^53+1. Never round it.
    expect(() => decodeGatewayResponse(claimType(), bytes(`go-level-${value}`))).toThrow("outside safe range");
  });
  it("decodes exact field4-only Go marshal asserted by the approved Go wire test", () => {
    expect(decodeGatewayResponse(claimType(), Uint8Array.of(0x20, 0x14))).toMatchObject({ player_level: 20 });
    expect(decodeGatewayResponse(claimType(), new Uint8Array())).toMatchObject({ player_level: 0 });
  });
});
it.each([undefined, null, 0, -1, -2147483648, 2147483648, NaN, Infinity, 1.5, "5", {}, true])(
  "ignores unknown/oldserver/malformed level %s", value => {
    expect(positivePlayerLevel(value)).toBeNull();
    const patch = vi.fn();
    applyClaimPlayerLevel({ player_level: value }, () => ({ player: { level: 20 } }) as MainCitySession, patch, () => true);
    expect(patch).not.toHaveBeenCalled();
  },
);
it("applies positive levels monotonically, not quest counts or message text", () => {
  let session = { player: { player_id: 1, level: 1 } } as MainCitySession;
  const patch = (value: Partial<MainCitySession>) => { session = { ...session, ...value }; };
  for (const level of [2, 5, 3, 20, 5, 0]) applyClaimPlayerLevel({ player_level: level }, () => session, patch, () => true);
  expect(session.player.level).toBe(20);
  applyClaimPlayerLevel({ player_level: 99 }, () => session, patch, () => false);
  applyClaimPlayerLevel({ chain: { completed_quest_count: 999 }, msg: "level 999" }, () => session, patch, () => true);
  expect(session.player.level).toBe(20);
});
it("persists the claim level even when authoritative assets are temporarily unavailable", async () => {
  let session = { serverId: 1, cityId: 1, player: { player_id: 1, level: 1 }, bag: [], wallet: {} } as MainCitySession;
  const gateway = { claimQuestReward: vi.fn().mockResolvedValue({ player_level: 5 }), listPlayerBag: vi.fn().mockRejectedValue(new Error("offline")),
    getCityState: vi.fn().mockResolvedValue({ wallet: {} }), enterGameServer: vi.fn() } as unknown as GatewayPort;
  await expect(claimQuestWithAssets(gateway, 1005, () => session, p => { session = { ...session, ...p }; })).rejects.toThrow("资产待同步");
  expect(session.player.level).toBe(5);
  expect(gateway.enterGameServer).not.toHaveBeenCalled();
});
it("AlreadyCompleted keeps level unchanged, supplies explicit recovery guidance and never rebinds", async () => {
  const session = { serverId: 1, cityId: 1, player: { player_id: 1, level: 1 }, bag: [], wallet: {} } as MainCitySession;
  const gateway = { claimQuestReward: vi.fn().mockRejectedValue(Object.assign(new Error("level999 already completed"), { code: 63007 })),
    listPlayerBag: vi.fn().mockResolvedValue({ items: [] }), getCityState: vi.fn().mockResolvedValue({ wallet: {} }),
    enterGameServer: vi.fn(), login: vi.fn() } as unknown as GatewayPort;
  await expect(claimQuestWithAssets(gateway, 1005, () => session, p => Object.assign(session, p))).rejects.toMatchObject({ code: 63007,
    message: expect.stringContaining(PROFILE_REENTRY_HINT) });
  expect(session.player.level).toBe(1);
  expect(gateway.enterGameServer).not.toHaveBeenCalled(); expect(gateway.login).not.toHaveBeenCalled();
});
