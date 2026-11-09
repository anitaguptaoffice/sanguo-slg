import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { GUILD_CHAT_DRAFT_STORAGE_KEY as key } from "@/net/guildChatDraft";
import { SocialPanels } from "./SocialPanels";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const attached: SocialPanels[] = [];
function setup() {
  const mount = document.createElement("div");
  document.body.append(mount);
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = {
    getBoundServerId: () => 1, getSessionGeneration: () => 1,
    sendChatMessage: vi.fn().mockResolvedValue({}),
    listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 1, name: "guild" } }),
    listGuildMembers: vi.fn().mockResolvedValue({ members: [] }),
  };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn());
  panels.attach(); attached.push(panels);
  const input = () => mount.querySelector<HTMLInputElement>('[data-field="chat-content"]')!;
  const write = (value: string) => { input().value = value; input().dispatchEvent(new Event("input")); };
  const send = () => mount.querySelector<HTMLButtonElement>('[data-action="send-chat"]')!.click();
  const reopen = () => { panels.toggleChat(); panels.toggleChat(); };
  const counter = () => mount.querySelector('[data-role="chat-input-counter"]')!.textContent;
  return { panels, mount, gateway, input, write, send, reopen, counter };
}
function deny(method: "setItem" | "removeItem") {
  const original = Storage.prototype[method];
  return vi.spyOn(Storage.prototype, method).mockImplementation(function (this: Storage, name: string, value?: string) {
    if (this === sessionStorage && name === key) throw new DOMException("Unavailable", method === "setItem" ? "QuotaExceededError" : "SecurityError");
    return original.call(this, name, value!);
  });
}
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  attached.splice(0).forEach((panels) => panels.detach());
  vi.restoreAllMocks(); sessionStorage.clear(); document.body.replaceChildren();
});

describe("chat draft storage is best effort", () => {
  it("restores once and persists normal edits and confirmed clears", async () => {
    sessionStorage.setItem(key, "stored");
    const f = setup(); f.panels.toggleChat();
    expect(f.input().value).toBe("stored");
    f.write("new draft"); f.reopen();
    expect(f.input().value).toBe("new draft");
    expect(sessionStorage.getItem(key)).toBe("new draft");
    f.send(); await flush(); f.reopen();
    expect(f.input().value).toBe("");
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(f.gateway.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("keeps newer text after quota failure (remount=%s)", async (remount) => {
    sessionStorage.setItem(key, "old draft");
    const f = setup(); f.panels.toggleChat(); await flush();
    deny("setItem"); f.write("new 😀 draft");
    if (remount) { f.panels.detach(); f.panels.attach(); f.panels.toggleChat(); } else f.reopen();
    expect(f.input().value).toBe("new 😀 draft");
    expect(f.counter()).toBe("11/500");
    expect(sessionStorage.getItem(key)).toBe("old draft");
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it.each([false, true])("does not resurrect a sent draft after failed removal (remount=%s)", async (remount) => {
    const f = setup(); f.panels.toggleChat(); f.write("sent draft");
    deny("removeItem"); f.send(); await flush();
    expect(f.input().value).toBe("");
    if (remount) { f.panels.detach(); f.panels.attach(); f.panels.toggleChat(); } else f.reopen();
    expect(f.input().value).toBe("");
    expect(f.counter()).toBe("0/500");
    expect(sessionStorage.getItem(key)).toBe("sent draft");
    expect(f.gateway.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it("retains an explicit empty draft when removal fails", async () => {
    sessionStorage.setItem(key, "old draft");
    const f = setup(); f.panels.toggleChat(); await flush();
    deny("removeItem"); f.write(""); f.reopen();
    expect(f.input().value).toBe("");
    expect(f.counter()).toBe("0/500");
    expect(sessionStorage.getItem(key)).toBe("old draft");
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it("keeps a newer unsaved draft when an earlier send finishes", async () => {
    const f = setup(); f.panels.toggleChat(); f.write("first");
    let resolve!: (value: object) => void;
    f.gateway.sendChatMessage.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    f.send(); deny("setItem"); f.write("next draft");
    resolve({}); await flush(); f.reopen();
    expect(f.input().value).toBe("next draft");
    expect(sessionStorage.getItem(key)).toBe("first");
    expect(f.gateway.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it("retains a failed unsaved send and permits only an explicit retry", async () => {
    sessionStorage.setItem(key, "old draft");
    const f = setup(); f.panels.toggleChat(); deny("setItem"); f.write("retry draft");
    f.gateway.sendChatMessage.mockRejectedValueOnce(new Error("send failed"));
    f.send(); await flush(); f.reopen();
    expect(f.input().value).toBe("retry draft");
    expect(f.gateway.sendChatMessage).toHaveBeenCalledTimes(1);
    f.send(); await flush(); f.reopen();
    expect(f.gateway.sendChatMessage).toHaveBeenCalledTimes(2);
    expect(f.input().value).toBe("");
  });

  it("keeps mention drafts through quota failures and normal persistence recovery", async () => {
    sessionStorage.setItem(key, "old draft");
    const f = setup();
    f.mount.querySelector<HTMLInputElement>('[data-field="guild-name"]')!.value = "guild";
    f.mount.querySelector<HTMLButtonElement>('[data-action="create-guild"]')!.click(); await flush();
    const fault = deny("setItem");
    const mention = document.createElement("button");
    mention.dataset.action = "guild-mention"; mention.dataset.displayName = "Alice";
    f.mount.querySelector('[data-center-panel="guild"]')!.append(mention); mention.click();
    const draft = f.input().value; expect(draft).toContain("Alice"); f.reopen();
    expect(f.input().value).toBe(draft);
    fault.mockRestore(); f.reopen();
    expect(sessionStorage.getItem(key)).toBe(draft);
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it("does not restore stale storage over an edit made before first opening", () => {
    sessionStorage.setItem(key, "old draft");
    const f = setup(); deny("setItem"); f.write("fresh"); f.panels.toggleChat();
    expect(f.input().value).toBe("fresh");
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it("restores the initial draft through the guild channel entry", () => {
    sessionStorage.setItem(key, "stored");
    const f = setup();
    f.mount.querySelector<HTMLButtonElement>('[data-action="open-guild-chat-channel"]')!.click();
    expect(f.input().value).toBe("stored");
    expect(f.counter()).toBe("6/500");
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it.each(["fresh", ""])("restores the current draft via guild entry after remount (%j)", (draft) => {
    sessionStorage.setItem(key, "stale");
    const f = setup(); f.panels.toggleChat();
    deny(draft ? "setItem" : "removeItem"); f.write(draft);
    f.panels.detach(); f.panels.attach();
    f.mount.querySelector<HTMLButtonElement>('[data-action="open-guild-chat-channel"]')!.click();
    expect(f.input().value).toBe(draft);
    expect(f.counter()).toBe(`${draft.length}/500`);
    f.reopen(); expect(f.input().value).toBe(draft);
    expect(sessionStorage.getItem(key)).toBe("stale");
    expect(f.gateway.sendChatMessage).not.toHaveBeenCalled();
  });
});
