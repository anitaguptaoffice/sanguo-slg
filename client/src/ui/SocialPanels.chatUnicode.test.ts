import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { GUILD_CHAT_DRAFT_STORAGE_KEY } from "@/net/guildChatDraft";
import { SocialPanels } from "./SocialPanels";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const mounted: SocialPanels[] = [];
function setup() {
  const mount = document.createElement("div"), status = vi.fn();
  document.body.appendChild(mount);
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => 1,
    sendChatMessage: vi.fn().mockResolvedValue({}),
    listChatMessages: vi.fn().mockResolvedValue({ messages: [] }) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status);
  mounted.push(panels); panels.attach(); panels.toggleChat();
  const input = () => mount.querySelector<HTMLInputElement>('[data-field="chat-content"]')!;
  // jsdom exercises production event handlers, not browser-native typing limits.
  const write = (value: string) => { input().value = value; input().dispatchEvent(new Event("input")); };
  const send = () => mount.querySelector<HTMLButtonElement>('[data-action="send-chat"]')!.click();
  const counter = () => mount.querySelector('[data-role="chat-input-counter"]')!.textContent;
  return { panels, status, gateway, input, write, send, counter };
}
beforeEach(() => sessionStorage.clear());
afterEach(() => { mounted.splice(0).forEach((p) => p.detach()); document.body.replaceChildren(); });

describe("mounted chat Unicode limit", () => {
  it("does not apply a UTF-16 maxlength to the code-point-limited input", () => {
    const { input } = setup();
    expect(input().hasAttribute("maxlength")).toBe(false);
  });

  it.each([
    ["astral", "😀".repeat(500)], ["mixed", "a".repeat(499) + "😀"],
    ["ASCII", "a".repeat(500)], ["Chinese", "中".repeat(500)],
  ])("sends all 500 %s code points unchanged", async (_name, content) => {
    const { gateway, input, write, send, counter } = setup();
    write(content);
    expect(input().value).toBe(content);
    expect(counter()).toBe("500/500");
    send(); await flush();
    expect(gateway.sendChatMessage).toHaveBeenCalledExactlyOnceWith(1, 1, content, {});
    expect(input().value).toBe("");
    expect(counter()).toBe("0/500");
    expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it.each(["😀".repeat(501), "a".repeat(499) + "😀中", "中".repeat(501), "a".repeat(501)])(
    "rejects 501 code points without RPC or draft loss %#", async (content) => {
      const { gateway, status, input, write, send, counter } = setup();
      await flush(); status.mockClear();
      write(content); send(); await flush();
      expect(gateway.sendChatMessage).not.toHaveBeenCalled();
      expect(status).toHaveBeenLastCalledWith("消息过长");
      expect(input().value).toBe(content);
      expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe(content);
      expect(counter()).toBe("501/500");
    },
  );

  it.each(["", "   "])("rejects empty or whitespace input %#", async (content) => {
    const { gateway, status, write, send } = setup();
    await flush(); status.mockClear(); write(content); send();
    expect(gateway.sendChatMessage).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("消息不能为空");
  });

  it("keeps existing trimmed send semantics and displays the raw count", async () => {
    const { gateway, write, send, counter } = setup();
    const content = "😀".repeat(500);
    write(` ${content} `); expect(counter()).toBe("502/500");
    send(); await flush();
    expect(gateway.sendChatMessage).toHaveBeenCalledExactlyOnceWith(1, 1, content, {});
  });

  it.each([500, 501])("restores the complete %i-code-point draft on reopen and remount", async (length) => {
    const { panels, input, write, counter, gateway } = setup();
    const content = "😀".repeat(length);
    write(content); panels.toggleChat(); panels.toggleChat(); await flush();
    expect(input().value).toBe(content); expect(counter()).toBe(`${length}/500`);
    panels.detach(); panels.attach(); panels.toggleChat(); await flush();
    expect(input().value).toBe(content); expect(counter()).toBe(`${length}/500`);
    expect(gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it("keeps a newer over-limit draft and suppresses duplicate pending sends", async () => {
    const { gateway, write, send, input, counter } = setup();
    let resolve!: (value: unknown) => void;
    gateway.sendChatMessage.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const sent = "😀".repeat(500), draft = sent + "中";
    write(sent); send(); send(); write(draft);
    expect(gateway.sendChatMessage).toHaveBeenCalledExactlyOnceWith(1, 1, sent, {});
    resolve({}); await flush();
    expect(input().value).toBe(draft); expect(counter()).toBe("501/500");
    expect(sessionStorage.getItem(GUILD_CHAT_DRAFT_STORAGE_KEY)).toBe(draft);
    send(); expect(gateway.sendChatMessage).toHaveBeenCalledTimes(1);
  });
});
