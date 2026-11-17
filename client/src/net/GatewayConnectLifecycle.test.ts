import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GatewayClient } from "./GatewayClient";

class Socket extends EventTarget {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  binaryType = "";
  onopen?: () => void;
  onclose?: () => void;
  onerror?: (event: Event) => void;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; }); // Browser close delivery is asynchronous.
  constructor(_url: string) { super(); Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  closed() { this.readyState = 3; this.onclose?.(); this.dispatchEvent(new Event("close")); }
  error() { this.onerror?.(new Event("error")); }
}
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function attempt(gateway = new GatewayClient()) {
  const handlers = { onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn() };
  const resolved = vi.fn(), rejected = vi.fn();
  const done = gateway.connect(handlers).then(resolved, rejected);
  return { gateway, handlers, resolved, rejected, done, socket: Socket.instances.at(-1)! };
}

it("bounds a silent CONNECTING socket at 15 seconds and sends nothing", async () => {
  const a = attempt();
  await vi.advanceTimersByTimeAsync(14_999);
  expect(a.rejected).not.toHaveBeenCalled(); expect(a.socket.close).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(a.rejected).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("超时") }));
  expect(a.resolved).not.toHaveBeenCalled(); expect(a.socket.close).toHaveBeenCalledTimes(1);
  expect(a.socket.send).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it("clears the deadline after open and retains ordinary disconnection notifications", async () => {
  const a = attempt(); a.socket.open(); await a.done;
  expect(a.resolved).toHaveBeenCalledTimes(1); expect(a.handlers.onOpen).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0); await vi.advanceTimersByTimeAsync(30_000);
  expect(a.socket.close).not.toHaveBeenCalled();
  a.socket.error(); expect(a.handlers.onError).toHaveBeenCalledTimes(1);
  const generation = a.gateway.getSessionGeneration(); a.socket.closed();
  expect(a.handlers.onClose).toHaveBeenCalledTimes(1);
  expect(a.gateway.getSessionGeneration()).toBeGreaterThan(generation);
  expect(a.gateway.getSessionId()).toBe(""); expect(a.gateway.getBoundServerId()).toBe(0);
  expect(a.rejected).not.toHaveBeenCalled();
});
it.each(["error", "closed"] as const)("settles early %s without waiting for the deadline", async event => {
  const a = attempt(); a.socket[event](); await Promise.resolve();
  expect(a.rejected).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  a.socket.open(); a.socket.error(); a.socket.closed(); await vi.advanceTimersByTimeAsync(30_000);
  expect(a.resolved).not.toHaveBeenCalled(); expect(a.rejected).toHaveBeenCalledTimes(1);
  expect(a.handlers.onOpen).not.toHaveBeenCalled();
  expect(a.handlers[event === "error" ? "onError" : "onClose"]).toHaveBeenCalledTimes(1);
});
it("explicit close cancels pending connect even before the browser delivers close", async () => {
  const a = attempt(); a.gateway.close(); await Promise.resolve();
  expect(a.rejected).toHaveBeenCalledTimes(1); expect(a.socket.close).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0); a.socket.open(); a.socket.closed();
  expect(a.handlers.onOpen).not.toHaveBeenCalled(); expect(a.resolved).not.toHaveBeenCalled();
});
it.each(["timeout", "replacement", "close"])("ignores late callbacks after %s while a new connection is live", async ending => {
  const a = attempt();
  if (ending === "timeout") await vi.advanceTimersByTimeAsync(15_000);
  if (ending === "close") a.gateway.close();
  const b = attempt(a.gateway); await Promise.resolve();
  expect(a.rejected).toHaveBeenCalledTimes(1); expect(a.socket.close).toHaveBeenCalledTimes(1);
  b.socket.open(); await b.done; const generation = b.gateway.getSessionGeneration();
  a.socket.open(); a.socket.error(); a.socket.closed(); await vi.advanceTimersByTimeAsync(30_000);
  expect(a.handlers.onOpen).not.toHaveBeenCalled(); expect(a.handlers.onError).not.toHaveBeenCalled();
  expect(a.handlers.onClose).not.toHaveBeenCalled(); expect(a.resolved).not.toHaveBeenCalled();
  expect(b.gateway.getSessionGeneration()).toBe(generation); expect(b.socket.close).not.toHaveBeenCalled();
  expect(b.handlers.onOpen).toHaveBeenCalledTimes(1); expect(b.handlers.onClose).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("closes an old established socket on replacement without stale notifications", async () => {
  const a = attempt(); a.socket.open(); await a.done;
  const b = attempt(a.gateway); b.socket.open(); await b.done;
  expect(a.socket.close).toHaveBeenCalledTimes(1);
  a.socket.error(); a.socket.closed();
  expect(a.handlers.onError).not.toHaveBeenCalled(); expect(a.handlers.onClose).not.toHaveBeenCalled();
  expect(b.handlers.onClose).not.toHaveBeenCalled(); expect(b.socket.close).not.toHaveBeenCalled();
});
