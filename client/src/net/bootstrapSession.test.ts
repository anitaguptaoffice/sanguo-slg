import { describe, expect, it, vi } from "vitest";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import { ErrorCode } from "@/net/loadProto";

function mockGateway(overrides: Partial<GatewayPort> = {}): GatewayPort {
  return {
    connect: vi.fn(),
    register: vi.fn().mockResolvedValue({ account_id: 1 }),
    login: vi.fn().mockResolvedValue({
      session_id: "sid",
      player: { display_name: "测试", level: 1 },
      wallet: { food: 100 },
    }),
    listPlayerCities: vi.fn().mockResolvedValue({ cities: [] }),
    createCity: vi.fn().mockResolvedValue({
      city: { city_id: 42, name: "新城", is_capital: true },
    }),
    getCityState: vi.fn().mockResolvedValue({
      wallet: { food: 8000, wood: 8000 },
      buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 1 }],
    }),
    startBuildingUpgrade: vi.fn(),
    recruitTroop: vi.fn(),
    startMarch: vi.fn(),
    listMarches: vi.fn(),
    listBattleReports: vi.fn(),
    getBattleReport: vi.fn(),
    listGameServers: vi.fn(),
    enterGameServer: vi.fn().mockResolvedValue({ server_id: 1 }),
    sendChatMessage: vi.fn(),
    listChatMessages: vi.fn(),
    createGuild: vi.fn(),
    joinGuild: vi.fn(),
    listGuildMembers: vi.fn(),
    getLeaderboard: vi.fn(),
    listPlayerQuests: vi.fn(),
    acceptQuest: vi.fn(),
    reportQuestProgress: vi.fn(),
    claimQuestReward: vi.fn(),
    listShopShelf: vi.fn(),
    purchaseShopOffer: vi.fn(),
    listPlayerBag: vi.fn(),
    useConsumable: vi.fn(),
    getBoundServerId: () => 1,
    getSessionId: () => "sid",
    close: vi.fn(),
    ...overrides,
  };
}

describe("bootstrapMainCity", () => {
  it("creates a city when the player has none", async () => {
    const gw = mockGateway();
    const session = await bootstrapMainCity(gw, "u1", "p1", 1);
    expect(gw.createCity).toHaveBeenCalledWith(1, "主城", 60, 60);
    expect(gw.enterGameServer).toHaveBeenCalledWith(1);
    expect(session.cityId).toBe(42);
    expect(session.serverId).toBe(1);
    expect(session.buildings).toHaveLength(1);
    expect(session.garrisonStatus).toBe("unknown");
    expect(session.cityTroops).toEqual([]);
  });

  it("registers when login fails with ACCOUNT_LOGIN_FAILED", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("bad"), { code: ErrorCode.ACCOUNT_LOGIN_FAILED }))
      .mockResolvedValueOnce({ session_id: "s", player: {}, wallet: {} });
    const gw = mockGateway({
      login,
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [{ city_id: 7, name: "已有", is_capital: true }],
      }),
    });
    const session = await bootstrapMainCity(gw, "new", "pw", 1);
    expect(gw.register).toHaveBeenCalledWith("new", "pw");
    expect(gw.createCity).not.toHaveBeenCalled();
    expect(session.cityId).toBe(7);
  });
});


it("bootstraps the authoritative ready snapshot without recruiting", async () => {
  const gw = mockGateway({ getCityState: vi.fn().mockResolvedValue({ garrison: { troops: [{ unit_cfg_id: 1, count: 1 }] } }) });
  const session = await bootstrapMainCity(gw, "u1", "p1", 1);
  expect(session.garrisonStatus).toBe("ready");
  expect(session.cityTroops).toEqual([{ unit_cfg_id: 1, count: 1 }]);
  expect(gw.recruitTroop).not.toHaveBeenCalled();
});

it("explicit re-entry uses the new actor profile, never the preceding high level", async () => {
  const gw = mockGateway({
    login: vi.fn().mockResolvedValueOnce({ player: { player_id: 1, level: 20 } }).mockResolvedValueOnce({ player: { player_id: 2, level: 1 } }),
    enterGameServer: vi.fn().mockResolvedValueOnce({ player: { player_id: 1, level: 20 } }).mockResolvedValueOnce({ player: { player_id: 2, level: 2 } }),
  });
  expect((await bootstrapMainCity(gw, "a", "not-stored", 1)).player.level).toBe(20);
  expect((await bootstrapMainCity(gw, "b", "not-stored", 1)).player).toEqual({ player_id: 2, level: 2 });
});
it("stale bootstrap reads cannot create a city or return another actor's session", async () => {
  let generation = 1; let resolve!: (value: object) => void;
  const gw = mockGateway({ getSessionGeneration: () => generation,
    listPlayerCities: vi.fn(() => new Promise(r => { resolve = r; })),
  });
  const pending = bootstrapMainCity(gw, "a", "not-stored", 1);
  await vi.waitFor(() => expect(gw.listPlayerCities).toHaveBeenCalled());
  generation++; resolve({ cities: [] });
  await expect(pending).rejects.toThrow("会话已变更");
  expect(gw.createCity).not.toHaveBeenCalled();
});
it("rejects mismatched entry profile instead of merging actor identities", async () => {
  const gw = mockGateway({ login: vi.fn().mockResolvedValue({ player: { player_id: 1, level: 20 } }),
    enterGameServer: vi.fn().mockResolvedValue({ player: { player_id: 2, level: 1 } }),
  });
  await expect(bootstrapMainCity(gw, "a", "not-stored", 1)).rejects.toThrow("角色已变更");
  expect(gw.listPlayerCities).not.toHaveBeenCalled();
});
