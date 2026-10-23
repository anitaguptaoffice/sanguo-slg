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
