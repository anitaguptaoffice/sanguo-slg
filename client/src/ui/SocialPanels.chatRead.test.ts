import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ChatUnreadTracker } from "@/net/chatUnread";
import { SocialPanels } from "./SocialPanels";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const messages = (content: string) => ({ messages: [{ content, channel: 1, sent_at_ms: 1 }] });
function setup(tracker: ChatUnreadTracker | null = null) {
  const mount = document.createElement("div"), status = vi.fn(); let generation = 1;
  const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => generation,
    listChatMessages: vi.fn().mockResolvedValue(messages("default")) };
  const panels = new SocialPanels(mount, gateway as unknown as GatewayPort, () => session, status, tracker);
  panels.attach();
  const change = (field: string, value: string, event = "change") => {
    const input = mount.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
    input.value = value; input.dispatchEvent(new Event(event));
  };
  const refresh = () => mount.querySelector('[data-action="refresh-chat"]')!.dispatchEvent(new Event("click", { bubbles: true }));
  const log = () => mount.querySelector('[data-role="chat-log"]')!.textContent;
  return { panels, mount, gateway, status, change, refresh, log, relogin: () => { generation++; } };
}
beforeEach(() => sessionStorage.clear());
describe("chat read ownership", () => {
  it("starts a new destination read while the old one is pending", async () => {
    const { panels, gateway, change, log } = setup();
    const old = deferred(), fresh = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.toggleChat(); await flush(); change("channel", "2"); await flush();
    expect(gateway.listChatMessages).toHaveBeenCalledTimes(2);
    fresh.resolve(messages("private newest")); await flush(); old.resolve(messages("old world")); await flush();
    expect(log()).toContain("private newest"); expect(log()).not.toContain("old world"); panels.detach();
  });
  it("does not apply an old error to the replacement destination", async () => {
    const { panels, gateway, change, log } = setup();
    const old = deferred(); gateway.listChatMessages.mockReturnValueOnce(old.promise as never);
    panels.toggleChat(); await flush(); change("channel", "2"); await flush();
    old.reject(new Error("old world failure")); await flush();
    expect(log()).not.toContain("old world failure"); expect(log()).toContain("default"); panels.detach();
  });
  it("deduplicates only the same active destination", async () => {
    const { panels, gateway, refresh } = setup();
    const pending = deferred(); gateway.listChatMessages.mockReturnValueOnce(pending.promise as never);
    panels.toggleChat(); refresh(); refresh(); await flush();
    expect(gateway.listChatMessages).toHaveBeenCalledTimes(1);
    pending.resolve(messages("done")); await flush(); refresh(); await flush();
    expect(gateway.listChatMessages).toHaveBeenCalledTimes(2); panels.detach();
  });
  it.each([false, true])("old success/error cannot release the new read's spinner (reject=%s)", async (reject) => {
    const { panels, gateway, change, mount, status } = setup();
    const old = deferred(), fresh = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.toggleChat(); await flush(); change("channel", "2"); await flush(); status.mockClear();
    if (reject) old.reject(new Error("old")); else old.resolve(messages("old")); await flush();
    expect(status).not.toHaveBeenCalled();
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-chat"]')!.disabled).toBe(true);
    fresh.resolve(messages("fresh")); await flush();
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-chat"]')!.disabled).toBe(false); panels.detach();
  });
  it("private peer commit reads the new peer and discards the old one", async () => {
    const { panels, gateway, change, log } = setup();
    change("channel", "2");
    const old = deferred(), fresh = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    panels.toggleChat(); await flush(); change("peer-id", "10003", "input"); change("peer-id", "10003"); await flush();
    expect(gateway.listChatMessages).toHaveBeenLastCalledWith(1, 2, { peerPlayerId: 10003, limit: 30 });
    fresh.resolve(messages("peer3")); await flush(); old.resolve(messages("peer2")); await flush();
    expect(log()).toContain("peer3"); expect(log()).not.toContain("peer2"); panels.detach();
  });
  it("channel round trip rejects the first read even for the same destination", async () => {
    const { panels, gateway, change, log } = setup();
    const old = deferred(), middle = deferred(), latest = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(middle.promise as never).mockReturnValueOnce(latest.promise as never);
    panels.toggleChat(); await flush(); change("channel", "2"); await flush(); change("channel", "1"); await flush();
    old.resolve(messages("old world")); middle.resolve(messages("old private")); await flush();
    expect(log()).not.toContain("old"); latest.resolve(messages("latest world")); await flush();
    expect(log()).toContain("latest world"); panels.detach();
  });
  it("unjoined guild clears visible history and invalidates pending world reads", async () => {
    const { panels, gateway, change, refresh, log, mount } = setup();
    panels.toggleChat(); await flush(); expect(log()).toContain("default");
    const pending = deferred(); gateway.listChatMessages.mockReturnValueOnce(pending.promise as never);
    refresh(); await flush(); change("channel", "3"); await flush();
    expect(log()).not.toContain("default"); expect(log()).toContain("军团");
    pending.resolve(messages("old world")); await flush();
    expect(log()).not.toContain("old world");
    expect(mount.querySelector<HTMLButtonElement>('[data-action="refresh-chat"]')!.disabled).toBe(false); panels.detach();
  });
  it.each([false, true])("reattach isolates a new read from old completion (reject=%s)", async (reject) => {
    const { panels, gateway, log, status } = setup(); const old = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never);
    panels.toggleChat(); await flush(); panels.detach(); panels.attach(); panels.toggleChat(); await flush(); status.mockClear();
    if (reject) old.reject(new Error("obsolete")); else old.resolve(messages("obsolete")); await flush();
    expect(log()).toContain("default"); expect(log()).not.toContain("obsolete"); expect(status).not.toHaveBeenCalled(); panels.detach();
  });
  it("same-player relogin does not coalesce with the old account generation", async () => {
    const { panels, gateway, refresh, relogin, log } = setup(); const old = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never);
    panels.toggleChat(); await flush(); relogin(); refresh(); await flush();
    expect(gateway.listChatMessages).toHaveBeenCalledTimes(2);
    old.resolve(messages("obsolete")); await flush(); expect(log()).toContain("default"); expect(log()).not.toContain("obsolete"); panels.detach();
  });

  it("does not publish stale world snapshots to unread tracking", async () => {
    const tracker = new ChatUnreadTracker(null), publish = vi.spyOn(tracker, "replaceSnapshot");
    const { panels, gateway, change } = setup(tracker); const old = deferred();
    gateway.listChatMessages.mockReturnValueOnce(old.promise as never);
    panels.toggleChat(); await flush(); change("channel", "2"); await flush();
    old.resolve(messages("stale unread")); await flush(); expect(publish).not.toHaveBeenCalled(); panels.detach();
  });

});
