import { afterEach, expect, it, vi } from "vitest";
import { validateMarchHeroMarchForce } from "./heroDetailForce";
import { HERO_MARCH_FORCE_SESSION_KEY, clearHeroMarchForceSession, heroMarchForceSessionRevision,
  readHeroMarchForceSession, writeHeroMarchForceSession } from "./heroMarchForceSession";

afterEach(() => vi.restoreAllMocks());
function fixture() {
  let raw = JSON.stringify({ "7": { current: 5, max: 24, updatedAtMs: Date.now() }, "8": { current: 3, max: 24, updatedAtMs: Date.now() } });
  const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
  return { storage, raw: () => raw };
}
it("read denial is unknown and leaves march eligibility to the server", () => {
  const storage = { getItem: () => { throw new DOMException("denied", "SecurityError"); } };
  expect(readHeroMarchForceSession(7, storage)).toBeNull();
  expect(validateMarchHeroMarchForce(7, storage)).toEqual({ ok: true });
});
it.each(["write", "clear"])("failed %s cannot leave old low force authoritative and still advances order", operation => {
  const f = fixture(), old = f.raw();
  expect(validateMarchHeroMarchForce(7, f.storage).ok).toBe(false);
  f.storage.setItem.mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
  const change = () => operation === "write" ? writeHeroMarchForceSession(7, 24, 24, f.storage) : clearHeroMarchForceSession(7, f.storage);
  expect(change).not.toThrow();
  expect(f.raw()).toBe(old);
  expect(readHeroMarchForceSession(7, f.storage)).toBeNull();
  expect(validateMarchHeroMarchForce(7, f.storage)).toEqual({ ok: true });
  expect(heroMarchForceSessionRevision(7, f.storage)).toBe(1);
  expect(validateMarchHeroMarchForce(8, f.storage).ok).toBe(false);
  expect(heroMarchForceSessionRevision(8, f.storage)).toBe(0);
  expect(validateMarchHeroMarchForce(7, fixture().storage).ok).toBe(false);
  f.storage.setItem.mockImplementation((_key, value) => { f.storage.getItem.mockReturnValue(value); });
  writeHeroMarchForceSession(7, 4, 24, f.storage);
  expect(validateMarchHeroMarchForce(7, f.storage).ok).toBe(false);
  expect(heroMarchForceSessionRevision(7, f.storage)).toBe(2);
});
it.each(["write", "clear"])("a failed read during %s also suppresses the older entry after access recovers", operation => {
  const f = fixture();
  f.storage.getItem.mockImplementationOnce(() => { throw new Error("read denied"); });
  expect(() => operation === "write" ? writeHeroMarchForceSession(7, 24, 24, f.storage) : clearHeroMarchForceSession(7, f.storage)).not.toThrow();
  expect(readHeroMarchForceSession(7, f.storage)).toBeNull();
  expect(f.storage.setItem).not.toHaveBeenCalled();
  expect(heroMarchForceSessionRevision(7, f.storage)).toBe(1);
});
it("default storage getter denial is safe, preserves observation order and suppresses old data on recovery", () => {
  sessionStorage.setItem(HERO_MARCH_FORCE_SESSION_KEY, JSON.stringify({ "71": { current: 1, max: 24, updatedAtMs: Date.now() } }));
  const revision = heroMarchForceSessionRevision(71);
  const getter = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
  expect(() => writeHeroMarchForceSession(71, 24, 24)).not.toThrow();
  expect(heroMarchForceSessionRevision(71)).toBe(revision + 1);
  expect(readHeroMarchForceSession(71)).toBeNull();
  expect(validateMarchHeroMarchForce(71)).toEqual({ ok: true });
  expect(() => clearHeroMarchForceSession(71)).not.toThrow();
  expect(heroMarchForceSessionRevision(71)).toBe(revision + 2);
  getter.mockRestore();
  expect(readHeroMarchForceSession(71)).toBeNull();
  writeHeroMarchForceSession(71, 2, 24);
  expect(validateMarchHeroMarchForce(71).ok).toBe(false);
  sessionStorage.clear();
});
it("missing storage and invalid hero IDs remain harmless", () => {
  expect(readHeroMarchForceSession(7, null)).toBeNull();
  expect(() => writeHeroMarchForceSession(7, 24, 24, null)).not.toThrow();
  expect(() => clearHeroMarchForceSession(7, null)).not.toThrow();
  const f = fixture();
  for (const id of [0, -1, NaN, Infinity]) {
    writeHeroMarchForceSession(id, 24, 24, f.storage); clearHeroMarchForceSession(id, f.storage);
    expect(readHeroMarchForceSession(id, f.storage)).toBeNull();
  }
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
