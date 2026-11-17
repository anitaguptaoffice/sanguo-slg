import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HERO_MARCH_FORCE_SNAPSHOT_MAX_AGE_MS, persistHeroMarchForceFromDetail, validateMarchHeroMarchForce } from "./heroDetailForce";
import { HERO_MARCH_FORCE_SESSION_KEY, readHeroMarchForceSession } from "./heroMarchForceSession";
const now = 1800000000000;
beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });
it.each([[0, false], [179999, false], [180000, true], [86400000, true]])("snapshot age %s has expected blocking authority", (age, ok) => {
  persistHeroMarchForceFromDetail({ hero_id: 7, march_force: 9, march_force_max: 24 });
  const raw = sessionStorage.getItem(HERO_MARCH_FORCE_SESSION_KEY);
  vi.setSystemTime(now + Number(age)); expect(validateMarchHeroMarchForce(7).ok).toBe(ok);
  expect(sessionStorage.getItem(HERO_MARCH_FORCE_SESSION_KEY)).toBe(raw);
  expect(readHeroMarchForceSession(7)?.current).toBe(9);
});
it.each([undefined, null, 0, -1, "not-a-time", "Infinity", now + 1])("does not trust missing/invalid/future timestamp %s", updatedAtMs => {
  sessionStorage.setItem(HERO_MARCH_FORCE_SESSION_KEY, JSON.stringify({ "7": { current: 0, max: 24, updatedAtMs } }));
  expect(validateMarchHeroMarchForce(7).ok).toBe(true);
});
it("does not lock after wall-clock rollback, and a new real detail refresh restores the fresh hint", () => {
  persistHeroMarchForceFromDetail({ hero_id: 7, march_force: 9, march_force_max: 24 });
  vi.setSystemTime(now - 60000); expect(validateMarchHeroMarchForce(7).ok).toBe(true);
  persistHeroMarchForceFromDetail({ hero_id: 7, march_force: 9, march_force_max: 24 });
  expect(validateMarchHeroMarchForce(7).ok).toBe(false);
  persistHeroMarchForceFromDetail({ hero_id: 7, march_force: 10, march_force_max: 24 });
  expect(validateMarchHeroMarchForce(7).ok).toBe(true);
});
it("unknown cache and fresh sufficient stamina remain eligible for server validation", () => {
  expect(validateMarchHeroMarchForce(7).ok).toBe(true);
  expect(HERO_MARCH_FORCE_SNAPSHOT_MAX_AGE_MS).toBe(180000);
  persistHeroMarchForceFromDetail({ hero_id: 7, march_force: 10, march_force_max: 24 });
  expect(validateMarchHeroMarchForce(7).ok).toBe(true);
});
