import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCityDiscoverRejectedHeadBoundaryPanel,
  resolveFirstCityDiscoverRejectedHeadBoundaryView,
} from "./firstCityServerSelectDiscoverRejectedHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function rejectedHeadKnowledge(reason: "terrain" | "coordinateOccupied" = "terrain") {
  const intent = createFirstCityIntent(scope, {
    commandId: "22222222-2222-4222-8222-222222222222",
    predecessor: { kind: "empty" },
    name: "拒收演示城",
    x: 1,
    y: 2,
  });
  const record = {
    intent,
    template: {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    },
    state: { kind: "rejected" as const, reason },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityDiscoverRejectedHeadBoundaryView", () => {
  it("reports rejected-head when durable head is REJECTED", () => {
    const view = resolveFirstCityDiscoverRejectedHeadBoundaryView(rejectedHeadKnowledge());
    expect(view.kind).toBe("rejected-head");
    if (view.kind === "rejected-head") {
      expect(view.commandId).toBe("22222222-2222-4222-8222-222222222222");
      expect(view.reason).toBe("terrain");
    }
  });

  it("returns none for EMPTY, pending, or succeeded head", () => {
    const base = rejectedHeadKnowledge();
    expect(
      resolveFirstCityDiscoverRejectedHeadBoundaryView({
        ...base,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const intent = base.head.kind === "command" ? base.head.record.intent : null;
    if (!intent) throw new Error("fixture");
    const pending = {
      intent,
      template: base.records[0]!.template,
      state: { kind: "pending" as const },
    };
    expect(
      resolveFirstCityDiscoverRejectedHeadBoundaryView({
        ...base,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const succeeded = {
      intent,
      template: base.records[0]!.template,
      state: {
        kind: "succeeded" as const,
        cityId: 1n,
        shard: 1,
        playerId: 7n,
        isCapital: true as const,
        wallLevel: 1 as const,
        morale: 100 as const,
      },
    };
    expect(
      resolveFirstCityDiscoverRejectedHeadBoundaryView({
        ...base,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = rejectedHeadKnowledge();
  expect(resolveFirstCityDiscoverRejectedHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverRejectedHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityDiscoverRejectedHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityDiscoverRejectedHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats rejected-head copy with read-only Discover and Submit successor hints", () => {
  const text = formatFirstCityDiscoverRejectedHeadBoundaryPanel(rejectedHeadKnowledge());
  expect(text).toMatch(/Discover rejected-head 边界/);
  expect(text).toMatch(/不得用重复 Discover 代替/);
  expect(text).toMatch(/§5\.2\(7\)/);
  expect(text).toMatch(/predecessor=rejected/);
});