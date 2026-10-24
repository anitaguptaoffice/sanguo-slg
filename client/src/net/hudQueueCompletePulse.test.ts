import { describe, expect, it } from "vitest";
import {
  QUEUE_COMPLETE_PULSE_SESSION_KEY,
  collectHudPulseKeysForQueueCompletes,
  formatHudProductionWalletLine,
  hudResourceKeysForQueueComplete,
  queueCompleteHudDedupeId,
  shouldPulseHudOnQueueComplete,
} from "@/net/hudQueueCompletePulse";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key() {
      return null;
    },
  };
}

describe("hudQueueCompletePulse", () => {
  it("maps build slots and recruit queue to HUD resource keys", () => {
    expect(hudResourceKeysForQueueComplete({ kind: "build", slotKey: "farm" })).toEqual(["food"]);
    expect(hudResourceKeysForQueueComplete({ kind: "build", slotKey: "lumber" })).toEqual(["wood"]);
    expect(hudResourceKeysForQueueComplete({ kind: "build", slotKey: "hall" })).toEqual([]);
    expect(hudResourceKeysForQueueComplete({ kind: "recruit", queueId: 9 })).toEqual(["food"]);
    expect(queueCompleteHudDedupeId({ kind: "build", slotKey: "farm" })).toBe("build:farm");
    expect(queueCompleteHudDedupeId({ kind: "recruit", queueId: 3 })).toBe("recruit:3");
  });

  it("shouldPulseHudOnQueueComplete dedupes via sessionStorage queue-complete-pulse-v1", () => {
    const storage = mockStorage();
    expect(shouldPulseHudOnQueueComplete("build:farm", storage)).toBe(true);
    expect(shouldPulseHudOnQueueComplete("build:farm", storage)).toBe(false);
    expect(shouldPulseHudOnQueueComplete("recruit:2", storage)).toBe(true);
    const raw = storage.getItem(QUEUE_COMPLETE_PULSE_SESSION_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(["build:farm", "recruit:2"]);
  });

  it("collectHudPulseKeysForQueueCompletes respects dedupe across events", () => {
    const storage = mockStorage();
    const first = collectHudPulseKeysForQueueCompletes(
      [{ kind: "build", slotKey: "farm" }, { kind: "recruit", queueId: 1 }],
      storage,
    );
    expect(first).toEqual(["food"]);
    const second = collectHudPulseKeysForQueueCompletes(
      [{ kind: "build", slotKey: "farm" }, { kind: "build", slotKey: "iron" }],
      storage,
    );
    expect(second).toEqual(["iron"]);
  });

  it("formatHudProductionWalletLine mirrors production + wallet sweep (CLIENT-148)", () => {
    const wallet = { food: 100, wood: 2000, iron: 0, stone: 50 };
    const rates = { food: 120, wood: 100, iron: 40, stone: 80 };
    expect(formatHudProductionWalletLine(rates, wallet)).toBe(
      "粮 100 +120/h · 木 2,000 +100/h · 铁 0 +40/h · 石 50 +80/h",
    );
    expect(formatHudProductionWalletLine(undefined, wallet)).toBe("粮 100 · 木 2,000 · 铁 0 · 石 50");
  });
});
