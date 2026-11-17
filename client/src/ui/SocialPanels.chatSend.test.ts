import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { GUILD_CHAT_DRAFT_STORAGE_KEY } from "@/net/guildChatDraft";
import { SocialPanels } from "./SocialPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
function setup() {
  const mount = document.createElement("div"), status = vi.fn();
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  let generation = 1;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation,
    createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 1, name: "guild" } }),
    listGuildMembers: vi.fn().mockResolvedValue({ members: [] }),
    sendChatMessage: vi.fn().mockResolvedValue({}), listChatMessages: vi.fn().mockResolvedValue({ messages: [] }) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status);
  panels.attach();
  const input = () => mount.querySelector<HTMLInputElement>('[data-field="chat-content"]')!;
  const write = (value: string) => { input().value = value; input().dispatchEvent(new Event("input")); };
  const send = () => mount.querySelector<HTMLButtonElement>('[data-action="send-chat"]')!.click();
  return { panels, mount, status, gateway, input, write, send, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("chat send safety", () => {
  it("sends only once while pending", async () => {
    const { panels, gateway, write, send } = setup();
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    write("first"); send(); send();
    expect(gateway.sendChatMessage).toHaveBeenCalledTimes(1);
    pending.resolve({}); await flush(); panels.detach();
  });
  it("preserves the next draft when the earlier send finishes", async () => {
    const { panels, gateway, write, send, input } = setup();
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    write("first"); send(); write("next draft"); pending.resolve({}); await flush();
    expect(input().value).toBe("next draft");
    expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe("next draft");
    panels.detach();
  });
  it("clears the unchanged sent draft and unlocks after success", async () => {
    const { panels, gateway, write, send, input } = setup();
    write("  first  "); send(); await flush();
    expect(gateway.sendChatMessage).toHaveBeenCalledWith(1, 1, "first", {});
    expect(input().value).toBe("");
    expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBeNull();
    write("second"); send(); await flush();
    expect(gateway.sendChatMessage).toHaveBeenCalledTimes(2); panels.detach();
  });
  it("retains edited-back identical text as a new draft", async () => {
    const { panels, gateway, write, send, input } = setup();
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    write("first"); send(); write("changed"); write("first");
    pending.resolve({}); await flush();
    expect(input().value).toBe("first"); panels.detach();
  });
  it("keeps a failed draft and permits an explicit retry", async () => {
    const { panels, gateway, write, send, input, status } = setup();
    gateway.sendChatMessage.mockRejectedValueOnce(new Error("send failed"));
    write("first"); send(); await flush();
    expect(input().value).toBe("first"); expect(status).toHaveBeenLastCalledWith("send failed");
    expect(gateway.listChatMessages).not.toHaveBeenCalled();
    send(); await flush(); expect(gateway.sendChatMessage).toHaveBeenCalledTimes(2); panels.detach();
  });
  it.each(["channel", "peer-id"])("destination change preserves text (%s)", async (field) => {
    const { panels, gateway, write, send, input, mount } = setup();
    const channel = mount.querySelector<HTMLSelectElement>('[data-field="channel"]')!;
    channel.value = "2"; channel.dispatchEvent(new Event("change"));
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    write("first"); send();
    const target = mount.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
    target.value = field === "channel" ? "1" : "10003";
    target.dispatchEvent(new Event(field === "channel" ? "change" : "input"));
    pending.resolve({}); await flush();
    expect(input().value).toBe("first");
    expect(gateway.listChatMessages).not.toHaveBeenCalled(); panels.detach();
  });
  it.each([false, true])("obsolete send does not alter or unlock a new mount (reject=%s)", async (reject) => {
    const { panels, gateway, write, send, input, status } = setup();
    const old = deferred(), fresh = deferred();
    gateway.sendChatMessage.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    write("old"); send(); panels.detach(); panels.attach(); write("fresh"); send(); status.mockClear();
    if (reject) old.reject(new Error("old failure")); else old.resolve({});
    await flush(); send();
    expect(input().value).toBe("fresh"); expect(status).not.toHaveBeenCalled();
    expect(gateway.sendChatMessage).toHaveBeenCalledTimes(2);
    expect(gateway.listChatMessages).not.toHaveBeenCalled();
    fresh.resolve({}); await flush(); expect(input().value).toBe(""); panels.detach();
  });
  it.each([false, true])("same-player relogin ignores old success/error (reject=%s)", async (reject) => {
    const { panels, gateway, write, send, input, status, relogin } = setup();
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    write("first"); send(); relogin(); write("new session"); status.mockClear();
    if (reject) pending.reject(new Error("old failure")); else pending.resolve({});
    await flush();
    expect(input().value).toBe("new session"); expect(status).not.toHaveBeenCalled();
    expect(gateway.listChatMessages).not.toHaveBeenCalled(); panels.detach();
  });
  it("send-initiated refresh cannot write into a replacement panel", async () => {
    const { panels, gateway, write, send, mount, status } = setup();
    const pending = deferred(); gateway.listChatMessages.mockReturnValueOnce(pending.promise as never);
    write("first"); send(); await flush();
    panels.detach(); panels.attach(); write("new draft"); status.mockClear();
    pending.resolve({ messages: [{ channel: 1, content: "old read" }] }); await flush();
    expect(mount.querySelector('[data-role="chat-log"]')?.textContent).not.toContain("old read");
    expect(status).not.toHaveBeenCalled(); panels.detach();
  });

  it.each(["channel", "peer-id"])("send refresh rejects a later destination switch (%s)", async (field) => {
    const { panels, gateway, write, send, mount } = setup();
    mount.querySelector<HTMLSelectElement>('[data-field="channel"]')!.value = "2";
    const pending = deferred(); gateway.listChatMessages.mockReturnValueOnce(pending.promise as never);
    write("first"); send(); await flush();
    const target = mount.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
    target.value = field === "channel" ? "1" : "10003";
    target.dispatchEvent(new Event(field === "channel" ? "change" : "input"));
    pending.resolve({ messages: [{ channel: 2, content: "old private data" }] }); await flush();
    expect(mount.querySelector('[data-role="chat-log"]')?.textContent).not.toContain("old private data");
    panels.detach();
  });
  it("preserves a newly inserted identical guild mention", async () => {
    const { panels, gateway, send, input, mount } = setup();
    mount.querySelector<HTMLInputElement>('[data-field="guild-name"]')!.value = "guild";
    mount.querySelector<HTMLButtonElement>('[data-action="create-guild"]')!.click(); await flush();
    const mention = document.createElement("button");
    mention.dataset.action = "guild-mention"; mention.dataset.displayName = "Alice";
    mount.querySelector('[data-center-panel="guild"]')!.appendChild(mention);
    mention.click(); const draft = input().value;
    const pending = deferred(); gateway.sendChatMessage.mockReturnValueOnce(pending.promise);
    send(); mention.click(); pending.resolve({}); await flush();
    expect(input().value).toBe(draft);
    expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe(draft);
    panels.detach();
  });

  it.each([false, true])("discarded send refresh releases its busy UI (reject=%s)", async (reject) => {
    const { panels, gateway, write, send, mount } = setup();
    const pending = deferred(); gateway.listChatMessages.mockReturnValueOnce(pending.promise as never);
    write("first"); send(); await flush();
    const channel = mount.querySelector<HTMLSelectElement>('[data-field="channel"]')!;
    channel.value = "2"; channel.dispatchEvent(new Event("change"));
    if (reject) pending.reject(new Error("obsolete read")); else pending.resolve({ messages: [] });
    await flush();
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-chat"]')!.disabled).toBe(false);
    expect(mount.querySelector<HTMLElement>('[data-role="chat-refresh-spinner"]')!.hidden).toBe(true);
    panels.detach();
  });

});
