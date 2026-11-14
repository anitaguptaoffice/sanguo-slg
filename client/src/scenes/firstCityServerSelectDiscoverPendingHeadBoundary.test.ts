import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCityDiscoverPendingHeadBoundaryPanel,
  resolveFirstCityDiscoverPendingHeadBoundaryView,
} from "./firstCityServerSelectDiscoverPendingHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function pendingHeadKnowledge() {
  const intent = createFirstCityIntent(scope, {
    commandId: "22222222-2222-4222-8222-222222222222",
    predecessor: { kind: "empty" },
    name: "演示城",
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

describe("resolveFirstCityDiscoverPendingHeadBoundaryView", () => {
  it("reports pending-head when durable head is PENDING", () => {
    const view = resolveFirstCityDiscoverPendingHeadBoundaryView(pendingHeadKnowledge());
    expect(view.kind).toBe("pending-head");
    if (view.kind === "pending-head") {
      expect(view.commandId).toBe("22222222-2222-4222-8222-222222222222");
    }
  });

  it("returns none for EMPTY, rejected, or succeeded head", () => {
    const base = pendingHeadKnowledge();
    expect(
      resolveFirstCityDiscoverPendingHeadBoundaryView({
        ...base,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const intent = base.head.kind === "command" ? base.head.record.intent : null;
    if (!intent) throw new Error("fixture");
    const rejected = {
      intent,
      template: base.records[0]!.template,
      state: { kind: "rejected" as const, reason: "terrain" as const },
    };
    expect(
      resolveFirstCityDiscoverPendingHeadBoundaryView({
        ...base,
        head: { kind: "command", record: rejected },
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
      resolveFirstCityDiscoverPendingHeadBoundaryView({
        ...base,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = pendingHeadKnowledge();
  expect(resolveFirstCityDiscoverPendingHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverPendingHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityDiscoverPendingHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityDiscoverPendingHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats pending-head copy with read-only Discover and Continue hints", () => {
  const text = formatFirstCityDiscoverPendingHeadBoundaryPanel(pendingHeadKnowledge());
  expect(text).toMatch(/Discover pending-head 边界/);
  expect(text).toMatch(/不得用重复 Discover 代替/);
  expect(text).toMatch(/§5\.2\(6\)/);
});