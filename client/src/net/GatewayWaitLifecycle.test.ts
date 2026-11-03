import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";

vi.mock("@/net/loadProto", () => ({
  Routes: {},
  getTypes: () => ({ ServerPacket: { decode: (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)) } }),
}));

class Socket extends EventTarget {
  static OPEN = 1;
  readyState = Socket.OPEN;
  binaryType = "";
  onopen?: () => void;
  onclose?: () => void;
  send = vi.fn();
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (listener) {
      const entries = this.listeners.get(type) ?? new Set();
      entries.add(listener);
      this.listeners.set(type, entries);
    }
    super.addEventListener(type, listener);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (listener) this.listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener);
  }
  count() { return [...this.listeners.values()].reduce((n, entries) => n + entries.size, 0); }
  reply(trace: string) {
    const data = new TextEncoder().encode(JSON.stringify({ trace_id: trace })).buffer;
    this.dispatchEvent(new MessageEvent("message", { data }));
    return data;
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
    this.dispatchEvent(new Event("close"));
  }
}

type WaitAccess = { ws: Socket; sendAndWait(packet: Uint8Array, trace: string): Promise<ArrayBuffer> };
function connected() {
  const gateway = new GatewayClient();
  const socket = new Socket();
  const access = gateway as unknown as WaitAccess;
  access.ws = socket;
  return { gateway, socket, wait: (trace: string) => access.sendAndWait(new Uint8Array([1]), trace) };
}

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("gateway request cleanup", () => {
  it("cleans a matching response but ignores unrelated traces", async () => {
    const { socket, wait } = connected();
    const pending = wait("wanted");
    const listeners = socket.count();
    socket.reply("other");
    expect(socket.count()).toBe(listeners);
    expect(vi.getTimerCount()).toBe(1);
    const expected = socket.reply("wanted");
    await expect(pending).resolves.toBe(expected);
    expect(socket.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes listeners after repeated timeouts and ignores late replies", async () => {
    const { socket, wait } = connected();
    for (let i = 0; i < 3; i++) {
      const pending = expect(wait(String(i))).rejects.toThrow("gateway timeout");
      await vi.advanceTimersByTimeAsync(15_000);
      await pending;
      expect(socket.count()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      socket.reply(String(i));
    }
    expect(socket.send).toHaveBeenCalledTimes(3);
  });

  it("cleans timers and listeners if send throws synchronously", async () => {
    const { socket, wait } = connected();
    const error = new Error("send failed");
    socket.send.mockImplementation(() => { throw error; });
    await expect(wait("failed")).rejects.toBe(error);
    expect(socket.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails all pending requests immediately on close without replacing onclose", async () => {
    const { socket, wait } = connected();
    const closed = vi.fn();
    socket.onclose = closed;
    const failed = [vi.fn(), vi.fn()];
    void wait("a").catch(failed[0]);
    void wait("b").catch(failed[1]);
    socket.close();
    await Promise.resolve();
    expect(closed).toHaveBeenCalledTimes(1);
    for (const failure of failed) expect(failure).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(socket.send).toHaveBeenCalledTimes(2);
  });

  it("completes concurrent requests independently", async () => {
    const { socket, wait } = connected();
    const first = wait("a");
    const second = wait("b");
    const expected = socket.reply("a");
    await expect(first).resolves.toBe(expected);
    expect(vi.getTimerCount()).toBe(1);
    const secondFailure = expect(second).rejects.toThrow("gateway timeout");
    await vi.advanceTimersByTimeAsync(15_000);
    await secondFailure;
    expect(socket.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("explicit client close rejects pending work and clears session state", async () => {
    const { gateway, socket, wait } = connected();
    const rejected = vi.fn();
    const generation = gateway.getSessionGeneration();
    void wait("pending").catch(rejected);
    gateway.close();
    await Promise.resolve();
    expect(rejected).toHaveBeenCalledWith(expect.any(Error));
    expect(gateway.getSessionGeneration()).toBeGreaterThan(generation);
    expect(gateway.getSessionId()).toBe("");
    expect(gateway.getBoundServerId()).toBe(0);
    expect(socket.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
