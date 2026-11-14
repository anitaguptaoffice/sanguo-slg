import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityContinuePendingHeadBoundaryPanel,
  resolveFirstCityContinuePendingHeadBoundaryView,
} from "./firstCityServerSelectContinuePendingHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const commandId = "22222222-2222-4222-8222-222222222222";

function pendingHeadKnowledge() {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "待定城",
    x: 2,
    y: 3,
  });
  const record = {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityContinuePendingHeadBoundaryView", () => {
  it("reports pending-head when durable head is pending", () => {
    const view = resolveFirstCityContinuePendingHeadBoundaryView(pendingHeadKnowledge());
    expect(view).toMatchObject({ kind: "pending-head", commandId });
  });

  it("returns none for empty, rejected, or succeeded head", () => {
    const pending = pendingHeadKnowledge();
    expect(resolveFirstCityContinuePendingHeadBoundaryView({ ...pending, head: { kind: "empty" } }).kind).toBe("none");
    const baseRecord = pending.head.record;
    const rejected = { ...baseRecord, state: { kind: "rejected" as const, reason: "terrain" as const } };
    expect(
      resolveFirstCityContinuePendingHeadBoundaryView({
        ...pending,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
    const succeeded = {
      ...baseRecord,
      state: {
        kind: "succeeded" as const,
        cityId: 9n,
        shard: 1,
        playerId: 7n,
        isCapital: true as const,
        wallLevel: 1 as const,
        morale: 100 as const,
      },
    };
    expect(
      resolveFirstCityContinuePendingHeadBoundaryView({
        ...pending,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = pendingHeadKnowledge();
  expect(resolveFirstCityContinuePendingHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityContinuePendingHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityContinuePendingHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityContinuePendingHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats pending-head copy with explicit Continue hint", () => {
  const text = formatFirstCityContinuePendingHeadBoundaryPanel(pendingHeadKnowledge());
  expect(text).toMatch(/Continue pending-head 边界/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/PENDING head/);
  expect(text).toMatch(/§5\.2\(6\)/);
  expect(text).toMatch(/待定城/);
});