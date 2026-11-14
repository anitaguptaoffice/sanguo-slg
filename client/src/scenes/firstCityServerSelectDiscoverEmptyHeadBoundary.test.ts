import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCityDiscoverEmptyHeadBoundaryPanel,
  resolveFirstCityDiscoverEmptyHeadBoundaryView,
} from "./firstCityServerSelectDiscoverEmptyHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function emptyHeadKnowledge() {
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "empty" as const },
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityDiscoverEmptyHeadBoundaryView", () => {
  it("reports empty-head when durable head is EMPTY", () => {
    expect(resolveFirstCityDiscoverEmptyHeadBoundaryView(emptyHeadKnowledge()).kind).toBe("empty-head");
  });

  it("returns none for pending, rejected, or succeeded head", () => {
    const base = emptyHeadKnowledge();
    const intent = createFirstCityIntent(scope, {
      commandId: "22222222-2222-4222-8222-222222222222",
      predecessor: { kind: "empty" },
      name: "演示城",
      x: 1,
      y: 2,
    });
    const template = {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    };
    const pending = { intent, template, state: { kind: "pending" as const } };
    expect(
      resolveFirstCityDiscoverEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const rejected = {
      intent,
      template,
      state: { kind: "rejected" as const, reason: "terrain" as const },
    };
    expect(
      resolveFirstCityDiscoverEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
    const succeeded = {
      intent,
      template,
      state: {
        kind: "succeeded" as const,
        cityId: 99n,
        shard: 1,
        playerId: 7n,
        isCapital: true as const,
        wallLevel: 1 as const,
        morale: 100 as const,
      },
    };
    expect(
      resolveFirstCityDiscoverEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = emptyHeadKnowledge();
  expect(resolveFirstCityDiscoverEmptyHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverEmptyHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityDiscoverEmptyHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityDiscoverEmptyHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats empty-head copy with read-only Discover gate", () => {
  const text = formatFirstCityDiscoverEmptyHeadBoundaryPanel(emptyHeadKnowledge());
  expect(text).toMatch(/Discover empty-head 边界/);
  expect(text).toMatch(/不得用重复 Discover 代替/);
  expect(text).toMatch(/predecessor=EMPTY/);
  expect(text).toMatch(/§5\.2\(6\)/);
  expect(text).toMatch(/观测行不替代本门控/);
});