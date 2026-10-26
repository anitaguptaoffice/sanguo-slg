import { expect, it, vi } from "vitest";
import { GatewayClient } from "./GatewayClient";
import { getTypes } from "./loadProto";

function reply(type: "LoginResponse" | "EnterGameServerResponse", session: string, server = 1): ArrayBuffer {
  const types = getTypes();
  return Uint8Array.from(types.ServerPacket.encode({ code: 0,
    data: types[type].encode({ session_id: session, server_id: server }).finish() }).finish()).buffer;
}
function deferred() {
  let resolve!: (value: ArrayBuffer) => void;
  return { promise: new Promise<ArrayBuffer>(r => { resolve = r; }), resolve: (v: ArrayBuffer) => resolve(v) };
}
it.each(["login", "enterGameServer"] as const)("delayed %s cannot rebind a newer actor", async method => {
  const gateway = new GatewayClient(); const old = deferred();
  const send = vi.spyOn(gateway as never, "sendAndWait").mockReturnValueOnce(old.promise);
  const pending = method === "login" ? gateway.login("old", "not-stored", 1) : gateway.enterGameServer(1);
  send.mockResolvedValue(reply("LoginResponse", "new", 2));
  await gateway.login("new", "not-stored", 2);
  old.resolve(reply(method === "login" ? "LoginResponse" : "EnterGameServerResponse", "old", 1));
  await expect(pending).rejects.toThrow("会话已变更");
  expect(gateway.getSessionId()).toBe("new"); expect(gateway.getBoundServerId()).toBe(2);
});
it.each(["login", "enterGameServer"] as const)("delayed %s cannot revive a logged-out session", async method => {
  const gateway = new GatewayClient(); const old = deferred();
  vi.spyOn(gateway as never, "sendAndWait").mockReturnValueOnce(old.promise);
  const pending = method === "login" ? gateway.login("old", "not-stored", 1) : gateway.enterGameServer(1);
  gateway.close(); old.resolve(reply(method === "login" ? "LoginResponse" : "EnterGameServerResponse", "old"));
  await expect(pending).rejects.toThrow("会话已变更");
  expect(gateway.getSessionId()).toBe(""); expect(gateway.getBoundServerId()).toBe(0);
});
it("old unauthenticated errors cannot cause stale automatic registration", async () => {
  const gateway = new GatewayClient(); const old = deferred();
  vi.spyOn(gateway as never, "sendAndWait").mockReturnValueOnce(old.promise);
  const pending = gateway.login("old", "not-stored", 1); gateway.close();
  old.resolve(Uint8Array.from(getTypes().ServerPacket.encode({ code: 20001, msg: "invalid login" }).finish()).buffer);
  await expect(pending).rejects.toMatchObject({ message: expect.stringContaining("会话已变更") });
});
