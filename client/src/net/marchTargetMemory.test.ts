import { describe, expect, it, beforeEach } from "vitest";
import {
  MARCH_TARGET_SESSION_KEY,
  applyMarchTargetAndRemember,
  clearMarchTargetFromForm,
  clearMarchTargetSession,
  parseMarchTargetSessionValue,
  readMarchTargetSession,
  restoreMarchTargetToForm,
  writeMarchTargetSession,
} from "@/net/marchTargetMemory";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("marchTargetMemory", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("uses fixed sessionStorage key and round-trips coords", () => {
    writeMarchTargetSession(12, 34, storage);
    expect(storage.getItem(MARCH_TARGET_SESSION_KEY)).toBe(JSON.stringify({ x: 12, y: 34 }));
    expect(readMarchTargetSession(storage)).toEqual({ x: 12, y: 34 });
  });

  it("parseMarchTargetSessionValue rejects invalid JSON", () => {
    expect(parseMarchTargetSessionValue(null)).toBeNull();
    expect(parseMarchTargetSessionValue("{")).toBeNull();
    expect(parseMarchTargetSessionValue(JSON.stringify({ x: "a", y: 1 }))).toBeNull();
  });

  it("applyMarchTargetAndRemember writes form and session", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-role="march-target-fields"><input data-field="to-x" /><input data-field="to-y" /></div>`;
    expect(applyMarchTargetAndRemember(root, 7, 8, { source: "world_city", storage })).toBe(true);
    expect((root.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("7");
    expect(readMarchTargetSession(storage)).toEqual({ x: 7, y: 8 });
    expect(root.querySelector('[data-role="march-target-fields"]')?.classList.contains("march-target-field-highlight")).toBe(
      false,
    );
  });

  it("highlights fields after minimap pick", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-role="march-target-fields"><input data-field="to-x" /><input data-field="to-y" /></div>`;
    applyMarchTargetAndRemember(root, 1, 2, { source: "minimap", storage });
    expect(root.querySelector('[data-role="march-target-fields"]')?.classList.contains("march-target-field-highlight")).toBe(
      true,
    );
  });

  it("restoreMarchTargetToForm prefers session over fallback", () => {
    writeMarchTargetSession(99, 88, storage);
    const root = document.createElement("div");
    root.innerHTML = `<input data-field="to-x" value="0" /><input data-field="to-y" value="0" />`;
    const restored = restoreMarchTargetToForm(root, { x: 5, y: 5 }, storage);
    expect(restored).toEqual({ x: 99, y: 88 });
    expect((root.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("99");
  });

  it("clearMarchTargetFromForm removes session and resets inputs", () => {
    writeMarchTargetSession(40, 50, storage);
    const root = document.createElement("div");
    root.innerHTML = `<div data-role="march-target-fields" class="march-target-field-highlight"><input data-field="to-x" /><input data-field="to-y" /></div>`;
    applyMarchTargetAndRemember(root, 40, 50, { storage });
    clearMarchTargetFromForm(root, { x: 5, y: 5 }, storage);
    expect(readMarchTargetSession(storage)).toBeNull();
    expect((root.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("5");
    expect(clearMarchTargetSession(storage)).toBeUndefined();
  });
});
