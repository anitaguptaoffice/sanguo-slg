import { afterEach, expect, it, vi } from "vitest";
import { CHAT_LAST_READ_TS_STORAGE_KEY, ChatUnreadTracker, readChatLastReadMap, writeChatLastReadMap } from "./chatUnread";
import { CHAT_CHANNEL_WORLD } from "./socialFormat";

const snapshot = { key: "world", channel: CHAT_CHANNEL_WORLD, messages: [{ sent_at_ms: 100 }, { sent_at_ms: 200 }] };
function denyGetter() {
  return vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, k: string) {
    if (this === globalThis.localStorage) throw new DOMException("blocked", "SecurityError");
    return Storage.prototype.getItem.call(this, k);
  });
}
function exercise(tracker: ChatUnreadTracker) {
  const counts = vi.fn(); tracker.onCounts = counts;
  tracker.replaceSnapshot(snapshot); expect(tracker.getSummary(0).world).toBe(2);
  tracker.markChannelRead("world", 100); expect(tracker.getSummary(0).world).toBe(1);
  tracker.markChannelRead("world", 50); expect(tracker.getLastReadMs("world")).toBe(100);
  tracker.markChannelRead("world", 200); expect(tracker.getSummary(0).world).toBe(0);
  expect(counts).toHaveBeenCalledTimes(3);
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  const ls = globalThis.localStorage;
  if (ls && typeof ls.clear === "function") {
    try {
      ls.clear();
    } catch {
      /* SecurityError from denied getter tests */
    }
  }
});

it.each(["read", "write"])("contains a denied default getter in the %s helper", operation => {
  denyGetter();
  if (operation === "read") expect(readChatLastReadMap()).toEqual({});
  else expect(() => writeChatLastReadMap({ world: 200 })).not.toThrow();
});
it("keeps tracker counts and notifications in memory when the default getter is denied", () => {
  denyGetter(); exercise(new ChatUnreadTracker());
});
it("works when the global store does not exist", () => {
  vi.stubGlobal("localStorage", undefined);
  try {
    expect(readChatLastReadMap()).toEqual({});
    expect(() => writeChatLastReadMap({ world: 200 })).not.toThrow();
    exercise(new ChatUnreadTracker());
  } finally {
    vi.unstubAllGlobals();
  }
});
it("explicit null never consults a denied browser getter", () => {
  const getter = denyGetter(); expect(readChatLastReadMap(null)).toEqual({});
  writeChatLastReadMap({ world: 200 }, null); exercise(new ChatUnreadTracker(null)); expect(getter).not.toHaveBeenCalled();
});
it("explicit injected storage preserves read/write behavior without consulting the global", () => {
  const getter = denyGetter(); let raw = '{"world":100}';
  const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
  expect(readChatLastReadMap(storage)).toEqual({ world: 100 });
  const tracker = new ChatUnreadTracker(storage); tracker.replaceSnapshot(snapshot);
  expect(tracker.getSummary(0).world).toBe(1); tracker.markChannelRead("world", 200);
  expect(storage.setItem).toHaveBeenLastCalledWith(CHAT_LAST_READ_TS_STORAGE_KEY, '{"world":200}');
  expect(new ChatUnreadTracker(storage).getLastReadMs("world")).toBe(200); expect(getter).not.toHaveBeenCalled();
});
it.each(["read", "write"])("contains %s failures while retaining in-memory updates", failure => {
  const storage = { getItem: vi.fn(() => {
    if (failure === "read") throw new DOMException("blocked", "SecurityError"); return null;
  }), setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }) };
  expect(readChatLastReadMap(storage)).toEqual({}); exercise(new ChatUnreadTracker(storage));
  expect(storage.setItem).toHaveBeenCalledTimes(2);
});
it("preserves ordinary default persistence and malformed-map fallback", () => {
  const backing = new Map<string, string>([[CHAT_LAST_READ_TS_STORAGE_KEY, "not JSON"]]);
  const storage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
  };
  expect(readChatLastReadMap(storage)).toEqual({});
  exercise(new ChatUnreadTracker(storage));
  expect(readChatLastReadMap(storage)).toEqual({ world: 200 });
  const fresh = new ChatUnreadTracker(storage);
  fresh.replaceSnapshot(snapshot);
  expect(fresh.getSummary(0).world).toBe(0);
});
