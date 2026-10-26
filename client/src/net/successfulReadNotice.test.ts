import { describe, expect, it, vi } from "vitest";
import { GatewayClient } from "./GatewayClient";
import { getTypes, Routes } from "./loadProto";
import { captureActor } from "./actorContext";
import { rememberSuccessfulReadNotice, renderSuccessfulReadNotice, MAX_READ_NOTICE_LENGTH } from "./successfulReadNotice";
import { ContentPanels } from "@/ui/ContentPanels";
import type { MainCitySession } from "./bootstrapSession";

const packet = (msg: string, code = 0) => Uint8Array.from(getTypes().ServerPacket.encode({ msg, code }).finish()).buffer;
const message = (value: unknown) => {
  const panel = document.createElement("div");
  renderSuccessfulReadNotice(panel, value);
  return panel;
};
const session = () => ({ serverId: 1, cityId: 1, player: { player_id: 10 }, bag: [], wallet: {} }) as MainCitySession;

describe("ordinary authenticated read notices", () => {
  it("preserves real decoded payload, renders bounded escaped text, and adds no confirmation", async () => {
    const gateway = new GatewayClient();
    const text = '<img src=x onerror="alert(1)">未到账' + "x".repeat(400);
    const types = getTypes();
    vi.spyOn(gateway as never, "sendAndWait").mockResolvedValue(Uint8Array.from(types.ServerPacket.encode({
      code: 0, msg: text, data: types.ListPlayerBagResponse.encode({ items: [{ item_cfg_id: 2004, quantity: 1 }] }).finish(),
    }).finish()).buffer);
    const response = await gateway.listPlayerBag(1);
    expect(response).toMatchObject({ items: [{ item_cfg_id: 2004, quantity: 1 }] });
    const panel = message(response);
    expect(panel.textContent).toBe(text.slice(0, MAX_READ_NOTICE_LENGTH));
    expect(panel.querySelector("img,button,[role=dialog]")).toBeNull();
    expect(panel.querySelector(".panel-feedback")?.textContent).toBe(panel.textContent);
    expect(panel.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");
    renderSuccessfulReadNotice(panel, {});
    expect(panel.textContent).toBe("");
  });
  it.each([Routes.Login, Routes.EnterGameServer, Routes.ClaimQuestReward, Routes.AcceptQuest, Routes.ListShopShelf])(
    "does not display successful notice for %s", route => {
      const response = {};
      rememberSuccessfulReadNotice(response, route, "not an asset proof");
      expect(message(response).textContent).toBe("");
    },
  );
  it("keeps successful tutorial notice but errors remain errors", async () => {
    const gateway = new GatewayClient();
    const send = vi.spyOn(gateway as never, "sendAndWait").mockResolvedValue(packet("稍后刷新"));
    expect(message(await gateway.listPlayerQuests(1)).textContent).toBe("稍后刷新");
    send.mockResolvedValue(packet("故障", 1));
    await expect(gateway.listPlayerBag(1)).rejects.toThrow("故障");
  });
  it.each(["close", "login", "enterGameServer"] as const)("drops delayed notice after %s starts", async action => {
    const gateway = new GatewayClient();
    let reply!: (value: ArrayBuffer) => void;
    vi.spyOn(gateway as never, "sendAndWait").mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }))
      .mockResolvedValue(packet(""));
    const pending = gateway.listPlayerBag(1);
    if (action === "close") gateway.close();
    else if (action === "login") await gateway.login("actor", "not-stored", 2);
    else await gateway.enterGameServer(2);
    reply(packet("old notice") as ArrayBuffer);
    await expect(pending).rejects.toThrow("会话已变更");
  });
  it("binds player, server, city and generation including logout/relogin to the same actor", () => {
    const gateway = new GatewayClient();
    let current = session();
    const guard = captureActor(gateway, () => current);
    current = { ...current, player: { player_id: 11 } };
    expect(guard()).toBe(false);
    current = session();
    expect(guard()).toBe(true);
    gateway.close();
    expect(guard()).toBe(false);
  });
  it("ordinary bag UI consumes notice and ignores a delayed response after actor switch", async () => {
    const gateway = new GatewayClient();
    const response = { items: [{ item_cfg_id: 2004, quantity: 1 }] };
    rememberSuccessfulReadNotice(response, Routes.ListPlayerBag, "初始招募书暂未到账");
    let current = session();
    const patch = vi.fn();
    const mount = document.createElement("div");
    const panels = new ContentPanels(mount, gateway, () => current, patch, vi.fn());
    const read = vi.spyOn(gateway, "listPlayerBag").mockResolvedValue(response);
    panels.attach();
    panels.toggleBag();
    await vi.waitFor(() => expect(mount.textContent).toContain("初始招募书暂未到账"));
    patch.mockClear();
    let reply!: (value: object) => void;
    read.mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }));
    (mount.querySelector('[data-action="refresh-bag"]') as HTMLButtonElement).click();
    current = { ...current, player: { player_id: 11 } };
    reply(response);
    await Promise.resolve();
    expect(patch).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain("初始招募书暂未到账");
    panels.detach();
  });
});
